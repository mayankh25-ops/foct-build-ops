import { expect, test } from "@playwright/test";

/**
 * The kiosk journey a cleaner does twice a day. If any of this breaks, the
 * building's attendance record breaks with it — and the people affected are
 * the least able to work around it.
 */
test.describe("kiosk", () => {
  test("find name → PIN → selfie → confirmation", async ({ page }) => {
    await page.goto("/kiosk");

    await page.getByLabel("Find your name").fill("Leila");
    await page.getByRole("button", { name: "Leila Haddad" }).click();
    await expect(page.getByText("Welcome, Leila")).toBeVisible();

    for (const digit of ["2", "3", "4", "5"]) {
      await page.getByRole("button", { name: digit, exact: true }).click();
      await expect(page.getByText(`${["2", "3", "4", "5"].indexOf(digit) + 1} of 4 digits entered`)).toBeVisible();
    }

    // seeded Leila is already on the clock, so the honest action is check-out
    await page.getByRole("button", { name: /Check out/ }).click();

    // 3-2-1 countdown, then the photo
    await expect(page.getByRole("heading", { name: /look at the camera/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /You’re checked out/ })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("a wrong PIN is refused without saying whose it is", async ({ page }) => {
    await page.goto("/kiosk");
    for (const digit of ["9", "9", "9", "9"]) {
      await page.getByRole("button", { name: digit, exact: true }).click();
    }
    await page.getByRole("button", { name: /Check in/ }).click();

    const notice = page.locator('[aria-live="assertive"]').first();
    await expect(notice).toContainText(/not recognised/i);
    await expect(notice).not.toContainText(/Marcus|Leila|Sofia/);
  });

  test("a PIN that belongs to someone else is rejected for the selected name", async ({ page }) => {
    await page.goto("/kiosk");
    await page.getByLabel("Find your name").fill("Marcus");
    await page.getByRole("button", { name: "Marcus Chen" }).click();
    for (const digit of ["2", "3", "4", "5"]) {
      await page.getByRole("button", { name: digit, exact: true }).click();
    }
    await page.getByRole("button", { name: /Check in/ }).click();
    await expect(page.locator('[aria-live="assertive"]').first()).toContainText(/doesn't match/i);
  });

  test("double check-in is blocked with a human explanation", async ({ page }) => {
    await page.goto("/kiosk");
    for (const digit of ["2", "3", "4", "5"]) {
      await page.getByRole("button", { name: digit, exact: true }).click();
    }
    await page.getByRole("button", { name: /Check in/ }).click();
    await expect(page.locator('[aria-live="assertive"]').first()).toContainText(
      /already checked in/i
    );
  });
});
