import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * The roster board in a real browser: read the week, add a shift on the day you
 * clicked, edit one, remove one, and copy last week.
 *
 * The SQL suite proves the rules (no inverted shift, no double-booking, only
 * your own staff). What only a browser can prove is that the cell you clicked
 * becomes the day and person that reach the server — the class of mistake that
 * silently rosters the wrong cleaner on the wrong day.
 */

const SITE = "11111111-1111-1111-1111-111111111111";
const ALICE = "aaaaaaaa-0000-0000-0000-000000000001";
const BOB = "bbbbbbbb-0000-0000-0000-000000000002";
const SHIFT_1 = "cccc0001-0000-0000-0000-000000000001";

interface Calls {
  set: {
    p_staff: string;
    p_work_date: string;
    p_start_min: number;
    p_end_min: number;
    p_zone: string;
    p_note: string;
    p_id: string | null;
  }[];
  del: { p_id: string }[];
  copy: { p_from_week: string; p_to_week: string }[];
}

/** The week the screen asked for — the board opens on the current Monday, so
 *  the spec learns the date from the request rather than recomputing it. */
interface State {
  week: string;
  /** the server's next answer to roster_shift_set */
  setResult: Record<string, unknown>;
  copyResult: Record<string, unknown>;
}

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

async function mockRpcs(page: Page, calls: Calls, state: State) {
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

    switch (name) {
      case "current_profile":
        return json({
          user: {
            id: "11111111-2222-3333-4444-555555555555",
            name: "Priya Sharma",
            email: "manager@example.com",
          },
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

      case "attendance_day":
        // the board's sibling view (0013) — answered so the default Today view
        // renders, then these specs switch to the week board
        return json({
          ok: true,
          date: body.p_date,
          timezone: "Australia/Melbourne",
          server_time: new Date().toISOString(),
          now_min: 600,
          grace_min: 15,
          detail: true,
          summary: {
            people: 1, rostered: 1, on_site: 1, finished: 0, upcoming: 0, missed: 0,
            late: 0, overdue: 0, unrostered_here: 0, rostered_minutes: 480, worked_minutes: 0,
          },
          rows: [],
        });

      case "roster_week": {
        state.week = String(body.p_week_start);
        return json({
          ok: true,
          week_start: state.week,
          timezone: "Australia/Melbourne",
          staff: [
            { id: ALICE, name: "Alice Ng", role: "Cleaner", rostered_minutes: 480 },
            { id: BOB, name: "Bob Tran", role: "Cleaner", rostered_minutes: 0 },
          ],
          shifts: [
            {
              id: SHIFT_1,
              staff_id: ALICE,
              staff_name: "Alice Ng",
              work_date: state.week, // the Monday
              start_min: 360,
              end_min: 840,
              minutes: 480,
              zone: "Lobby",
              note: "marble",
            },
          ],
        });
      }

      case "roster_shift_set":
        calls.set.push(body);
        return json(state.setResult);

      case "roster_shift_delete":
        calls.del.push(body);
        return json({ ok: true });

      case "roster_copy_week":
        calls.copy.push(body);
        return json(state.copyResult);

      default:
        return json({ ok: true });
    }
  });
}

async function openRoster(page: Page, calls: Calls, state: State) {
  await signIn(page);
  await mockRpcs(page, calls, state);
  await page.goto("/roster");
  await expect(
    page.getByRole("heading", { name: "Roster", exact: true }),
    "the live roster did not render — is the session mock still matching?"
  ).toBeVisible();
  // Today is the default view; every spec here is about the week board
  await page.getByRole("button", { name: "Week board" }).click();
  await expect(page.getByText("Alice Ng").first()).toBeVisible({ timeout: 15_000 });
}

const freshState = (): State => ({
  week: "",
  setResult: { ok: true, id: "new-shift" },
  copyResult: { ok: true, copied: 4, skipped: 1 },
});

const freshCalls = (): Calls => ({ set: [], del: [], copy: [] });

test.describe("roster board", () => {
  test("shows the week's shifts and who has none", async ({ page }) => {
    const calls = freshCalls();
    await openRoster(page, calls, freshState());

    // the chip carries the times and the area, not an id
    await expect(page.getByRole("button", { name: /06:00–14:00/ }).first()).toBeVisible();
    await expect(page.getByText("Lobby").first()).toBeVisible();
    // Alice's weekly total, and Bob called out as unrostered
    await expect(page.getByText("8h").first()).toBeVisible();
    await expect(page.getByText("not rostered").first()).toBeVisible();
    await expect(page.getByText(/on the site, no shifts this week/)).toBeVisible();
  });

  test("the cell you click becomes the person and the day that reach the server", async ({
    page,
  }) => {
    const calls = freshCalls();
    const state = freshState();
    await openRoster(page, calls, state);

    // Bob, on the Monday: the only Monday cell bearing his name
    await page.getByRole("button", { name: /Add a shift for Bob Tran on Mon/ }).click();
    await expect(page.getByRole("heading", { name: "Add a shift" })).toBeVisible();

    await page.getByLabel("Area (optional)").fill("Car park");
    await page.getByRole("button", { name: "Add shift" }).click();

    await expect.poll(() => calls.set.length).toBe(1);
    expect(calls.set[0]).toMatchObject({
      p_staff: BOB,
      p_work_date: state.week,
      p_start_min: 360, // the 06:00 default
      p_end_min: 840,
      p_zone: "Car park",
      p_id: null,
    });
  });

  test("an existing shift opens for editing and keeps its identity", async ({ page }) => {
    const calls = freshCalls();
    const state = freshState();
    await openRoster(page, calls, state);

    await page.getByRole("button", { name: /06:00–14:00/ }).first().click();
    await expect(page.getByRole("heading", { name: "Edit shift" })).toBeVisible();

    await page.getByLabel("Start").fill("05:00");
    await page.getByRole("button", { name: "Save shift" }).click();

    await expect.poll(() => calls.set.length).toBe(1);
    expect(calls.set[0]).toMatchObject({
      p_id: SHIFT_1,
      p_staff: ALICE,
      p_start_min: 300,
      p_end_min: 840,
    });
  });

  test("a clash is named before the round trip, and the server's refusal is shown", async ({
    page,
  }) => {
    const calls = freshCalls();
    const state = freshState();
    state.setResult = {
      ok: false,
      overlap: true,
      error: "They are already rostered over that time that day.",
    };
    await openRoster(page, calls, state);

    // Alice already works 06:00–14:00 on the Monday; roster her again over it
    await page.getByRole("button", { name: /Add a shift for Alice Ng on Mon/ }).click();
    await page.getByLabel("Start").fill("13:00");
    await page.getByLabel("Finish").fill("18:00");

    // the courtesy warning, from the shifts already on the board
    await expect(page.getByText(/Already rostered 06:00–14:00/)).toBeVisible();

    // and pressing on anyway surfaces the server's own words
    await page.getByRole("button", { name: "Add shift" }).click();
    await expect(page.getByText(/already rostered over that time that day/i)).toBeVisible();
    // the modal stays open, so the times can be fixed rather than retyped
    await expect(page.getByRole("heading", { name: "Add a shift" })).toBeVisible();
  });

  test("a finish before the start never leaves the browser", async ({ page }) => {
    const calls = freshCalls();
    await openRoster(page, calls, freshState());

    await page.getByRole("button", { name: /Add a shift for Bob Tran on Mon/ }).click();
    await page.getByLabel("Start").fill("14:00");
    await page.getByLabel("Finish").fill("06:00");
    await page.getByRole("button", { name: "Add shift" }).click();

    await expect(page.getByText(/finish time must be after the start time/i)).toBeVisible();
    expect(calls.set).toHaveLength(0);
  });

  test("a shift can be removed", async ({ page }) => {
    const calls = freshCalls();
    await openRoster(page, calls, freshState());

    await page.getByRole("button", { name: /06:00–14:00/ }).first().click();
    await page.getByRole("button", { name: "Remove" }).click();

    await expect.poll(() => calls.del.length).toBe(1);
    expect(calls.del[0]).toMatchObject({ p_id: SHIFT_1 });
  });

  test("copying last week says what it skipped, not just what it copied", async ({ page }) => {
    const calls = freshCalls();
    const state = freshState();
    await openRoster(page, calls, state);

    await page.getByRole("button", { name: /Copy last week/ }).click();

    await expect.poll(() => calls.copy.length).toBe(1);
    expect(calls.copy[0]?.p_to_week).toBe(state.week);
    expect(calls.copy[0]?.p_from_week).not.toBe(state.week);

    // a toast renders its text twice — visibly and in the live region
    await expect(page.getByText(/Copied 4 shifts/).first()).toBeVisible();
    await expect(page.getByText(/1 skipped/).first()).toBeVisible();
  });
});
