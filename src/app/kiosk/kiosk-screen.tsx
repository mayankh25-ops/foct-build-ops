"use client";

import * as React from "react";
import { Camera, CheckCircle2, Delete, Info, LogIn, LogOut, Search } from "lucide-react";
import { KioskButton } from "@/components/ui/kiosk-button";
import { LiveClock } from "@/components/ui/live-clock";
import { staffDirectory, useAttendanceReady, useAttendanceStore } from "@/lib/attendance-store";
import { cn } from "@/lib/cn";

const PIN_LENGTH = 4;

type Phase = "idle" | "camera" | "done";

/**
 * Kiosk sign-in flow (owner direction 2026-07-18): find your name →
 * enter your PIN → 3-2-1 selfie → recorded. The selfie attaches to the
 * attendance event (timesheet proof); if the device has no camera or
 * permission is denied the sign-in still records, just without a photo.
 * Note for the permanent iPad: camera access needs the app served over
 * HTTPS (or localhost) — see docs/PROJECT_STATE handover.
 */

function CameraStep({
  firstName,
  kind,
  onDone,
}: {
  firstName: string;
  kind: "in" | "out";
  onDone: (selfie?: string) => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const doneRef = React.useRef(false);
  const [count, setCount] = React.useState<number | null>(null);
  const [failed, setFailed] = React.useState(false);

  const finish = React.useCallback(
    (selfie?: string) => {
      if (doneRef.current) return;
      doneRef.current = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      onDone(selfie);
    },
    [onDone]
  );

  React.useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    if (!navigator.mediaDevices?.getUserMedia) {
      setFailed(true);
      timers.push(setTimeout(() => finish(undefined), 1600));
      return () => timers.forEach(clearTimeout);
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 640 } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
        // 3 … 2 … 1 … capture
        [3, 2, 1].forEach((n, i) => timers.push(setTimeout(() => setCount(n), 400 + i * 900)));
        timers.push(
          setTimeout(() => {
            const video = videoRef.current;
            if (!video || video.videoWidth === 0) {
              finish(undefined);
              return;
            }
            const w = 320;
            const h = Math.round((video.videoHeight / video.videoWidth) * w);
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            canvas.getContext("2d")?.drawImage(video, 0, 0, w, h);
            finish(canvas.toDataURL("image/jpeg", 0.65));
          }, 400 + 3 * 900)
        );
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        timers.push(setTimeout(() => finish(undefined), 1600));
      });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [finish]);

  return (
    <div className="flex w-full max-w-xl flex-col items-center text-center">
      <h1 className="font-display text-title-1 text-fg">
        {kind === "in" ? "Checking in" : "Checking out"}, {firstName} — look at the camera
      </h1>
      <div className="relative mt-8 aspect-[4/3] w-full max-w-md overflow-hidden rounded-card border border-edge bg-canvas shadow-raised">
        {failed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8">
            <Camera aria-hidden className="size-8 text-fg-muted" />
            <p className="text-body text-fg-secondary">
              Camera unavailable — your sign-{kind} is recorded without a photo.
            </p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              muted
              playsInline
              className="absolute inset-0 size-full -scale-x-100 object-cover"
            />
            {count !== null && (
              <span
                aria-live="assertive"
                className="absolute inset-0 flex items-center justify-center font-numeric text-[7rem] font-bold text-on-accent [text-shadow:0_2px_16px_rgb(0_0_0/0.55)]"
              >
                {count}
              </span>
            )}
          </>
        )}
      </div>
      <button
        type="button"
        onClick={() => finish(undefined)}
        className="mt-6 text-body-sm font-medium text-fg-muted transition-colors hover:text-fg"
      >
        Skip photo
      </button>
    </div>
  );
}

export function KioskScreen() {
  useAttendanceReady(); // rehydrate + seed the attendance store
  const checkInAction = useAttendanceStore((s) => s.checkIn);
  const checkOutAction = useAttendanceStore((s) => s.checkOut);
  const attachSelfie = useAttendanceStore((s) => s.attachSelfie);

  const [query, setQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [pin, setPin] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [action, setAction] = React.useState<"in" | "out">("in");
  const [stamp, setStamp] = React.useState("");
  const [notice, setNotice] = React.useState<string | null>(null);
  const [doneName, setDoneName] = React.useState<string | undefined>();
  const [doneStaffId, setDoneStaffId] = React.useState<string | null>(null);
  const [selfie, setSelfie] = React.useState<string | undefined>();

  const selected = staffDirectory.find((m) => m.id === selectedId);
  const matches =
    query.trim().length >= 2
      ? staffDirectory
          .filter((m) => m.name.toLowerCase().includes(query.trim().toLowerCase()))
          .slice(0, 6)
      : [];
  const name = selected?.name ?? staffDirectory.find((m) => m.pin === pin)?.name;
  const ready = pin.length === PIN_LENGTH;

  const press = (d: string) => {
    setNotice(null);
    setPin((p) => (p.length < PIN_LENGTH ? p + d : p));
  };

  const complete = (a: "in" | "out") => {
    // name was selected — the PIN must belong to that person
    const byPin = staffDirectory.find((m) => m.pin === pin);
    if (selected && byPin && byPin.id !== selected.id) {
      setNotice(`That PIN doesn't match ${selected.name} — check and try again.`);
      setPin("");
      return;
    }
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
    setDoneStaffId(result.staff?.id ?? null);
    setAction(a);
    setStamp(
      new Date().toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false })
    );
    setSelfie(undefined);
    setPhase("camera");
  };

  const onSelfie = (dataUrl?: string) => {
    if (dataUrl && doneStaffId) {
      attachSelfie(doneStaffId, action, dataUrl);
      setSelfie(dataUrl);
    }
    setPhase("done");
  };

  const reset = () => {
    setPin("");
    setQuery("");
    setSelectedId(null);
    setNotice(null);
    setSelfie(undefined);
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
        {phase === "camera" ? (
          <CameraStep firstName={doneName?.split(" ")[0] ?? ""} kind={action} onDone={onSelfie} />
        ) : phase === "done" ? (
          /* ------------------------------------------------ success */
          <div className="flex w-full max-w-xl flex-col items-center text-center">
            {selfie ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selfie}
                alt="Sign-in photo"
                className="size-28 rounded-card border-2 border-success object-cover"
              />
            ) : (
              <span className="flex size-24 items-center justify-center rounded-pill bg-success-subtle">
                <CheckCircle2 aria-hidden className="size-12 text-success-text" />
              </span>
            )}
            <h1 className="mt-8 font-display text-display text-fg">
              {action === "in" ? "You’re checked in" : "You’re checked out"}
              {doneName && `, ${doneName.split(" ")[0]}`}
            </h1>
            <p className="mt-3 text-title-3 font-normal text-fg-secondary">
              {action === "in"
                ? `Recorded at ${stamp}${selfie ? " with photo" : ""} · your supervisor can see you’re on site.`
                : `Recorded at ${stamp}${selfie ? " with photo" : ""} · your hours go to this week’s timesheet.`}
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

            {/* find name + pin + actions */}
            <div className="w-full max-w-md">
              <div className="rounded-card border border-edge bg-surface p-8 shadow-raised">
                <p
                  aria-live="polite"
                  className="text-center font-display text-title-2 text-fg"
                >
                  {name ? `Welcome, ${name.split(" ")[0]}` : "Find your name or enter your PIN"}
                </p>
                {notice && (
                  <p
                    aria-live="assertive"
                    className="mt-3 rounded-sm bg-warning-subtle px-3 py-2 text-center text-body-sm text-warning-text"
                  >
                    {notice}
                  </p>
                )}

                <div className="relative mt-5">
                  <Search
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-fg-muted"
                  />
                  <input
                    aria-label="Find your name"
                    placeholder="Find your name…"
                    value={selected ? selected.name : query}
                    onChange={(e) => {
                      setSelectedId(null);
                      setQuery(e.target.value);
                      setNotice(null);
                    }}
                    className="h-12 w-full rounded-control border border-edge-strong bg-surface pl-10 text-body text-fg placeholder:text-fg-disabled"
                  />
                </div>
                {!selected && matches.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {matches.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(m.id);
                          setQuery("");
                          setPin("");
                          setNotice(null);
                        }}
                        className="rounded-pill border border-edge bg-canvas px-3.5 py-2 text-body-sm font-medium text-fg transition-colors hover:bg-accent-subtle"
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                )}
                {selected && (
                  <p className="mt-2 text-center text-caption text-fg-muted">
                    Not you?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(null);
                        setPin("");
                      }}
                      className="font-medium text-accent-text"
                    >
                      Clear
                    </button>
                  </p>
                )}

                <div aria-label="PIN entry" className="mt-5 flex items-center justify-center gap-4">
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

                <div className="mt-5 grid grid-cols-3 gap-3">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => press(d)}
                      className={cn(
                        "h-14 rounded-card bg-hover font-mono text-title-2 text-fg",
                        "transition-all duration-100 hover:bg-accent-subtle active:scale-[0.97]"
                      )}
                    >
                      {d}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPin("")}
                    className="h-14 rounded-card text-body font-medium text-fg-muted transition-colors hover:bg-hover"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => press("0")}
                    className={cn(
                      "h-14 rounded-card bg-hover font-mono text-title-2 text-fg",
                      "transition-all duration-100 hover:bg-accent-subtle active:scale-[0.97]"
                    )}
                  >
                    0
                  </button>
                  <button
                    type="button"
                    aria-label="Delete last digit"
                    onClick={() => setPin((p) => p.slice(0, -1))}
                    className="flex h-14 items-center justify-center rounded-card text-fg-muted transition-colors hover:bg-hover"
                  >
                    <Delete aria-hidden className="size-6" />
                  </button>
                </div>

                <div className="mt-6 flex flex-col gap-3">
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
                <p className="mt-4 text-center text-caption text-fg-muted">
                  A quick photo is taken at sign-in and sign-out.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
