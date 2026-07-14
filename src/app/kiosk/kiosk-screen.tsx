"use client";

import * as React from "react";
import { CheckCircle2, Delete, Info, LogIn, LogOut } from "lucide-react";
import { KioskButton } from "@/components/ui/kiosk-button";
import { LiveClock } from "@/components/ui/live-clock";
import { staffDirectory, useAttendanceReady, useAttendanceStore } from "@/lib/attendance-store";
import { cn } from "@/lib/cn";

const PIN_LENGTH = 4;

type Phase = "idle" | "done";

export function KioskScreen() {
  useAttendanceReady(); // rehydrate + seed the attendance store
  const checkInAction = useAttendanceStore((s) => s.checkIn);
  const checkOutAction = useAttendanceStore((s) => s.checkOut);

  const [pin, setPin] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [action, setAction] = React.useState<"in" | "out">("in");
  const [stamp, setStamp] = React.useState("");
  const [notice, setNotice] = React.useState<string | null>(null);
  const [doneName, setDoneName] = React.useState<string | undefined>();

  const name = staffDirectory.find((m) => m.pin === pin)?.name;
  const ready = pin.length === PIN_LENGTH;

  const press = (d: string) => {
    setNotice(null);
    setPin((p) => (p.length < PIN_LENGTH ? p + d : p));
  };
  const complete = (a: "in" | "out") => {
    const result = a === "in" ? checkInAction(pin) : checkOutAction(pin);
    if (!result.ok) {
      setNotice("PIN not recognised — check with your supervisor.");
      setPin("");
      return;
    }
    if (a === "in" && result.already) {
      setNotice(`${result.staff!.name.split(" ")[0]}, you're already checked in — use Check out when you leave.`);
      setPin("");
      return;
    }
    if (a === "out" && result.noOpenShift) {
      setNotice(`${result.staff!.name.split(" ")[0]}, there's no open shift to check out of — use Check in first.`);
      setPin("");
      return;
    }
    setDoneName(result.staff?.name);
    setAction(a);
    setStamp(
      new Date().toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false })
    );
    setPhase("done");
  };
  const reset = () => {
    setPin("");
    setNotice(null);
    setPhase("idle");
  };

  // auto-return to idle after a successful check-in
  React.useEffect(() => {
    if (phase !== "done") return;
    const t = setTimeout(reset, 8000);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-fg">
      {/* top strip */}
      <header className="flex items-center justify-between px-10 py-7">
        <div className="flex items-center gap-3.5">
          <span
            aria-hidden
            className="flex size-10 items-center justify-center rounded-control bg-accent"
          >
            <span className="size-3 rounded-pill bg-brand" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-title-3 font-medium text-fg">Aurora on Collins</p>
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
              {doneName && `, ${doneName.split(" ")[0]}`}
            </h1>
            <p className="mt-3 text-title-3 font-normal text-fg-secondary">
              {action === "in"
                ? `Recorded at ${stamp} · your supervisor can see you’re on site.`
                : `Recorded at ${stamp} · your hours go to this week’s timesheet.`}
            </p>
            <KioskButton variant="secondary" className="mt-12 max-w-xs" onClick={reset}>
              Done
            </KioskButton>
          </div>
        ) : (
          /* ------------------------------------------------ idle / pin */
          <div className="flex w-full max-w-5xl flex-col items-center gap-12 lg:flex-row lg:items-stretch lg:gap-16">
            {/* clock + note */}
            <div className="flex flex-1 flex-col items-center justify-center text-center lg:items-start lg:text-left">
              <span className="inline-flex items-center gap-2 self-center rounded-pill bg-accent-subtle px-4 py-2 text-body-sm font-medium text-accent-text lg:self-start">
                Clock in and out with ease
              </span>
              <LiveClock variant="hero" className="mt-6" showDate />

              <div className="mt-10 w-full max-w-md rounded-card border border-edge bg-surface p-6 text-left shadow-card">
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
            <div className="w-full max-w-md">
              <div className="rounded-card border border-edge bg-surface p-8 shadow-raised">
                <p
                  aria-live="polite"
                  className="text-center font-display text-title-2 text-fg"
                >
                  {name ? `Welcome, ${name.split(" ")[0]}` : "Enter your staff PIN"}
                </p>
                {notice && (
                  <p
                    aria-live="assertive"
                    className="mt-3 rounded-sm bg-warning-subtle px-3 py-2 text-center text-body-sm text-warning-text"
                  >
                    {notice}
                  </p>
                )}

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
                        "h-16 rounded-card bg-hover font-mono text-title-2 text-fg",
                        "transition-all duration-100 hover:bg-accent-subtle active:scale-[0.97]"
                      )}
                    >
                      {d}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPin("")}
                    className="h-16 rounded-card text-body font-medium text-fg-muted transition-colors hover:bg-hover"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => press("0")}
                    className={cn(
                      "h-16 rounded-card bg-hover font-mono text-title-2 text-fg",
                      "transition-all duration-100 hover:bg-accent-subtle active:scale-[0.97]"
                    )}
                  >
                    0
                  </button>
                  <button
                    type="button"
                    aria-label="Delete last digit"
                    onClick={() => setPin((p) => p.slice(0, -1))}
                    className="flex h-16 items-center justify-center rounded-card text-fg-muted transition-colors hover:bg-hover"
                  >
                    <Delete aria-hidden className="size-6" />
                  </button>
                </div>

                <div className="mt-7 flex flex-col gap-3">
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
          </div>
        )}
      </main>
    </div>
  );
}
