import { expect, test } from "@playwright/test";

/**
 * The kiosk's physical ergonomics, asserted rather than hoped for.
 *
 * A wall tablet is used with wet hands, in gloves, without reading glasses,
 * from about 1.5 m away. So the kiosk works to 64px targets — double the 44px
 * web minimum — and the clock has to be legible across the room.
 */
test.use({ viewport: { width: 1024, height: 768 } }); // a mounted 10" tablet

const KIOSK_MIN_TOUCH = 64;

test.describe("kiosk ergonomics", () => {
  test("every control is at least 64px tall", async ({ page }) => {
    await page.goto("/kiosk");
    await expect(page.getByLabel("Find your name")).toBeVisible();

    const buttons = page.getByRole("button");
    const count = await buttons.count();
    expect(count).toBeGreaterThan(10); // keypad + actions

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      if (!(await button.isVisible())) continue;
      const box = await button.boundingBox();
      if (!box) continue;
      const label = (await button.innerText()).trim().slice(0, 20) || `control ${i}`;
      // the discreet "Unpair" text link is deliberately small: it must be hard
      // to hit by accident, and it is not part of the cleaner's flow
      if (/unpair/i.test(label)) continue;
      expect(box.height, `"${label}" is ${Math.round(box.height)}px tall`).toBeGreaterThanOrEqual(
        KIOSK_MIN_TOUCH
      );
    }
  });

  test("the clock is big enough to read across the room", async ({ page }) => {
    await page.goto("/kiosk");
    const clock = page.locator("time, [aria-live]").first();
    await expect(clock).toBeVisible();

    const size = await page
      .locator("body")
      .evaluate(() => {
        // the largest rendered font size on the idle screen — that's the clock
        return Math.max(
          ...Array.from(document.querySelectorAll("*")).map((el) =>
            parseFloat(getComputedStyle(el).fontSize)
          )
        );
      });
    expect(size, "the biggest thing on the kiosk should be the clock").toBeGreaterThanOrEqual(64);
  });

  test("nothing on the kiosk scrolls sideways", async ({ page }) => {
    await page.goto("/kiosk");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
