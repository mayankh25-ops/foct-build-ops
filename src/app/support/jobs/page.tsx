"use client";

import * as React from "react";
import Link from "next/link";
import { Camera, Check, CheckCircle2, ChevronLeft, Info } from "lucide-react";
import { Chip, JobStatusPill, MicroLabel, SyncedChip } from "@/app/support/support-ui";
import { useToast } from "@/components/ui/toast";
import { compressImage } from "@/lib/compress-image";
import { sdSiteStaff } from "@/lib/service-desk-data";
import { useSdRehydrate, useSdStore, type SdTicketLive } from "@/lib/service-desk-store";
import { building } from "@/lib/demo-data";
import { cn } from "@/lib/cn";

const CLEANER = sdSiteStaff.cleaners[0] ?? "Marcus Chen";
const OPEN = ["new", "open", "in-progress", "reopened"];
const REMARKS = ["Removed with solvent", "Repainted", "Needs follow-up"];

function PhotoGrid({ urls, count, tone }: { urls?: string[]; count: number; tone?: "success" }) {
  if (urls && urls.length > 0) {
    return (
      <div className="grid grid-cols-2 gap-2.5">
        {urls.map((u, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={u} alt={`photo ${i + 1}`} className="h-24 w-full rounded-control object-cover" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {Array.from({ length: Math.max(count, 1) }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "flex h-24 items-center justify-center rounded-control",
            tone === "success" ? "bg-success-subtle" : "bg-canvas"
          )}
        >
          <Camera aria-hidden className={cn("size-5", tone === "success" ? "text-success-text" : "text-fg-muted")} />
        </div>
      ))}
    </div>
  );
}

function JobDetail({ jobRef, onBack }: { jobRef: string; onBack: () => void }) {
  const { toast } = useToast();
  const ticket = useSdStore((s) => s.tickets.find((t) => t.ref === jobRef));
  const attend = useSdStore((s) => s.attend);
  const close = useSdStore((s) => s.close);
  const [remarks, setRemarks] = React.useState<string[]>([]);
  const [afterPhotos, setAfterPhotos] = React.useState<string[]>([]);
  const fileRef = React.useRef<HTMLInputElement>(null);

  if (!ticket) return null;
  const title = `${ticket.category} — ${ticket.locations[0]?.area ?? ticket.locations[0]?.level}`;
  const done = ticket.status === "resolved" || ticket.status === "closed";
  const attendedAt = ticket.events.find((e) => e.kind === "status" && e.what.startsWith("Attending"))?.at;
  const completedAt = ticket.events.find((e) => e.what.startsWith("Resolved"))?.at;

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const next = [...afterPhotos];
    for (const f of Array.from(files).slice(0, 5 - next.length)) {
      try {
        next.push(await compressImage(f));
      } catch {
        toast({ tone: "critical", title: "Couldn't read that image" });
      }
    }
    setAfterPhotos(next);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <main className="flex flex-1 flex-col px-5 pt-14 pb-9">
      <div className="flex items-center justify-between pb-3.5">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-body-sm font-semibold text-accent-text [&_svg]:size-4">
          <ChevronLeft aria-hidden /> Jobs
        </button>
        <span className="font-mono text-body-sm font-semibold text-fg">{ticket.ref}</span>
        <JobStatusPill status={ticket.status} />
      </div>

      {done ? (
        <>
          <div className="flex flex-1 flex-col gap-3.5">
            <div className="flex items-center gap-3 rounded-control bg-success-subtle px-4 py-3.5">
              <CheckCircle2 aria-hidden className="size-5 shrink-0 text-success-text" />
              <div>
                <p className="text-body-sm font-bold text-fg">Job completed</p>
                <p className="mt-0.5 font-mono text-caption text-success-text uppercase">
                  {attendedAt ? `Attended ${attendedAt.replace("Today ", "")}` : "Attended"} · Completed{" "}
                  {completedAt?.replace("Today ", "") ?? ""}
                </p>
              </div>
            </div>
            <div>
              <MicroLabel>After</MicroLabel>
              <PhotoGrid urls={ticket.photoUrlsAfter} count={ticket.photosAfter} tone="success" />
            </div>
            <div className="rounded-control border border-edge px-3.5 py-3">
              <p className="font-mono text-[10px] tracking-[0.1em] text-fg-disabled uppercase">Remarks</p>
              <p className="mt-1 text-body-sm text-fg-secondary">
                {ticket.events.findLast((e) => e.kind === "photo")?.what.split("— ").at(-1) ?? "—"}
              </p>
            </div>
            <div className="flex items-start gap-2.5 rounded-control border border-edge bg-hover px-3.5 py-3">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
              <p className="text-caption text-fg-secondary">
                All done — your admin takes it from here. Billing and closing are handled on the dashboard.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="mt-3 h-14 rounded-control bg-fg text-body font-bold text-surface"
          >
            Done
          </button>
        </>
      ) : (
        <>
          <div className="flex flex-1 flex-col gap-3.5">
            <div>
              <h1 className="font-display text-title-2 font-extrabold tracking-tight text-fg">{title}</h1>
              <p className="mt-1 font-mono text-caption text-fg-muted uppercase">
                {ticket.locations[0]?.level} · {ticket.priority} priority · {ticket.lodgedBy}
              </p>
            </div>
            <p className="text-body-sm leading-relaxed text-fg-secondary">{ticket.description}</p>
            <div>
              <MicroLabel>Before</MicroLabel>
              <PhotoGrid urls={ticket.photoUrlsBefore} count={ticket.photosBefore} />
            </div>
            <div>
              <MicroLabel>Quick remarks — tap to add</MicroLabel>
              <div className="flex flex-wrap gap-2">
                {REMARKS.map((r) => (
                  <Chip
                    key={r}
                    active={remarks.includes(r)}
                    onClick={() => setRemarks((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]))}
                  >
                    {r}
                  </Chip>
                ))}
              </div>
            </div>
            {afterPhotos.length > 0 && (
              <div>
                <MicroLabel>After</MicroLabel>
                <PhotoGrid urls={afterPhotos} count={afterPhotos.length} tone="success" />
              </div>
            )}
          </div>

          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
          <div className="mt-3 flex flex-col gap-2.5">
            {ticket.status !== "in-progress" ? (
              <button
                type="button"
                onClick={() => {
                  attend(ticket.ref, CLEANER);
                  toast({ tone: "success", title: "Attending", description: `${ticket.ref} → In progress` });
                }}
                className="h-14 rounded-control bg-accent text-body font-bold text-on-accent transition-colors hover:bg-accent-hover"
              >
                Attend job
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex h-[52px] items-center justify-center gap-2.5 rounded-control border-[1.5px] border-dashed border-edge-strong bg-surface text-body-sm font-semibold text-fg [&_svg]:size-[18px]"
                >
                  <Camera aria-hidden className="text-accent-text" />
                  {afterPhotos.length ? `Add another after photo (${afterPhotos.length})` : "Add after photo"}
                </button>
                <button
                  type="button"
                  disabled={afterPhotos.length === 0}
                  onClick={() => {
                    close(ticket.ref, { by: CLEANER, note: remarks.join(" · ") || undefined, photoUrls: afterPhotos });
                    toast({ tone: "success", title: `${ticket.ref} completed`, description: "Closure notifications sent (simulated)" });
                  }}
                  className="h-14 rounded-control bg-accent text-body font-bold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-55"
                >
                  Mark completed
                </button>
              </>
            )}
          </div>
        </>
      )}
    </main>
  );
}

export default function SupportJobsPage() {
  useSdRehydrate();
  const tickets = useSdStore((s) => s.tickets);
  const [view, setView] = React.useState<"today" | "all" | "completed">("today");
  const [openRef, setOpenRef] = React.useState<string | null>(null);

  if (openRef) return <JobDetail jobRef={openRef} onBack={() => setOpenRef(null)} />;

  const openJobs = tickets.filter((t) => OPEN.includes(t.status));
  const completed = tickets.filter((t) => t.status === "resolved" || t.status === "closed");
  const visible = view === "completed" ? completed : view === "today" ? openJobs.filter((t) => t.createdAt.startsWith("Today")) : openJobs;
  const upNext = visible.find((t) => t.status === "in-progress") ?? visible[0];

  const JobCard = ({ t, next }: { t: SdTicketLive; next?: boolean }) => (
    <div className={cn("relative rounded-card p-4", next ? "border-[1.5px] border-fg" : "border border-edge")}>
      {next && (
        <span className="absolute -top-2.5 left-3.5 rounded-pill bg-accent px-2.5 py-0.5 font-mono text-[9px] tracking-[0.08em] text-on-accent uppercase">
          Up next
        </span>
      )}
      <div className="flex items-center justify-between">
        <span className="font-mono text-caption text-fg">{t.ref}</span>
        <JobStatusPill status={t.status} />
      </div>
      <p className="mt-2 text-body font-bold text-fg">
        {t.category} — {t.locations[0]?.area ?? t.locations[0]?.level}
      </p>
      <p className="mt-0.5 font-mono text-caption text-fg-muted uppercase">
        {t.locations[0]?.level} · {t.priority} · {t.photosBefore} photo{t.photosBefore === 1 ? "" : "s"}
      </p>
      {next ? (
        <button
          type="button"
          onClick={() => setOpenRef(t.ref)}
          className="mt-3 h-12 w-full rounded-control bg-fg text-body-sm font-semibold text-surface"
        >
          Open job
        </button>
      ) : (
        <button type="button" onClick={() => setOpenRef(t.ref)} className="mt-2 text-body-sm font-medium text-accent-text">
          Open
        </button>
      )}
    </div>
  );

  return (
    <main className="flex flex-1 flex-col px-5 pt-14 pb-9">
      <div className="flex items-center justify-between pb-1">
        <h1 className="font-display text-title-1 font-extrabold tracking-tight text-fg">My jobs</h1>
        <SyncedChip />
      </div>
      <p className="text-body-sm text-fg-muted">
        {CLEANER.split(" ")[0]} · Day shift — {building.name}
      </p>
      <div className="flex gap-2 py-4">
        {(
          [
            ["today", `Today · ${openJobs.filter((t) => t.createdAt.startsWith("Today")).length}`],
            ["all", "All"],
            ["completed", "Completed"],
          ] as const
        ).map(([v, label]) => (
          <Chip key={v} active={view === v} onClick={() => setView(v)}>
            {label}
          </Chip>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
          <span className="mb-5 flex size-[88px] items-center justify-center rounded-pill bg-success-subtle">
            <CheckCircle2 aria-hidden className="size-9 text-success-text" />
          </span>
          <p className="font-display text-title-2 font-extrabold tracking-tight text-fg">Queue clear</p>
          <p className="mt-2 text-body-sm leading-relaxed text-fg-muted">
            No jobs assigned to you right now. New tickets appear here the moment they are assigned.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((t) => (
            <JobCard key={t.ref} t={t} next={t.ref === upNext?.ref} />
          ))}
        </div>
      )}
      <Link href="/support" className="pt-6 text-center text-caption text-fg-muted underline-offset-2 hover:underline">
        Back to home
      </Link>
    </main>
  );
}
