"use client";

import * as React from "react";
import { CheckCircle2, Delete, Info, LogIn, LogOut } from "lucide-react";
import { KioskButton } from "@/components/ui/kiosk-button";
import { cn } from "@/lib/cn";

const PIN_LENGTH = 4;
/** Demo staff directory — replaced by real lookup in Stage 2. */
const staff: Record<string, string> = {
  "1234": "Marcus Chen",
  "2345": "Leila Haddad",
  "3456": "Sofia Marino",
};

function useClock() {
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

type Phase = "idle" | "done";

export function KioskScreen() {
  const now = useClock();
  const [pin, setPin] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [action, setAction] = React.useState<"in" | "out">("in");

  const time = now
    ? now.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false })
    : "--:--";
  const date = now
    ? now.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })
    : "";

  const name = staff[pin] ?? "there";
  const ready = pin.length === PIN_LENGTH;

  const press = (d: string) => setPin((p) => (p.length < PIN_LENGTH ? p + d : p));
  const complete = (a: "in" | "out") => {
    setAction(a);
    setPhase("done");
  };
  const reset = () => {
    setPin("");
    setPhase("idle");
  };

  // auto-return to idle after a successful check-in
  React.useEffect(() => {
    if (phase !== "done") return;
    const t = setTimeout(reset, 8000);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <div
      data-theme="ink"
      className="flex min-h-screen flex-col bg-canvas text-fg selection:bg-accent-subtle"
    >
      {/* top strip */}
      <header className="flex items-center justify-between px-10 py-8">
        <div className="flex items-center gap-3.5">
          <span
            aria-hidden
            className="flex size-10 items-center justify-center rounded-control bg-surface"
          >
            <span className="size-3 rounded-pill bg-brand" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-title-3 font-semibold text-fg">Aurora on Collins</p>
            <p className="text-body-sm text-fg-muted">FOCT CleaningOps kiosk</p>
          </div>
        </div>
        <p className="hidden text-body-sm text-fg-muted sm:block">
          Need help? Call your supervisor on <span className="font-mono">0491 570 156</span>
        </p>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-14">
        {phase === "done" ? (
          /* ------------------------------------------------ success */
          <div className="flex w-full max-w-xl flex-col items-center text-center">
            <span className="flex size-24 items-center justify-center rounded-pill bg-success-subtle">
              <CheckCircle2 aria-hidden className="size-12 text-success-text" />
            </span>
            <h1 className="mt-8 font-display text-display text-fg">
              {action === "in" ? "You’re checked in" : "You’re checked out"}
              {name !== "there" && `, ${name.split(" ")[0]}`}
            </h1>
            <p className="mt-3 text-title-3 font-normal text-fg-secondary">
              {action === "in"
                ? `Recorded at ${time} · your supervisor can see you’re on site.`
                : `Recorded at ${time} · your hours go to this week’s timesheet.`}
            </p>
            <KioskButton variant="secondary" className="mt-12 max-w-xs" onClick={reset}>
              Done
            </KioskButton>
          </div>
        ) : (
          /* ------------------------------------------------ idle / pin */
          <div className="flex w-full max-w-5xl flex-col items-center gap-12 lg:flex-row lg:items-stretch lg:gap-20">
            {/* clock + note */}
            <div className="flex flex-1 flex-col items-center justify-center text-center lg:items-start lg:text-left">
              <p aria-live="off" className="font-mono text-hero text-fg tabular-nums">
                {time}
              </p>
              <p className="mt-3 text-title-2 font-normal text-fg-secondary">{date}</p>

              <div className="mt-12 w-full max-w-md rounded-card border border-edge bg-surface p-6 text-left shadow-card">
                <div className="flex items-center gap-2.5">
                  <Info aria-hidden className="size-4 text-accent-text" />
                  <p className="text-body-sm font-medium text-fg">Today’s site note</p>
                </div>
                <p className="mt-2.5 text-body text-fg-secondary">
                  Buff the lobby marble before 07:00. Loading dock is closed until 06:30 —
                  use the Little Collins St entry.
                </p>
              </div>
            </div>

            {/* pin + actions */}
            <div className="flex w-full max-w-md flex-col">
              <p className="text-center text-title-3 font-medium text-fg">Enter your staff PIN</p>

              <div aria-label="PIN entry" className="mt-6 flex items-center justify-center gap-4">
                {Array.from({ length: PIN_LENGTH }, (_, i) => (
                  <span
                    key={i}
                    aria-hidden
                    className={cn(
                      "size-4 rounded-pill transition-colors duration-150",
                      i < pin.length ? "bg-accent" : "bg-hover"
                    )}
                  />
                ))}
                <span className="sr-only" aria-live="polite">
                  {pin.length} of {PIN_LENGTH} digits entered
                </span>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => press(d)}
                    className={cn(
                      "h-16 rounded-card border border-edge bg-surface font-mono text-title-2 text-fg",
                      "transition-all duration-100 hover:bg-hover active:scale-[0.97]"
                    )}
                  >
                    {d}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPin("")}
                  className="h-16 rounded-card text-body font-medium text-fg-muted transition-colors hover:bg-surface"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => press("0")}
                  className={cn(
                    "h-16 rounded-card border border-edge bg-surface font-mono text-title-2 text-fg",
                    "transition-all duration-100 hover:bg-hover active:scale-[0.97]"
                  )}
                >
                  0
                </button>
                <button
                  type="button"
                  aria-label="Delete last digit"
                  onClick={() => setPin((p) => p.slice(0, -1))}
                  className="flex h-16 items-center justify-center rounded-card text-fg-muted transition-colors hover:bg-surface"
                >
                  <Delete aria-hidden className="size-6" />
                </button>
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <KioskButton icon={LogIn} disabled={!ready} onClick={() => complete("in")}>
                  Check in
                </KioskButton>
                <KioskButton
                  icon={LogOut}
                  variant="secondary"
                  disabled={!ready}
                  onClick={() => complete("out")}
                >
                  Check out
                </KioskButton>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
