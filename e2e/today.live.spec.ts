import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * Today, in a real browser: who is on site, who is late, who never turned up —
 * and the one case where the screen must show counts instead of names.
 *
 * The SQL suite proves the states (`attendance_day_isolation_check.sql`, 16
 * assertions). What only a browser can prove is that a missing cleaner is
 * visibly a problem rather than a grey row, and that `detail: false` renders an
 * explanation instead of an empty table.
 */

const SITE = "11111111-1111-1111-1111-111111111111";

function row(over: Record<string, unknown> = {}) {
  return {
    staff_id: "aaaa0001-0000-0000-0000-000000000001",
    staff_name: "Alice Ng",
    role: "Cleaner",
    active: true,
    shifts: [{ id: "s1", start_min: 360, end_min: 840, zone: "Lobby", note: "" }],
    rostered_minutes: 480,
    expected_start_min: 360,
    expected_end_min: 840,
    first_in: "2026-07-30T06:02:00+10:00",
    last_out: null,
    open_since: "2026-07-30T06:02:00+10:00",
    worked_minutes: 0,
    sessions: 1,
    open_sessions: 1,
    recorded_offline: false,
    on_site: true,
    unrostered: false,
    late_minutes: 0,
    overdue_minutes: 0,
    state: "on_site",
    ...over,
  };
}

const summary = (over: Record<string, number> = {}) => ({
  people: 3,
  rostered: 3,
  on_site: 1,
  finished: 1,
  upcoming: 0,
  missed: 1,
  late: 1,
  overdue: 0,
  unrostered_here: 0,
  rostered_minutes: 1440,
  worked_minutes: 330,
  ...over,
});

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
    window.localStorage.setItem("sb-e2e-kiosk-auth-token", JSON.stringify(token));
  });
}

async function openToday(page: Page, day: Record<string, unknown>) {
  await signIn(page);
  await page.route("**/auth/v1/**", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "11111111-2222-3333-4444-555555555555",
        email: "manager@example.com",
      }),
    })
  );
  await page.route("**/rest/v1/rpc/*", async (route: Route) => {
    const name = route.request().url().split("/rpc/")[1]!.split("?")[0];
    const body = route.request().postDataJSON() ?? {};
    const json = (data: unknown) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });

    if (name === "current_profile")
      return json({
        user: { id: "11111111-2222-3333-4444-555555555555", name: "Priya Sharma", email: "m@e.com" },
        memberships: [
          {
            org_id: "org-1",
            org_name: "FOCT Cleaning",
            org_slug: "foct",
            org_type: "cleaning",
            role: "manager",
            role_name: "Manager",
          },
        ],
        buildings: [{ id: SITE, name: "Aurora on Collins", slug: "aurora-on-collins" }],
      });
    if (name === "attendance_day")
      return json({
        ok: true,
        date: body.p_date,
        timezone: "Australia/Melbourne",
        server_time: new Date().toISOString(),
        now_min: 600,
        grace_min: 15,
        ...day,
      });
    if (name === "roster_week")
      return json({
        ok: true,
        week_start: body.p_week_start,
        timezone: "Australia/Melbourne",
        staff: [],
        shifts: [],
      });
    return json({ ok: true });
  });
  await page.goto("/roster");
  await expect(page.getByRole("heading", { name: "Roster", exact: true })).toBeVisible();
}

test.describe("today", () => {
  test("a missing cleaner reads as a problem, not a grey row", async ({ page }) => {
    await openToday(page, {
      detail: true,
      summary: summary(),
      rows: [
        row({
          staff_id: "c1",
          staff_name: "Cara Diaz",
          state: "missed",
          first_in: null,
          open_since: null,
          on_site: false,
          sessions: 0,
          open_sessions: 0,
        }),
        row(),
      ],
    });

    await expect(page.getByText("No check-in for a 06:00 start")).toBeVisible();
    // and the count is called out at the top, with the grace period named
    await expect(page.getByText(/rostered, nothing after 15 minutes/)).toBeVisible();
    await expect(page.getByText("Cara Diaz")).toBeVisible();
  });

  test("late is here-and-late, not absent", async ({ page }) => {
    await openToday(page, {
      detail: true,
      summary: summary({ missed: 0 }),
      rows: [row({ late_minutes: 45 })],
    });

    await expect(page.getByText("Arrived 45m late")).toBeVisible();
    // "On site now" is the metric card's label, so pin the row's own pill
    await expect(page.getByText("On site", { exact: true })).toBeVisible();
  });

  test("someone who never signed out is flagged as still on site", async ({ page }) => {
    await openToday(page, {
      detail: true,
      summary: summary({ missed: 0, late: 0, overdue: 1 }),
      rows: [row({ overdue_minutes: 190 })],
    });

    await expect(page.getByText(/Still signed in 3h 10m past the finish/)).toBeVisible();
  });

  test("someone here who was not rostered is shown, not hidden", async ({ page }) => {
    await openToday(page, {
      detail: true,
      summary: summary({ missed: 0, late: 0, unrostered_here: 1 }),
      rows: [row({ unrostered: true, shifts: [], rostered_minutes: 0, expected_start_min: null })],
    });

    await expect(page.getByText("Here today, not on the roster")).toBeVisible();
    await expect(page.getByText("not rostered")).toBeVisible();
  });

  test("the owner side is told it sees progress, not staff records", async ({ page }) => {
    // this is the isolation rule surfacing in the UI: detail:false means the
    // database refused the names, and the screen says so rather than looking broken
    await openToday(page, { detail: false, summary: summary(), rows: [] });

    await expect(page.getByText(/Individual staff records belong to the company/)).toBeVisible();
    await expect(page.getByText(/1 on site, 1 finished of 3 rostered/)).toBeVisible();
  });
});
