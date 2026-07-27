// @vitest-environment jsdom
/**
 * The offline sync engine — the most consequential logic in the product.
 *
 * If this breaks, a cleaner's shift silently disappears or is paid twice. So
 * the cases below are the ones that actually happen in a basement with bad
 * Wi-Fi: a sign-in with no network, a flush that half-succeeds, a batch
 * replayed after a dropped connection, and a tablet whose clock is wrong.
 */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// One mock RPC surface for every test; each test sets its own behaviour.
const rpc = vi.fn();
const upload = vi.fn();

vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: true,
  getSupabase: () => ({
    rpc,
    storage: { from: () => ({ upload }) },
  }),
}));

const {
  bootstrap,
  cachedNotices,
  describeLastSync,
  flush,
  pendingCount,
  record,
  searchCached,
  syncState,
  verifyPinOffline,
} = await import("@/lib/kiosk-sync");
const { kioskDb, META, setMeta } = await import("@/lib/kiosk-db");
const bcrypt = (await import("bcryptjs")).default;

const TOKEN = "11111111-2222-3333-4444-555555555555";
const ALICE = "aaaaaaaa-0000-0000-0000-000000000001";
const BOB = "bbbbbbbb-0000-0000-0000-000000000002";

const today = () => new Date().toISOString().slice(0, 10);

async function reset() {
  const db = kioskDb()!;
  await db.employees.clear();
  await db.notices.clear();
  await db.outbox.clear();
  await db.selfies.clear();
  await db.meta.clear();
  rpc.mockReset();
  upload.mockReset();
  // navigator.onLine is read directly; jsdom-less Node needs it stubbed
  vi.stubGlobal("navigator", { onLine: true });
}

beforeEach(reset);

describe("bootstrap", () => {
  it("caches employees, general notices, site and the clock offset", async () => {
    const serverTime = new Date(Date.now() + 90_000).toISOString(); // tablet is 90s slow
    rpc.mockResolvedValue({
      data: {
        ok: true,
        server_time: serverTime,
        site: { id: "site-1", name: "Aurora on Collins", timezone: "Australia/Melbourne", default_language: "en" },
        staff: [{ id: ALICE, name: "Alice Ng", role: "Cleaner", pin_hash: null, language: "en" }],
        notices: [
          {
            id: "n1",
            title: { en: "Dock" },
            body: { en: "Closed until 06:30" },
            priority: "important",
            requires_ack: false,
            version: 1,
            starts_on: today(),
            ends_on: null,
            start_min: null,
            end_min: null,
          },
        ],
      },
      error: null,
    });

    const res = await bootstrap(TOKEN);
    expect(res.ok).toBe(true);
    expect(await kioskDb()!.employees.count()).toBe(1);
    expect(await kioskDb()!.notices.count()).toBe(1);

    const offset = (await kioskDb()!.meta.get(META.clockOffset))?.value as number;
    expect(offset).toBeGreaterThan(60_000); // ~90s, learned not assumed
  });

  it("reports the error instead of half-caching when the server refuses", async () => {
    rpc.mockResolvedValue({ data: { ok: false, error: "Device not paired" }, error: null });
    const res = await bootstrap(TOKEN);
    expect(res.ok).toBe(false);
    expect(res.error).toBe("Device not paired");
    expect(await kioskDb()!.employees.count()).toBe(0);
  });
});

describe("offline PIN verification", () => {
  beforeEach(async () => {
    await kioskDb()!.employees.bulkPut([
      { id: ALICE, name: "Alice Ng", role: "Cleaner", pin_hash: bcrypt.hashSync("4821", 4), language: "en" },
      { id: BOB, name: "Bob Singh", role: "Cleaner", pin_hash: bcrypt.hashSync("9073", 4), language: "pa" },
    ]);
  });

  it("finds the right person from a PIN alone", async () => {
    expect((await verifyPinOffline("4821"))?.id).toBe(ALICE);
    expect((await verifyPinOffline("9073"))?.id).toBe(BOB);
  });

  it("refuses a PIN nobody has", async () => {
    expect(await verifyPinOffline("0000")).toBeNull();
  });

  it("refuses someone else's PIN when a name was chosen", async () => {
    expect(await verifyPinOffline("9073", ALICE)).toBeNull();
    expect((await verifyPinOffline("4821", ALICE))?.id).toBe(ALICE);
  });

  it("never stores anything a PIN can be read back from", async () => {
    const rows = await kioskDb()!.employees.toArray();
    for (const r of rows) {
      expect(r.pin_hash).not.toContain("4821");
      expect(r.pin_hash).not.toContain("9073");
      expect(r.pin_hash?.startsWith("$2")).toBe(true);
    }
  });
});

describe("recording offline", () => {
  it("writes to the outbox immediately and flags that it was offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const res = await record({ kind: "in", staffId: ALICE, staffName: "Alice Ng", online: false });
    expect(res.clientEventId).toMatch(/^[0-9a-f-]{36}$/i);

    const items = await kioskDb()!.outbox.toArray();
    expect(items).toHaveLength(1);
    expect(items[0]!.recorded_offline).toBe(true);
    expect(items[0]!.kind).toBe("in");
  });

  it("corrects the recorded time by the learned clock offset", async () => {
    await setMeta(META.clockOffset, 120_000); // tablet is two minutes slow
    const before = Date.now();
    const res = await record({ kind: "in", staffId: ALICE, staffName: "Alice Ng", online: true });
    expect(res.at.getTime()).toBeGreaterThanOrEqual(before + 119_000);
  });

  it("gives every event its own id, so two people signing in never collide", async () => {
    await record({ kind: "in", staffId: ALICE, staffName: "Alice Ng", online: false });
    await record({ kind: "in", staffId: BOB, staffName: "Bob Singh", online: false });
    const ids = (await kioskDb()!.outbox.toArray()).map((i) => i.client_event_id);
    expect(new Set(ids).size).toBe(2);
  });
});

describe("flush", () => {
  async function queueThree() {
    for (const [id, name] of [
      [ALICE, "Alice Ng"],
      [BOB, "Bob Singh"],
      [ALICE, "Alice Ng"],
    ] as const) {
      await record({ kind: "in", staffId: id, staffName: name, online: false });
    }
    return (await kioskDb()!.outbox.toArray()).map((i) => i.client_event_id);
  }

  it("pushes the queue and empties it on success", async () => {
    const ids = await queueThree();
    rpc.mockResolvedValue({
      data: {
        ok: true,
        server_time: new Date().toISOString(),
        results: ids.map((id) => ({ client_event_id: id, ok: true, event_id: `srv-${id}` })),
      },
      error: null,
    });

    const res = await flush(TOKEN);
    expect(res.pushed).toBe(3);
    expect(await pendingCount()).toBe(0);
  });

  it("keeps what the server refused and counts the attempt", async () => {
    const ids = await queueThree();
    rpc.mockResolvedValue({
      data: {
        ok: true,
        results: [
          { client_event_id: ids[0], ok: true, event_id: "srv-1" },
          { client_event_id: ids[1], ok: false, error: "Unknown employee for this site" },
          { client_event_id: ids[2], ok: true, event_id: "srv-3" },
        ],
      },
      error: null,
    });

    const res = await flush(TOKEN);
    expect(res.pushed).toBe(2);
    expect(res.failed).toBe(1);

    const left = await kioskDb()!.outbox.toArray();
    expect(left).toHaveLength(1);
    expect(left[0]!.attempts).toBe(1);
    expect(left[0]!.last_error).toMatch(/Unknown employee/);
  });

  it("running twice pushes nothing the second time — the anti-double-punch rule", async () => {
    const ids = await queueThree();
    rpc.mockResolvedValue({
      data: { ok: true, results: ids.map((id) => ({ client_event_id: id, ok: true, event_id: `srv-${id}` })) },
      error: null,
    });

    await flush(TOKEN);
    rpc.mockClear();
    const second = await flush(TOKEN);

    expect(second.pushed).toBe(0);
    // nothing left to send, so the server is not even called
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does nothing at all while the tablet is offline", async () => {
    await queueThree();
    vi.stubGlobal("navigator", { onLine: false });
    const res = await flush(TOKEN);
    expect(res.pushed).toBe(0);
    expect(rpc).not.toHaveBeenCalled();
    expect(await pendingCount()).toBe(3); // still safely queued
  });

  it("survives a network error without losing the queue", async () => {
    await queueThree();
    rpc.mockRejectedValue(new Error("Failed to fetch"));
    const res = await flush(TOKEN);
    expect(res.pushed).toBe(0);
    expect(await pendingCount()).toBe(3);
  });
});

describe("cached notices", () => {
  it("shows only what is inside its date and time window", async () => {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    await kioskDb()!.notices.bulkPut([
      base("current", { starts_on: today(), ends_on: null }),
      base("expired", { starts_on: "2020-01-01", ends_on: "2020-01-02" }),
      base("future", { starts_on: "2099-01-01", ends_on: null }),
      base("morning-only", {
        starts_on: today(),
        ends_on: null,
        start_min: Math.max(0, mins - 30),
        end_min: Math.min(1440, mins + 30),
      }),
      base("night-only", {
        starts_on: today(),
        ends_on: null,
        start_min: Math.min(1439, mins + 60),
        end_min: 1440,
      }),
    ]);

    const ids = (await cachedNotices()).map((n) => n.id).sort();
    expect(ids).toEqual(["current", "morning-only"]);
  });
});

describe("name search", () => {
  it("needs two letters and matches anywhere in the name", async () => {
    await kioskDb()!.employees.bulkPut([
      { id: ALICE, name: "Alice Ng", role: "Cleaner", pin_hash: null, language: "en" },
      { id: BOB, name: "Bob Singh", role: "Cleaner", pin_hash: null, language: "en" },
    ]);
    expect(await searchCached("A")).toHaveLength(0);
    expect((await searchCached("ali")).map((e) => e.id)).toEqual([ALICE]);
    expect((await searchCached("singh")).map((e) => e.id)).toEqual([BOB]);
  });
});

describe("sync state", () => {
  it("calls a never-synced tablet stale, and a fresh one not", async () => {
    expect((await syncState()).stale).toBe(true);
    await setMeta(META.lastSync, new Date().toISOString());
    expect((await syncState()).stale).toBe(false);
    await setMeta(META.lastSync, new Date(Date.now() - 8 * 86_400_000).toISOString());
    expect((await syncState()).stale).toBe(true);
  });

  it("describes the last sync in words a cleaner can act on", () => {
    expect(describeLastSync(null)).toBe("never");
    expect(describeLastSync(new Date(Date.now() - 30 * 60_000).toISOString())).toBe("30 minutes ago");
    expect(describeLastSync(new Date(Date.now() - 3 * 3_600_000).toISOString())).toBe("3 hours ago");
  });
});

function base(id: string, over: Partial<Record<string, unknown>>) {
  return {
    id,
    title: {},
    body: { en: id },
    priority: "info" as const,
    requires_ack: false,
    version: 1,
    starts_on: today(),
    ends_on: null,
    start_min: null,
    end_min: null,
    ...over,
  } as never;
}
