import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * The payroll loop in a real browser: read the week, correct a session,
 * approve, send back, and export.
 *
 * The SQL suite proves the rules (a correction needs a reason, an approved
 * week locks, one decision per person per week). What only a browser can prove
 * is that the buttons call the right RPC with the right arguments — the class
 * of mistake that silently pays the wrong number.
 */

const SITE = "11111111-1111-1111-1111-111111111111";
const ALICE = "aaaaaaaa-0000-0000-0000-000000000001";
const SESSION_1 = "eeee0001-0000-0000-0000-000000000001";
const SESSION_2 = "eeee0002-0000-0000-0000-000000000002";

interface Calls {
  adjust: { p_session_event: string; p_delta_minutes: number; p_note: string }[];
  decide: { p_staff: string; p_status: string; p_minutes: number | null; p_note: string }[];
}

function weekRow(over: Record<string, unknown> = {}) {
  return {
    staff_id: ALICE,
    staff_name: "Alice Ng",
    role: "Cleaner",
    active: true,
    rostered_minutes: 480,
    worked_minutes: 330,
    adjustment_minutes: 0,
    open_sessions: 1,
    status: "pending",
    approved_minutes: null,
    note: "",
    decided_at: null,
    decided_by: null,
    sessions: [
      {
        session_event_id: SESSION_1,
        work_date: "2026-07-27",
        in_at: "2026-07-27T06:00:00+10:00",
        out_at: "2026-07-27T11:30:00+10:00",
        minutes: 330,
        recorded_offline: false,
        selfie_path: null,
        adjustment_minutes: 0,
        adjustment_note: "",
      },
      {
        session_event_id: SESSION_2,
        work_date: "2026-07-28",
        in_at: "2026-07-28T06:00:00+10:00",
        out_at: null,
        minutes: null,
        recorded_offline: true,
        selfie_path: null,
        adjustment_minutes: 0,
        adjustment_note: "",
      },
    ],
    ...over,
  };
}

/** A signed-in session, seeded the way supabase-js stores one. */
async function signIn(page: Page) {
  await page.addInitScript(() => {
    const token = {
      access_token: "e2e-access-token",
      refresh_token: "e2e-refresh-token",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: "11111111-2222-3333-4444-555555555555", email: "manager@example.com" },
    };
    // the project ref comes from the placeholder URL in playwright.config.ts
    window.localStorage.setItem("sb-e2e-kiosk-auth-token", JSON.stringify(token));
  });
}

async function mockRpcs(page: Page, calls: Calls, state: { rows: unknown[] }) {
  await page.route("**/auth/v1/**", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "11111111-2222-3333-4444-555555555555", email: "manager@example.com" }),
    })
  );

  await page.route("**/rest/v1/rpc/*", async (route: Route) => {
    const name = route.request().url().split("/rpc/")[1]!.split("?")[0];
    const body = route.request().postDataJSON() ?? {};
    const json = (data: unknown) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });

    switch (name) {
      case "current_profile":
        return json({
          user: { id: "11111111-2222-3333-4444-555555555555", name: "Priya Sharma", email: "manager@example.com" },
          memberships: [
            { org_id: "org-1", org_name: "FOCT Cleaning", org_slug: "foct", org_type: "cleaning", role: "manager", role_name: "Manager" },
          ],
          buildings: [{ id: SITE, name: "Aurora on Collins", slug: "aurora-on-collins" }],
        });

      case "timesheet_week":
        return json({
          ok: true,
          week_start: body.p_week_start,
          timezone: "Australia/Melbourne",
          rows: state.rows,
        });

      case "attendance_adjust":
        calls.adjust.push(body);
        return json({ ok: true });

      case "timesheet_decide":
        calls.decide.push(body);
        return json({ ok: true, status: body.p_status, approved_minutes: 375, open_sessions: 1 });

      default:
        return json({ ok: true });
    }
  });
}

async function openTimesheets(page: Page, calls: Calls, state: { rows: unknown[] }) {
  await signIn(page);
  await mockRpcs(page, calls, state);
  await page.goto("/timesheets");
  await expect(
    page.getByRole("heading", { name: "Timesheets" }),
    "live timesheets did not render — is the session mock still matching?"
  ).toBeVisible();
  await expect(page.getByText("Alice Ng").first()).toBeVisible({ timeout: 15_000 });
}

test.describe("timesheets", () => {
  test("shows the week built from kiosk punches", async ({ page }) => {
    const calls: Calls = { adjust: [], decide: [] };
    await openTimesheets(page, calls, { rows: [weekRow()] });

    // 330 worked minutes = 5h 30m, and the unclosed shift is called out
    await expect(page.getByText("5h 30m").first()).toBeVisible();
    await expect(page.getByText("1 open").first()).toBeVisible();
    await expect(page.getByText(/Never signed out/i)).toBeVisible();
  });

  test("a correction is sent with its reason", async ({ page }) => {
    const calls: Calls = { adjust: [], decide: [] };
    await openTimesheets(page, calls, { rows: [weekRow()] });

    await page.getByText("Alice Ng").first().click();
    await expect(page.getByRole("heading", { name: /Alice Ng · week of/ })).toBeVisible();

    await page.getByRole("button", { name: "Add 15 minutes" }).first().click();
    await page.getByRole("button", { name: "Add 15 minutes" }).first().click();
    await page.getByLabel("Reason").first().fill("stayed to finish the lobby");
    await page.getByRole("button", { name: "Save" }).first().click();

    await expect.poll(() => calls.adjust.length).toBe(1);
    expect(calls.adjust[0]).toMatchObject({
      p_session_event: SESSION_1,
      p_delta_minutes: 30,
      p_note: "stayed to finish the lobby",
    });
  });

  test("sending back without a reason is refused before it reaches the server", async ({
    page,
  }) => {
    const calls: Calls = { adjust: [], decide: [] };
    await openTimesheets(page, calls, { rows: [weekRow()] });

    await page.getByText("Alice Ng").first().click();
    await page.getByRole("button", { name: /Send back/ }).click();

    // a toast renders its text twice — visibly and in the live region
    await expect(page.getByText(/Say why/i).first()).toBeVisible();
    expect(calls.decide).toHaveLength(0);
  });

  test("sending back with a reason records it", async ({ page }) => {
    const calls: Calls = { adjust: [], decide: [] };
    await openTimesheets(page, calls, { rows: [weekRow()] });

    await page.getByText("Alice Ng").first().click();
    await page.getByLabel("Note for this week").fill("Tuesday looks wrong");
    await page.getByRole("button", { name: /Send back/ }).click();

    await expect.poll(() => calls.decide.length).toBe(1);
    expect(calls.decide[0]).toMatchObject({
      p_staff: ALICE,
      p_status: "rejected",
      p_note: "Tuesday looks wrong",
    });
  });

  test("approving pays worked plus corrections, and an override wins", async ({ page }) => {
    const calls: Calls = { adjust: [], decide: [] };
    await openTimesheets(page, calls, { rows: [weekRow({ adjustment_minutes: 45 })] });

    await page.getByText("Alice Ng").first().click();
    // 330 + 45 = 375 minutes = 6h 15m, offered on the button itself
    await expect(page.getByRole("button", { name: /Approve 6h 15m/ })).toBeVisible();

    await page.getByLabel(/Pay a different number of hours/).fill("5");
    await page.getByRole("button", { name: /Approve/ }).click();

    await expect.poll(() => calls.decide.length).toBe(1);
    expect(calls.decide[0]).toMatchObject({ p_status: "approved", p_minutes: 300 });
  });

  test("an approved week is locked in the UI and offers Reopen instead", async ({ page }) => {
    const calls: Calls = { adjust: [], decide: [] };
    await openTimesheets(page, calls, {
      rows: [
        weekRow({
          status: "approved",
          approved_minutes: 375,
          decided_by: "Priya Sharma",
          decided_at: "2026-07-29T09:00:00+10:00",
        }),
      ],
    });

    await page.getByText("Alice Ng").first().click();
    await expect(page.getByText(/Approved by Priya Sharma/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Reopen/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Approve/ })).toBeHidden();

    // the correction controls are disabled while it is approved
    await expect(page.getByRole("button", { name: "Add 15 minutes" }).first()).toBeDisabled();

    await page.getByRole("button", { name: /Reopen/ }).click();
    await expect.poll(() => calls.decide.length).toBe(1);
    expect(calls.decide[0]).toMatchObject({ p_status: "pending" });
  });

  test("exports a CSV with one row per session", async ({ page }) => {
    const calls: Calls = { adjust: [], decide: [] };
    await openTimesheets(page, calls, { rows: [weekRow({ adjustment_minutes: 45 })] });

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Export CSV/ }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^timesheets-aurora-on-collins-\d{4}-\d{2}-\d{2}\.csv$/);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const csv = Buffer.concat(chunks).toString("utf8");

    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(3); // header + two sessions
    expect(lines[0]).toContain("Week paid (decimal)");
    expect(csv).toContain("Alice Ng");
    expect(csv).toContain("STILL ON SITE");
    expect(csv).toContain("6.25"); // 375 minutes
  });
});
