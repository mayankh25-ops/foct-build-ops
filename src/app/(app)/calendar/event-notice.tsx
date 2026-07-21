"use client";

/**
 * Printable notice-board export for calendar events (owner task 2026-07-21).
 * Any event opens as an A4 black-on-white notice — previewed in a modal,
 * printed (or saved as PDF) via the browser print dialog. The notice is
 * deliberately NOT themed: it's a physical sheet for the lift lobby /
 * notice board, so it stays stark black-on-white whatever theme the
 * portal wears (named CSS colours only — the token gate allows no raw
 * colour values in app code).
 */
import * as React from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import {
  calCategoryMeta,
  noticeChannelSummary,
  REPEAT_LABELS,
  useCalendarStore,
  type CalEvent,
} from "@/lib/calendar-store";

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const fmtTime = (t: number) =>
  `${String(Math.floor(t)).padStart(2, "0")}:${String(Math.round((t % 1) * 60)).padStart(2, "0")}`;

const longDate = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/** The self-contained A4 notice document — used for both preview and print. */
export function noticeHtml(e: CalEvent): string {
  const meta = calCategoryMeta[e.category];
  const when =
    e.endDate && e.endDate > e.date
      ? `${longDate(e.date)} — ${longDate(e.endDate)}`
      : longDate(e.date);
  const time =
    e.time === undefined
      ? "All day"
      : e.endTime !== undefined
        ? `${fmtTime(e.time)} – ${fmtTime(e.endTime)}`
        : `From ${fmtTime(e.time)}`;
  const repeats =
    e.repeat && e.repeat !== "none" ? `Repeats ${REPEAT_LABELS[e.repeat].toLowerCase()}` : "";
  const contact = [e.contactName, e.contactPhone].filter(Boolean).join(" · ");
  const printed = new Date().toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Building notice — ${esc(e.title)}</title>
<style>
  @page { size: A4 portrait; margin: 14mm; }
  * { box-sizing: border-box; margin: 0; }
  html, body { background: white; color: black; }
  body {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    padding: 16px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .frame { border: 3px solid black; padding: 8px; min-height: calc(100vh - 32px); }
  .inner { border: 1px solid black; padding: 40px 44px; min-height: 100%; display: flex; flex-direction: column; }
  .building { font-size: 14px; font-weight: 600; letter-spacing: 0.28em; text-transform: uppercase; }
  .kicker { margin-top: 18px; font-size: 34px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
  .rule { margin: 22px 0; border: 0; border-top: 2px solid black; }
  .tag { display: inline-block; border: 2px solid black; padding: 4px 14px; font-size: 13px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; }
  .title { margin-top: 18px; font-size: 40px; line-height: 1.15; font-weight: 750; }
  .when { margin-top: 26px; }
  .when-label { font-size: 12px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: dimgray; }
  .when-value { margin-top: 4px; font-size: 24px; font-weight: 700; }
  .when-time { margin-top: 2px; font-size: 20px; font-weight: 600; }
  .repeats { margin-top: 4px; font-size: 15px; font-weight: 600; color: dimgray; }
  .detail { margin-top: 24px; font-size: 17px; line-height: 1.55; max-width: 60ch; }
  .contact { margin-top: 22px; font-size: 15px; }
  .contact strong { font-weight: 700; }
  .spacer { flex: 1 1 auto; min-height: 32px; }
  .footer { border-top: 1px solid black; padding-top: 14px; font-size: 12.5px; color: dimgray; display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
</style>
</head>
<body>
  <div class="frame"><div class="inner">
    <p class="building">Aurora on Collins</p>
    <p class="kicker">Building notice</p>
    <hr class="rule" />
    <span class="tag">${esc(meta.label)}</span>
    <h1 class="title">${esc(e.title)}</h1>
    <div class="when">
      <p class="when-label">When</p>
      <p class="when-value">${esc(when)}</p>
      <p class="when-time">${esc(time)}</p>
      ${repeats ? `<p class="repeats">${esc(repeats)}</p>` : ""}
    </div>
    ${e.detail ? `<p class="detail">${esc(e.detail)}</p>` : ""}
    ${contact ? `<p class="contact"><strong>Contact:</strong> ${esc(contact)}</p>` : ""}
    <div class="spacer"></div>
    <div class="footer">
      <span>Issued by building management · ${esc(printed)}</span>
      <span>Questions? See the concierge desk.</span>
    </div>
  </div></div>
</body>
</html>`;
}

/**
 * Controlled preview + print modal. The Root stays mounted and is driven by
 * `event` (same Radix rule as the calendar's DayDrawer — see DECISIONS.md).
 * Print runs against a same-document iframe so only the notice prints.
 */
export function PrintNoticeModal({
  event,
  onClose,
}: {
  event: CalEvent | null;
  onClose: () => void;
}) {
  const manualEvents = useCalendarStore((s) => s.manualEvents);
  const frameRef = React.useRef<HTMLIFrameElement>(null);

  // A day-occurrence of a multi-day span carries the span's id — print the
  // ORIGINAL event so the notice shows the full date range, not one day.
  const original =
    event?.spanId != null
      ? (manualEvents.find((x) => x.id === event.spanId) ?? event)
      : event;

  return (
    <Modal open={!!event} onOpenChange={(o) => !o && onClose()}>
      {/* data-print-notice lets the DayDrawer underneath ignore "outside"
          interactions that are really aimed at this stacked modal */}
      <ModalContent size="lg" data-print-notice="">
        <ModalHeader>
          <ModalTitle>Print notice</ModalTitle>
          <ModalDescription>
            A4 notice-board sheet for “{original?.title}” — print it or save it as a PDF from the
            print dialog, then post it in the lobby or lift.
          </ModalDescription>
        </ModalHeader>
        <ModalBody>
          {original && (
            <iframe
              ref={frameRef}
              title={`Notice preview — ${original.title}`}
              srcDoc={noticeHtml(original)}
              className="aspect-[210/260] w-full rounded-card border border-edge"
            />
          )}
          {original?.residentNotice && (
            <p className="mt-3 text-caption text-fg-muted">
              Residents are also being notified by {noticeChannelSummary(original.residentNotice.channels)} —
              the printed sheet covers the notice board.
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={() => {
              const win = frameRef.current?.contentWindow;
              if (!win) return;
              win.focus();
              win.print();
            }}
          >
            <Printer aria-hidden /> Print / save PDF
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
