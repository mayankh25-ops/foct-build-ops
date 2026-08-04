/**
 * What sign-in SAYS when it goes wrong, and what it says to somebody who got in
 * but has no site yet.
 *
 * Every string here was written because the raw version cost real time: "Invalid
 * login credentials" for an account that never had a password, and a silent
 * dashboard full of demo data for an account with no organisation behind it.
 */
import { describe, expect, it } from "vitest";
import { accessMessage, explainAuthError } from "@/lib/auth-live";
import { inviteAge, type OrgInvite } from "@/lib/people-live";

describe("explainAuthError", () => {
  it("separates a CONFIGURATION fault from a wrong password — they look alike and are opposites", () => {
    expect(explainAuthError("Invalid API key")).toMatch(/Configuration problem, not your password/);
    expect(explainAuthError("Invalid login credentials")).toMatch(/don't match an account/);
  });

  it("points a password failure at the link, which works without one", () => {
    // the actual cause on a fresh project: the account exists, no password was
    // ever set, and nothing on screen said so
    expect(explainAuthError("Invalid login credentials")).toMatch(/emailed link/);
  });

  it("explains an unconfirmed account instead of repeating the error", () => {
    expect(explainAuthError("Email not confirmed")).toMatch(/opening it confirms the address/);
  });

  it("names the real limit when Supabase throttles the emails", () => {
    expect(explainAuthError("email rate limit exceeded")).toMatch(/per hour/);
  });

  it("says what to do when sign-ups are disabled", () => {
    expect(explainAuthError("Signups not allowed for otp")).toMatch(/ask an admin to invite you/i);
  });

  it("passes an unknown error through rather than inventing a diagnosis", () => {
    expect(explainAuthError("Something unheard of")).toBe("Something unheard of");
  });
});

describe("accessMessage", () => {
  it("says nothing when access is fine", () => {
    expect(accessMessage({ ok: true, has_access: true })).toBeNull();
  });

  it("explains the signed-in-but-no-site state instead of showing an empty product", () => {
    expect(accessMessage({ ok: true, has_access: false })).toMatch(/Settings → People/);
  });

  it("stays quiet when the claim itself failed — the caller reports that", () => {
    expect(accessMessage({ ok: false, error: "boom" })).toBeNull();
  });
});

describe("inviteAge", () => {
  const invite = (over: Partial<OrgInvite> = {}): OrgInvite => ({
    id: "i1",
    email: "a@b.com",
    role: "manager",
    role_name: "Manager",
    created_at: "2026-08-01T00:00:00Z",
    expires_at: "2026-08-15T00:00:00Z",
    expired: false,
    ...over,
  });

  it("counts down in days", () => {
    expect(inviteAge(invite(), new Date("2026-08-04T00:00:00Z"))).toBe("expires in 11 days");
    expect(inviteAge(invite(), new Date("2026-08-14T00:00:00Z"))).toBe("expires in 1 day");
  });

  it("says 'today' rather than 'in 0 days'", () => {
    expect(inviteAge(invite(), new Date("2026-08-15T00:00:00Z"))).toBe("expires today");
  });

  it("tells you what to DO about an expired one", () => {
    expect(inviteAge(invite({ expired: true }))).toMatch(/invite again/);
  });
});
