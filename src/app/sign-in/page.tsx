"use client";

/**
 * Minimal email+password sign-in (Stage 3). Live-mode reads/mutations run
 * under RLS, so they need a session; the public QR intake does not.
 * Set a password for a seed user (e.g. priya@foct.demo) in the Supabase
 * dashboard → Authentication → Users, then sign in here.
 */
import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { building } from "@/lib/demo-data";

export default function SignInPage() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [state, setState] = React.useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = React.useState("");

  const signIn = async () => {
    if (!isSupabaseConfigured) {
      setState("error");
      setMessage("Supabase env is not configured on this machine (.env.local).");
      return;
    }
    setState("busy");
    const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) {
      setState("error");
      setMessage(error.message);
    } else {
      setState("done");
      setMessage(`Signed in as ${data.user?.email}. Live Service Desk data is now available.`);
    }
  };

  return (
    <div data-theme="option-nature" className="flex min-h-screen items-center justify-center bg-canvas p-6 text-fg">
      <Card className="w-full max-w-sm">
        <CardBody className="flex flex-col gap-4">
          <div>
            <p className="text-caption font-medium tracking-[0.08em] text-fg-muted uppercase">
              FOCT BuildingOps
            </p>
            <h1 className="mt-1 font-display text-title-1 text-fg">Sign in</h1>
            <p className="mt-1 text-body-sm text-fg-muted">{building.name}</p>
          </div>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="priya@foct.demo"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void signIn()}
          />
          {message && (
            <p className={state === "error" ? "text-body-sm text-critical-text" : "text-body-sm text-success-text"}>
              {message}
            </p>
          )}
          <Button loading={state === "busy"} onClick={() => void signIn()}>
            Sign in
          </Button>
          <Link href="/dashboard" className="text-center text-caption text-fg-muted hover:underline">
            Continue to the demo without signing in
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
