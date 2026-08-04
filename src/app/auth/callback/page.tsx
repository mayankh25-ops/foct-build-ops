"use client";

/**
 * Where a sign-in lands — from an emailed link, or from the password form.
 *
 * Two jobs, and the second is the one that used to be missing:
 *   1. finish the session (a PKCE link arrives as ?code=…, an implicit one as a
 *      #access_token fragment that supabase-js consumes on load);
 *   2. call `claim_access()`, which creates the profile row, accepts any
 *      invitation waiting for this address, and — on a project nobody has
 *      signed in to yet — makes the first arrival an admin.
 *
 * Somebody with an account but no access is TOLD so here, rather than being
 * dropped into a dashboard full of demo data wondering why nothing is theirs.
 */
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Card, CardBody } from "@/components/ui/card";
import { accessMessage, claimAccess, explainAuthError } from "@/lib/auth-live";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

type Phase = "working" | "no-access" | "error";

function Callback() {
  const router = useRouter();
  const params = useSearchParams();
  const [phase, setPhase] = React.useState<Phase>("working");
  const [message, setMessage] = React.useState("Signing you in…");

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!isSupabaseConfigured) {
        router.replace("/dashboard");
        return;
      }
      const supabase = getSupabase();

      // Supabase reports a refused link in the query OR the hash, depending on
      // the flow — read both rather than showing "signing you in…" forever.
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const linkError = params.get("error_description") ?? hash.get("error_description");
      if (linkError) {
        if (cancelled) return;
        setPhase("error");
        setMessage(
          /expired|invalid/i.test(linkError)
            ? "That link has expired or was already used. Sign-in links last an hour and work once — ask for a fresh one."
            : explainAuthError(linkError)
        );
        return;
      }

      const code = params.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error && !cancelled) {
          setPhase("error");
          setMessage(explainAuthError(error.message));
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (cancelled) return;
        setPhase("error");
        setMessage("That link didn't carry a session. Ask for a fresh one and open it in this browser.");
        return;
      }

      const outcome = await claimAccess();
      if (cancelled) return;

      const note = accessMessage(outcome);
      if (note) {
        setPhase("no-access");
        setMessage(note);
        return;
      }
      router.replace(params.get("next") ?? "/dashboard");
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return (
    <div
      data-theme="option-nature"
      className="flex min-h-screen items-center justify-center bg-canvas p-6 text-fg"
    >
      <Card className="w-full max-w-md">
        <CardBody className="flex flex-col gap-4">
          <p className="text-caption font-medium tracking-[0.08em] text-fg-muted uppercase">
            FOCT BuildingOps
          </p>
          {phase === "working" ? (
            <p className="flex items-center gap-2 text-body text-fg">
              <Loader2 aria-hidden className="size-4 animate-spin" />
              {message}
            </p>
          ) : (
            <>
              <h1 className="font-display text-title-2 text-fg">
                {phase === "no-access" ? "Signed in — no site yet" : "That didn't work"}
              </h1>
              <p className="text-body-sm text-fg-secondary">{message}</p>
              <Link href="/sign-in" className="text-body-sm text-accent-text hover:underline">
                Back to sign in
              </Link>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export default function CallbackPage() {
  // useSearchParams needs a Suspense boundary in the app router
  return (
    <React.Suspense fallback={null}>
      <Callback />
    </React.Suspense>
  );
}
