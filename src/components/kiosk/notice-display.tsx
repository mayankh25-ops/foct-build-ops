"use client";

/**
 * Notices on the tablet, in every language they were written in.
 *
 * A notice a cleaner cannot read is not a notice, so each one CYCLES through
 * its languages — about six seconds each — with a small chip saying which is
 * on screen, so nobody thinks the tablet is glitching. Sites default to their
 * own language first (Settings → Sites).
 *
 * Two placements:
 *   <NoticeTicker>  idle screen — general notices only, always moving
 *   <NoticeList>    after sign-in — general + personal, with acknowledgement
 */
import * as React from "react";
import { AlertTriangle, Check, Info } from "lucide-react";
import { cn } from "@/lib/cn";

export interface DisplayNotice {
  id: string;
  title?: Record<string, string>;
  body: Record<string, string>;
  priority: "info" | "important" | "urgent";
  personal?: boolean;
  requires_ack?: boolean;
  acked?: boolean;
}

const CHIPS: Record<string, string> = {
  en: "EN",
  hi: "हिं",
  pa: "ਪੰ",
  ne: "ने",
  zh: "中",
};

const CYCLE_MS = 6000;

/** Languages this notice actually has, the site's own first. */
export function languagesOf(n: DisplayNotice, preferred: string): string[] {
  const codes = Object.keys(n.body).filter((c) => (n.body[c] ?? "").trim().length > 0);
  return codes.sort((a, b) => {
    if (a === preferred) return -1;
    if (b === preferred) return 1;
    return a.localeCompare(b);
  });
}

/** One notice, cycling its own languages on its own timer. */
function CyclingText({
  notice,
  preferred,
  className,
}: {
  notice: DisplayNotice;
  preferred: string;
  className?: string;
}) {
  const langs = React.useMemo(() => languagesOf(notice, preferred), [notice, preferred]);
  const [i, setI] = React.useState(0);

  React.useEffect(() => {
    if (langs.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % langs.length), CYCLE_MS);
    return () => clearInterval(t);
  }, [langs.length]);

  const code = langs[i % langs.length] ?? preferred;
  const title = notice.title?.[code];

  return (
    <div className={className}>
      <div className="flex items-start gap-3">
        {langs.length > 1 && (
          <span
            aria-hidden
            className="mt-0.5 shrink-0 rounded-pill bg-hover px-2.5 py-1 text-caption font-medium text-fg-muted"
          >
            {CHIPS[code] ?? code.toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          {title && <p className="font-medium text-fg">{title}</p>}
          <p lang={code}>{notice.body[code]}</p>
        </div>
      </div>
      {/* every language is in the DOM for screen readers, even while hidden */}
      <span className="sr-only">
        {langs.map((c) => `${notice.title?.[c] ?? ""} ${notice.body[c]}`).join(". ")}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function NoticeTicker({
  notices,
  preferred,
}: {
  notices: DisplayNotice[];
  preferred: string;
}) {
  const [index, setIndex] = React.useState(0);

  // more than one notice? rotate through them slowly, giving each its full
  // language cycle first
  React.useEffect(() => {
    if (notices.length < 2) return;
    const t = setInterval(() => setIndex((n) => (n + 1) % notices.length), CYCLE_MS * 2.5);
    return () => clearInterval(t);
  }, [notices.length]);

  if (notices.length === 0) return null;
  const n = notices[index % notices.length]!;

  return (
    <div
      aria-live="polite"
      className={cn(
        "w-full max-w-md rounded-card border p-6 text-left shadow-card transition-colors",
        n.priority === "urgent"
          ? "border-critical bg-critical-subtle"
          : n.priority === "important"
            ? "border-warning bg-warning-subtle"
            : "border-edge bg-surface"
      )}
    >
      <div className="flex items-center gap-2.5">
        {n.priority === "urgent" ? (
          <AlertTriangle aria-hidden className="size-5 text-critical-text" />
        ) : (
          <Info aria-hidden className="size-5 text-accent-text" />
        )}
        <p className="text-body-sm font-medium text-fg">
          {n.priority === "urgent" ? "Important — read this" : "Today’s site note"}
        </p>
        {notices.length > 1 && (
          <span className="ml-auto font-numeric text-caption text-fg-muted tabular-nums">
            {index + 1}/{notices.length}
          </span>
        )}
      </div>
      <CyclingText notice={n} preferred={preferred} className="mt-3 text-body text-fg-secondary" />
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function NoticeList({
  notices,
  preferred,
  onAck,
}: {
  notices: DisplayNotice[];
  preferred: string;
  onAck?: (noticeId: string) => void;
}) {
  const [acked, setAcked] = React.useState<Set<string>>(new Set());

  if (notices.length === 0) return null;

  return (
    <div className="mt-8 w-full max-w-2xl space-y-3 text-left">
      <p className="text-body-sm font-medium text-fg-muted">Your notes for today</p>
      {notices.map((n) => {
        const done = n.acked || acked.has(n.id);
        return (
          <div
            key={n.id}
            className={cn(
              "rounded-card border p-5",
              n.priority === "urgent"
                ? "border-critical bg-critical-subtle"
                : n.priority === "important"
                  ? "border-warning bg-warning-subtle"
                  : "border-edge bg-surface"
            )}
          >
            <div className="flex items-center gap-2">
              {n.personal && (
                <span className="rounded-pill bg-accent-subtle px-2.5 py-1 text-caption font-medium text-accent-text">
                  for you
                </span>
              )}
              {n.priority === "urgent" && (
                <span className="flex items-center gap-1 text-caption font-medium text-critical-text">
                  <AlertTriangle aria-hidden className="size-3.5" />
                  urgent
                </span>
              )}
            </div>
            <CyclingText
              notice={n}
              preferred={preferred}
              className="mt-2 text-title-3 leading-relaxed font-normal text-fg"
            />
            {n.requires_ack && (
              <button
                type="button"
                disabled={done}
                onClick={() => {
                  setAcked((s) => new Set(s).add(n.id));
                  onAck?.(n.id);
                }}
                className={cn(
                  "mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-control text-body font-semibold transition-colors",
                  done
                    ? "bg-success-subtle text-success-text"
                    : "bg-accent text-on-accent hover:bg-accent-hover"
                )}
              >
                <Check aria-hidden className="size-5" />
                {done ? "Thanks — recorded" : "I’ve read this"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
