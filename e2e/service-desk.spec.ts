import { expect, test, type Page } from "@playwright/test";

/**
 * Service Desk is the module with real state, so it gets the integration-shaped
 * checks: a ticket raised on one surface must appear on another and survive a
 * reload — the failure mode of every store-backed feature.
 */

/** smallest valid PNG — the photo is mandatory by design, so tests need one */
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

async function raiseTicketFromPhone(page: Page, note: string) {
  await page.goto("/support/new");
  await page.getByRole("button", { name: "GF", exact: true }).click();
  await page.getByRole("button", { name: "Lobby", exact: true }).click();
  await page.getByRole("button", { name: "Spillage", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("textbox").fill(note);
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "proof.png", mimeType: "image/png", buffer: PIXEL_PNG });
  await expect(page.getByText("No photos yet")).toBeHidden();
  await page.getByRole("button", { name: "Submit ticket" }).click();
  await expect(page.getByRole("heading", { name: "Ticket created" })).toBeVisible();
  return page.locator("main").getByText(/^SD-[A-Z0-9-]+$/).first().innerText();
}

/**
 * The queue renders twice — a desktop table and mobile cards — with one hidden
 * by CSS at any breakpoint. `.first()` therefore often lands on the hidden
 * copy, so every queue assertion filters to the visible one.
 */
const visibleText = (page: Page, text: string | RegExp) =>
  page.getByText(text).filter({ visible: true }).first();

test.describe("service desk", () => {
  test("a phone ticket reaches the desk queue and survives a reload", async ({ page }) => {
    const note = `E2E lobby spill ${Date.now().toString(36)}`;
    const ref = await raiseTicketFromPhone(page, note);

    await page.goto("/service-desk");
    await expect(visibleText(page, ref)).toBeVisible();

    await page.reload();
    await expect(visibleText(page, ref)).toBeVisible();
  });

  test("a ticket cannot be lodged without the proof photo", async ({ page }) => {
    await page.goto("/support/new");
    await page.getByRole("button", { name: "GF", exact: true }).click();
    await page.getByRole("button", { name: "Lobby", exact: true }).click();
    await page.getByRole("button", { name: "Spillage", exact: true }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Submit ticket" }).click();

    await expect(visibleText(page, /Add at least one photo/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ticket created" })).toBeHidden();
  });

  test("the desk search narrows the queue and admits when nothing matches", async ({ page }) => {
    const note = `E2E searchable ${Date.now().toString(36)}`;
    await raiseTicketFromPhone(page, note);

    await page.goto("/service-desk");
    const search = page.getByPlaceholder(/Search area, ticket, category or reporter/i);

    await search.fill("Lobby");
    await expect(visibleText(page, /Lobby/)).toBeVisible();

    await search.fill("zzzz-no-such-ticket");
    await expect(visibleText(page, /no tickets|nothing|no results/i)).toBeVisible();
  });
});
