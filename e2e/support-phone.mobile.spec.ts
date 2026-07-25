import { expect, test } from "@playwright/test";

/**
 * The phone surface on a real phone viewport (Pixel 7). Runs in the
 * `mobile-chromium` project only.
 *
 * What breaks on a phone and nowhere else: a tap target too small to hit, a
 * layout that scrolls sideways, a fixed action bar covering the button it is
 * meant to sit beside. A cleaner holding a mop has one hand.
 */
test.describe("phone surface", () => {
  test("the field surfaces render without sideways scroll", async ({ page }) => {
    for (const route of ["/support", "/support/new", "/support/jobs"]) {
      await page.goto(route);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `${route} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(1);
    }
  });

  test("every action on the intake form is thumb-sized (44px minimum)", async ({ page }) => {
    await page.goto("/support/new");
    const buttons = page.getByRole("button");
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      if (!(await button.isVisible())) continue;
      const box = await button.boundingBox();
      if (!box) continue;
      const label = (await button.innerText()).trim().slice(0, 24) || `button ${i}`;
      expect(box.height, `"${label}" is only ${Math.round(box.height)}px tall`).toBeGreaterThanOrEqual(44);
    }
  });

  test("a cleaner can walk the intake to the point of needing a photo", async ({ page }) => {
    await page.goto("/support/new");
    await page.getByRole("button", { name: "GF", exact: true }).click();
    await page.getByRole("button", { name: "Lobby", exact: true }).click();
    await page.getByRole("button", { name: "Spillage", exact: true }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("2 / 2")).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit ticket" })).toBeVisible();
  });
});
