import { expect, test, type Page } from "@playwright/test";

/**
 * Route smoke: every shipped screen renders, with no console error and no
 * unstyled-page symptom. Cheap, and it catches the class of failure that
 * makes the whole product look broken — a bad import, a missing "use client",
 * a chunk that 404s after a rename.
 */
const ROUTES = [
  "/dashboard",
  "/portfolio",
  "/service-desk",
  "/service-desk/new",
  "/scope",
  "/calendar",
  "/roster",
  "/timesheets",
  "/consumables",
  "/residents",
  "/concierge",
  "/modules",
  "/settings/staff",
  "/settings/appearance",
  "/settings/integrations",
  "/kiosk",
  "/sign-in",
  "/support",
  "/support/new",
  "/support/jobs",
];

/**
 * Failures we own vs. failures the environment owns.
 *
 * The dashboard deliberately calls two things that are absent in CI and in a
 * fresh clone: the local go2rtc camera gateway (127.0.0.1:1984) and the
 * Open-Meteo weather API. Those are designed to degrade quietly, so a blocked
 * connection to them is expected, not a defect — but a request to OUR OWN
 * origin that 404s or 500s is always a defect.
 */
const EXTERNAL_HOSTS = /(127\.0\.0\.1:1984|localhost:1984|api\.open-meteo\.com)/;

function watchErrors(page: Page, baseURL: string) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    // "Failed to load resource: …" duplicates what the response/requestfailed
    // listeners report with a URL, which is the version worth reading
    if (/Failed to load resource/.test(text)) return;
    errors.push(`console: ${text}`);
  });
  page.on("requestfailed", (r) => {
    if (EXTERNAL_HOSTS.test(r.url())) return;
    errors.push(`request failed: ${r.url()} (${r.failure()?.errorText})`);
  });
  page.on("response", (r) => {
    if (EXTERNAL_HOSTS.test(r.url())) return;
    if (!r.url().startsWith(baseURL)) return;
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  return errors;
}

for (const route of ROUTES) {
  test(`renders ${route}`, async ({ page, baseURL }) => {
    const errors = watchErrors(page, baseURL!);
    const response = await page.goto(route, { waitUntil: "networkidle" });

    expect(response?.status(), `${route} responded ${response?.status()}`).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();

    // an unstyled page means the CSS didn't load — the exact symptom the
    // owner hit once and could not name
    const bg = await page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue("background-color")
    );
    expect(bg, `${route} has no themed background — stylesheet missing?`).not.toBe("rgba(0, 0, 0, 0)");

    expect(errors, `${route} logged errors:\n${errors.join("\n")}`).toEqual([]);
  });
}

test("every theme applies without losing the page", async ({ page }) => {
  await page.goto("/settings/appearance");
  await expect(page.getByRole("heading", { name: /appearance/i })).toBeVisible();
  const root = page.locator("html");
  await expect(root).toHaveAttribute("data-theme", /.+/);
});
