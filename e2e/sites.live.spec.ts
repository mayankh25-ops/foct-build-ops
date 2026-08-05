import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * Adding a site, and what the app does before you have one — in a real browser.
 *
 * These two specs pin the failure the owner actually hit. There was no way to
 * add a building without pasting SQL, and with no building the Cleaners, Kiosk
 * tablets and Notices screens returned early from their effects WITHOUT
 * clearing the loading flag, so all three sat on a spinner forever with no
 * error anywhere. "Add new sites" and "the modules don't work" were one bug.
 *
 * The assertions are therefore about what somebody SEES: a form instead of a
 * filename, and a way forward instead of a spinner.
 */

interface Rpc {
  siteCreate: { name: string; timezone: string }[];
  profileCalls: number;
}

/**
 * @param buildings what current_profile() reports. `[]` is the state that used
 *   to hang every screen; a site appears once site_create has been called.
 */
async function mockApi(page: Page, rpc: Rpc, opts: { startEmpty?: boolean; createError?: string } = {}) {
  let hasSite = !opts.startEmpty;

  await page.route("**/auth/v1/**", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "u1", email: "priya@foct.demo" }),
    })
  );

  // ORDER MATTERS: Playwright gives precedence to the LAST matching route, so
  // the catch-all goes FIRST and the specific handlers after it. Registered the
  // other way round it silently swallows every RPC — which is exactly what it
  // did on the first run of this spec.
  await page.route("**/rest/v1/**", (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  // the Sites list itself is a plain table read, not an RPC
  await page.route("**/rest/v1/buildings**", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        hasSite
          ? [
              {
                id: "b1",
                name: "Aurora on Collins",
                slug: "aurora-on-collins",
                address: "380 Collins Street",
                timezone: "Australia/Melbourne",
                default_language: "en",
              },
            ]
          : []
      ),
    })
  );

  await page.route("**/rest/v1/rpc/*", async (route: Route) => {
    const name = route.request().url().split("/rpc/")[1]!.split("?")[0];
    const json = (data: unknown) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });

    if (name === "current_profile") {
      rpc.profileCalls++;
      return json({
        user: { id: "u1", name: "Priya Sharma", email: "priya@foct.demo" },
        memberships: [{ org_id: "o1", org_name: "FOCT Cleaning", role: "manager" }],
        buildings: hasSite
          ? [{ id: "b1", name: "Aurora on Collins", slug: "aurora-on-collins" }]
          : [],
      });
    }
    if (name === "site_create") {
      const body = (route.request().postDataJSON() ?? {}) as Record<string, string>;
      rpc.siteCreate.push({ name: body.p_name ?? "", timezone: body.p_timezone ?? "" });
      if (opts.createError) return json({ ok: false, error: opts.createError });
      hasSite = true; // the next current_profile sees it, as the real one would
      return json({ ok: true, building_id: "b1", slug: "aurora-on-collins" });
    }
    if (name === "alert_settings_get") return json({ ok: true, settings: {} });
    if (name === "app_health")
      return json({
        ok: true,
        signed_in: true,
        missing_tables: [],
        missing_functions: [],
        missing_columns: [],
        counts: { organisations: 1, buildings: hasSite ? 1 : 0, staff: 0, kiosks: 0, people: 1 },
        remedy: "none",
      });
    return json({ ok: true });
  });

  await page.addInitScript(() => {
    window.localStorage.setItem(
      "sb-e2e-kiosk-auth-token",
      JSON.stringify({
        access_token: "e2e-access-token",
        refresh_token: "e2e-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: "u1", email: "priya@foct.demo" },
      })
    );
  });
}

test.describe("adding a site", () => {
  test("offers a form, not a SQL file to paste", async ({ page }) => {
    const rpc: Rpc = { siteCreate: [], profileCalls: 0 };
    await mockApi(page, rpc, { startEmpty: true });
    await page.goto("/settings/sites");

    // the empty state has to be a way forward, not a dead end
    await expect(page.getByText("No sites yet")).toBeVisible();
    await expect(page.getByRole("button", { name: /Add your first site/ })).toBeVisible();
    // and the instruction that used to be here is gone
    await expect(page.getByText("NEW_BUILDING.sql")).toBeHidden();

    await page.getByRole("button", { name: /Add your first site/ }).click();
    await page.getByLabel("Site name").fill("Aurora on Collins");
    await page.getByRole("button", { name: "Add site", exact: true }).click();

    await expect
      .poll(() => rpc.siteCreate.length, { message: "site_create was never called" })
      .toBe(1);
    expect(rpc.siteCreate[0]!.name).toBe("Aurora on Collins");
    // the timezone is sent, because every roster day is read in it
    expect(rpc.siteCreate[0]!.timezone).toBe("Australia/Melbourne");
  });

  test("keeps a rejection in the form, where the field is", async ({ page }) => {
    const rpc: Rpc = { siteCreate: [], profileCalls: 0 };
    await mockApi(page, rpc, {
      startEmpty: true,
      createError: "You need to be a manager or an admin to add a site.",
    });
    await page.goto("/settings/sites");

    await page.getByRole("button", { name: /Add your first site/ }).click();
    await page.getByLabel("Site name").fill("Regent Place");
    await page.getByRole("button", { name: "Add site", exact: true }).click();

    // a toast would be gone before it was read, and the modal would have shut
    await expect(page.getByText(/You need to be a manager or an admin/)).toBeVisible();
    await expect(page.getByLabel("Site name")).toHaveValue("Regent Place");
  });
});

test.describe("before there is a site", () => {
  test("Cleaners says what to do instead of loading forever", async ({ page }) => {
    const rpc: Rpc = { siteCreate: [], profileCalls: 0 };
    await mockApi(page, rpc, { startEmpty: true });
    await page.goto("/settings/staff");

    // THE BUG: this used to read "Loading cleaners…" indefinitely
    await expect(page.getByText("Add a site first")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Loading cleaners…")).toBeHidden();
    await expect(page.getByRole("link", { name: /Add a site/ })).toBeVisible();
  });

  test("Roster shows the same thing rather than someone else's demo data", async ({ page }) => {
    const rpc: Rpc = { siteCreate: [], profileCalls: 0 };
    await mockApi(page, rpc, { startEmpty: true });
    await page.goto("/roster");

    await expect(page.getByText("Add a site first")).toBeVisible({ timeout: 15_000 });
    // Marcus Chen is seed data. Showing him to somebody with no site reads as
    // "here are your cleaners", which is worse than showing nothing.
    await expect(page.getByText("Marcus Chen")).toBeHidden();
  });
});
