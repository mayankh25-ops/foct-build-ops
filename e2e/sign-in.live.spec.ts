import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * The front door, in a real browser.
 *
 * This is the journey that was broken: an account existed, the password was
 * right, and the product still showed demo data — because nothing turned the
 * account into access. These specs pin the two halves of the fix: a link can be
 * requested without a password at all, and the callback calls `claim_access()`
 * and SAYS SO when the answer is "you're in, but you have no site yet".
 */

interface Calls {
  /** the full request URL — supabase-js puts emailRedirectTo in ?redirect_to=,
   *  not in the body, which is where the first version of this spec looked */
  otp: { url: string; email: string }[];
  claims: number;
}

async function mockAuth(
  page: Page,
  calls: Calls,
  opts: { hasAccess?: boolean; otpError?: string } = {}
) {
  // ONE handler for the whole auth surface, branching inside: Playwright gives
  // precedence to the LAST matching route, so a general pattern registered
  // after a specific one silently swallows it (which it did, first time).
  await page.route("**/auth/v1/**", async (route: Route) => {
    const url = route.request().url();
    if (url.includes("/otp")) {
      const body = (route.request().postDataJSON() ?? {}) as { email?: string };
      calls.otp.push({ url, email: body.email ?? "" });
      if (opts.otpError) {
        return route.fulfill({
          status: 429,
          contentType: "application/json",
          body: JSON.stringify({
            error: "over_email_send_rate_limit",
            error_description: opts.otpError,
            msg: opts.otpError,
            message: opts.otpError,
          }),
        });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "u1", email: "owner@example.com" }),
    });
  });

  await page.route("**/rest/v1/rpc/*", (route: Route) => {
    const name = route.request().url().split("/rpc/")[1]!.split("?")[0];
    const json = (data: unknown) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
    if (name === "claim_access") {
      calls.claims++;
      return json({ ok: true, claimed: 0, bootstrapped: false, has_access: opts.hasAccess ?? true });
    }
    return json({ ok: true });
  });
}

/** A session in storage, the way supabase-js keeps one. */
async function withSession(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "sb-e2e-kiosk-auth-token",
      JSON.stringify({
        access_token: "e2e-access-token",
        refresh_token: "e2e-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: "u1", email: "owner@example.com" },
      })
    );
  });
}

test.describe("sign in", () => {
  test("asks for an email and nothing else — no password to set or forget", async ({ page }) => {
    const calls: Calls = { otp: [], claims: 0 };
    await mockAuth(page, calls);
    await page.goto("/sign-in");

    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeHidden();

    // and it refuses to send until the address could actually be one
    await expect(page.getByRole("button", { name: /Email me a sign-in link/ })).toBeDisabled();
    await page.getByLabel("Email").fill("owner@example.com");
    await expect(page.getByRole("button", { name: /Email me a sign-in link/ })).toBeEnabled();
  });

  test("sends the link back to this app's callback, not to localhost", async ({ page }) => {
    const calls: Calls = { otp: [], claims: 0 };
    await mockAuth(page, calls);
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("owner@example.com");
    await page.getByRole("button", { name: /Email me a sign-in link/ }).click();

    await expect(page.getByText(/Check owner@example.com/)).toBeVisible();
    await expect.poll(() => calls.otp.length).toBe(1);
    expect(calls.otp[0]?.email).toBe("owner@example.com");
    const redirect = new URL(calls.otp[0]!.url).searchParams.get("redirect_to");
    expect(redirect, "the emailed link must come back to THIS deployment").toMatch(
      /\/auth\/callback$/
    );
  });

  test("a throttled project explains the limit instead of showing a raw error", async ({
    page,
  }) => {
    const calls: Calls = { otp: [], claims: 0 };
    await mockAuth(page, calls, { otpError: "email rate limit exceeded" });
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("owner@example.com");
    await page.getByRole("button", { name: /Email me a sign-in link/ }).click();

    await expect(page.getByText(/per hour/)).toBeVisible();
  });

  test("a password is still available for anyone who wants one", async ({ page }) => {
    const calls: Calls = { otp: [], claims: 0 };
    await mockAuth(page, calls);
    await page.goto("/sign-in");
    await page.getByRole("button", { name: "Use a password instead" }).click();

    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Sign in$/ })).toBeVisible();
  });

  test("the callback claims access and moves you into the product", async ({ page }) => {
    const calls: Calls = { otp: [], claims: 0 };
    await withSession(page);
    await mockAuth(page, calls, { hasAccess: true });
    await page.goto("/auth/callback?next=/dashboard");

    await expect.poll(() => calls.claims).toBeGreaterThan(0);
    await page.waitForURL(/\/dashboard/);
  });

  test("signed in with no site SAYS so, instead of showing an empty product", async ({ page }) => {
    // the exact state that used to look like a broken deployment
    const calls: Calls = { otp: [], claims: 0 };
    await withSession(page);
    await mockAuth(page, calls, { hasAccess: false });
    await page.goto("/auth/callback");

    await expect(page.getByRole("heading", { name: "Signed in — no site yet" })).toBeVisible();
    await expect(page.getByText(/Settings → People/)).toBeVisible();
  });

  test("an expired link is named as expired, not as a mystery", async ({ page }) => {
    const calls: Calls = { otp: [], claims: 0 };
    await mockAuth(page, calls);
    await page.goto("/auth/callback?error=access_denied&error_description=Email+link+is+invalid+or+has+expired");

    await expect(page.getByText(/expired or was already used/)).toBeVisible();
  });
});
