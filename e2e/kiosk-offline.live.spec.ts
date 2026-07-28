import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * The offline journey, in a real browser, with the server intercepted.
 *
 * This is the one that matters. The unit tests prove the sync engine's logic;
 * this proves the whole thing works where it actually runs — IndexedDB,
 * bcrypt in the browser, the fallback when a request never arrives, and the
 * promise that a replay cannot double-punch anyone.
 *
 * The real-hardware version of this is docs/TESTING.md §10 (a tablet, in
 * flight mode, force-quit). This is the version that can run on every push.
 */

const TOKEN = "11111111-2222-3333-4444-555555555555";
const ALICE = "aaaaaaaa-0000-0000-0000-000000000001";
// bcrypt of "4821", cost 8 — generated once, checked in deliberately so the
// test does not depend on hashing at runtime
const ALICE_HASH = "$2b$08$yCFFoJAC1nn4XO63ZbCUqOh7rgCzo.lQ1KHRw/SlOgrbSA0aXmGg6";

interface Recorded {
  syncCalls: { client_event_id: string; staff_id: string; kind: string }[][];
  punchCalls: number;
}

/** Intercepts the Supabase REST surface; `state.offline` fails every call the
 *  way a dead Wi-Fi link does. */
async function mockSupabase(page: Page, state: { offline: boolean }, recorded: Recorded) {
  await page.route("**/rest/v1/rpc/*", async (route: Route) => {
    if (state.offline) return route.abort("internetdisconnected");

    const name = route.request().url().split("/rpc/")[1]!.split("?")[0];
    const body = route.request().postDataJSON() ?? {};
    const json = (data: unknown) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });

    switch (name) {
      case "kiosk_pair":
        return json({
          ok: true,
          device_token: TOKEN,
          device_label: "Cleaners room tablet",
          building_id: "site-1",
          building_name: "Aurora on Collins",
        });

      case "kiosk_bootstrap":
        return json({
          ok: true,
          server_time: new Date().toISOString(),
          device: { id: "dev-1", label: "Cleaners room tablet" },
          site: {
            id: "site-1",
            name: "Aurora on Collins",
            timezone: "Australia/Melbourne",
            default_language: "en",
          },
          staff: [
            { id: ALICE, name: "Alice Ng", role: "Cleaner", pin_hash: ALICE_HASH, language: "en" },
          ],
          notices: [
            {
              id: "n1",
              title: { en: "Loading dock", hi: "लोडिंग डॉक" },
              body: {
                en: "Loading dock closed until 06:30",
                hi: "लोडिंग डॉक 06:30 तक बंद है",
              },
              priority: "important",
              requires_ack: false,
              version: 1,
              starts_on: new Date().toISOString().slice(0, 10),
              ends_on: null,
              start_min: null,
              end_min: null,
            },
          ],
        });

      case "kiosk_sync": {
        const events = (body.p_events ?? []) as Recorded["syncCalls"][number];
        recorded.syncCalls.push(events);
        return json({
          ok: true,
          server_time: new Date().toISOString(),
          results: events.map((e) => ({
            client_event_id: e.client_event_id,
            ok: true,
            event_id: `srv-${e.client_event_id}`,
          })),
        });
      }

      case "kiosk_punch":
        recorded.punchCalls++;
        return json({
          ok: true,
          staff_id: ALICE,
          staff_name: "Alice Ng",
          kind: body.p_kind,
          event_id: "srv-online-1",
        });

      case "notices_for_staff":
        return json({ ok: true, notices: [] });

      default:
        return json({ ok: true });
    }
  });

  // storage uploads are not what this test is about
  await page.route("**/storage/v1/object/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );
}

/** The notice text appears twice on purpose — once visibly and once in an
 *  sr-only block holding every language — so assertions target the visible
 *  paragraph. */
const noticeText = (page: Page, text: string) => page.locator("p", { hasText: text }).first();

async function pair(page: Page) {
  await page.goto("/kiosk");
  // Fail loudly rather than mysteriously: if this heading is absent the server
  // on this port was built WITHOUT the placeholder Supabase env, so the kiosk
  // is in demo mode and none of the assertions below mean anything.
  await expect(
    page.getByRole("heading", { name: "Set up this tablet" }),
    "the kiosk-live server is not running a live-env build — rebuild with NEXT_PUBLIC_SUPABASE_* set (see playwright.config.ts)"
  ).toBeVisible();
  for (const d of ["1", "2", "3", "4", "5", "6"]) {
    await page.getByRole("button", { name: d, exact: true }).click();
  }
  await expect(page.getByLabel("Find your name")).toBeVisible({ timeout: 15_000 });
}

async function enterPin(page: Page, pin: string) {
  for (const d of pin.split("")) {
    await page.getByRole("button", { name: d, exact: true }).click();
  }
}

test.describe("kiosk offline", () => {
  test("pairs, caches the site, and shows the day's notice in both languages", async ({ page }) => {
    const state = { offline: false };
    const recorded: Recorded = { syncCalls: [], punchCalls: 0 };
    await mockSupabase(page, state, recorded);

    await pair(page);

    // the cached general notice is on the idle screen, with its language chip
    await expect(noticeText(page, "Loading dock closed until 06:30")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("EN", { exact: true }).first()).toBeVisible();
  });

  test("signs someone in with NO network and syncs it once the network returns", async ({
    page,
  }) => {
    const state = { offline: false };
    const recorded: Recorded = { syncCalls: [], punchCalls: 0 };
    await mockSupabase(page, state, recorded);
    await pair(page);
    await expect(noticeText(page, "Loading dock closed until 06:30")).toBeVisible({
      timeout: 15_000,
    });

    // --- pull the plug ---
    state.offline = true;
    await page.context().setOffline(true);

    await enterPin(page, "4821");
    await page.getByRole("button", { name: /Check in/ }).click();

    // the cleaner is answered immediately, from the cached PIN hash
    await expect(page.getByRole("heading", { name: /You’re checked in/ })).toBeVisible({
      timeout: 25_000,
    });
    expect(recorded.syncCalls).toHaveLength(0); // nothing reached the server yet

    // --- the Wi-Fi comes back ---
    state.offline = false;
    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));

    await expect
      .poll(() => recorded.syncCalls.flat().length, { timeout: 30_000 })
      .toBeGreaterThan(0);

    const events = recorded.syncCalls.flat();
    expect(events[0]!.staff_id).toBe(ALICE);
    expect(events[0]!.kind).toBe("in");

    // and it is sent exactly once, however many times sync runs
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await page.waitForTimeout(1500);
    const ids = new Set(recorded.syncCalls.flat().map((e) => e.client_event_id));
    expect(ids.size).toBe(1);
  });

  test("a wrong PIN offline is refused without naming anyone", async ({ page }) => {
    const state = { offline: false };
    const recorded: Recorded = { syncCalls: [], punchCalls: 0 };
    await mockSupabase(page, state, recorded);
    await pair(page);
    await expect(noticeText(page, "Loading dock closed until 06:30")).toBeVisible({
      timeout: 15_000,
    });

    state.offline = true;
    await page.context().setOffline(true);

    await enterPin(page, "0000");
    await page.getByRole("button", { name: /Check in/ }).click();

    const notice = page.locator('[aria-live="assertive"]').first();
    await expect(notice).toContainText(/not recognised/i, { timeout: 20_000 });
    await expect(notice).not.toContainText(/Alice/);
  });

  test("the survivable failure: a punch queued while the request dies mid-flight", async ({
    page,
  }) => {
    const state = { offline: false };
    const recorded: Recorded = { syncCalls: [], punchCalls: 0 };
    await mockSupabase(page, state, recorded);
    await pair(page);
    await expect(noticeText(page, "Loading dock closed until 06:30")).toBeVisible({
      timeout: 15_000,
    });

    // the browser still believes it is online; the request simply never lands
    state.offline = true;

    await enterPin(page, "4821");
    await page.getByRole("button", { name: /Check in/ }).click();

    // the cleaner is not left staring at a spinner
    await expect(page.getByRole("heading", { name: /You’re checked in/ })).toBeVisible({
      timeout: 25_000,
    });

    state.offline = false;
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect
      .poll(() => recorded.syncCalls.flat().length, { timeout: 30_000 })
      .toBeGreaterThan(0);
  });
});
