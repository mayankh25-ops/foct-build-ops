"use client";

/**
 * Sign in (0015). A link in your inbox by default; a password if you want one.
 *
 * The old screen asked for a password that, on a new project, nobody had set —
 * and even when it worked you landed in a product showing demo data, because
 * the account had no organisation behind it. Both of those are fixed: the link
 * needs no password, and `claim_access()` (called on the callback) turns the
 * account into access.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { sendMagicLink, signInWithPassword } from "@/lib/auth-live";
import { enterDemoMode, exitDemoMode } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/supabase";
import { building } from "@/lib/demo-data";

export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = React.useState<"link" | "password">("link");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [state, setState] = React.useState<"idle" | "busy" | "sent" | "error">("idle");
  const [message, setMessage] = React.useState("");

  const emailLooksReal = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email.trim());

  // being on this page means signing in for real: drop any demo opt-in the
  // tab is carrying, so the session resolves properly after the link lands
  React.useEffect(() => {
    exitDemoMode();
  }, []);

  const send = async () => {
    setState("busy");
    const res = await sendMagicLink(email);
    if (!res.ok) {
      setState("error");
      setMessage(res.error ?? "Could not send the link.");
      return;
    }
    setState("sent");
    setMessage(
      `Check ${email.trim()} — the link signs you in and lasts an hour. It can take a minute to arrive; look in spam if it doesn't.`
    );
  };

  const withPassword = async () => {
    setState("busy");
    const res = await signInWithPassword(email, password);
    if (!res.ok) {
      setState("error");
      setMessage(res.error ?? "Could not sign in.");
      return;
    }
    // claim_access() runs in the callback route, so both paths land the same way
    router.replace("/auth/callback?next=/dashboard");
  };

  return (
    <div
      data-theme="option-nature"
      className="flex min-h-screen items-center justify-center bg-canvas p-6 text-fg"
    >
      <Card className="w-full max-w-sm">
        <CardBody className="flex flex-col gap-4">
          <div>
            <p className="text-caption font-medium tracking-[0.08em] text-fg-muted uppercase">
              FOCT BuildingOps
            </p>
            <h1 className="mt-1 font-display text-title-1 text-fg">Sign in</h1>
            <p className="mt-1 text-body-sm text-fg-muted">{building.name}</p>
          </div>

          {!isSupabaseConfigured && (
            <p className="rounded-card bg-warning-subtle px-4 py-3 text-body-sm text-warning-text">
              This deployment has no database configured, so only the demo is available.
            </p>
          )}

          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (state !== "busy") setState("idle");
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              if (mode === "link" && emailLooksReal) void send();
            }}
            placeholder="you@yourcompany.com"
          />

          {mode === "password" && (
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void withPassword()}
            />
          )}

          {message && (
            <p
              className={
                state === "error"
                  ? "text-body-sm text-critical-text"
                  : "text-body-sm text-success-text"
              }
            >
              {message}
            </p>
          )}

          {mode === "link" ? (
            <Button
              loading={state === "busy"}
              disabled={!emailLooksReal || state === "sent"}
              onClick={() => void send()}
            >
              <Mail aria-hidden className="size-4" />
              {state === "sent" ? "Link sent" : "Email me a sign-in link"}
            </Button>
          ) : (
            <Button loading={state === "busy"} onClick={() => void withPassword()}>
              <KeyRound aria-hidden className="size-4" />
              Sign in
            </Button>
          )}

          {/* The switch between the only two ways in. It was caption-sized
              muted text, which read as a footnote -- somebody who ended up on
              the password form could not find the way back to the link. */}
          <Button
            variant="secondary"
            onClick={() => {
              setMode((m) => (m === "link" ? "password" : "link"));
              setState("idle");
              setMessage("");
            }}
          >
            {mode === "link" ? (
              <>
                <KeyRound aria-hidden className="size-4" />
                Use a password instead
              </>
            ) : (
              <>
                <Mail aria-hidden className="size-4" />
                Email me a link instead
              </>
            )}
          </Button>

          <button
            type="button"
            onClick={() => {
              enterDemoMode();
              router.push("/dashboard");
            }}
            className="text-center text-body-sm text-fg-secondary underline underline-offset-2 hover:text-fg"
          >
            Continue to the demo without signing in
          </button>
        </CardBody>
      </Card>
    </div>
  );
}
