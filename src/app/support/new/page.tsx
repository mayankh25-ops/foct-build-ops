"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AppWindow,
  Bath,
  Camera,
  Check,
  ChevronLeft,
  DoorClosed,
  Droplets,
  Layers,
  MessageSquare,
  Paintbrush,
  SprayCan,
  Trash2,
  Wind,
  X,
  type LucideIcon,
} from "lucide-react";
import { Chip, MicroLabel } from "@/app/support/support-ui";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { compressImage } from "@/lib/compress-image";
import { sdCategories, sdLevels, sdSiteStaff, type SdPriority, type SdTicket } from "@/lib/service-desk-data";
import { useSdRehydrate, useSdStore } from "@/lib/service-desk-store";
import { building } from "@/lib/demo-data";
import { cn } from "@/lib/cn";

const CONCIERGE = sdSiteStaff.concierges[0] ?? "Amelia Ng";
const QUICK_LEVELS = ["B2", "GF", "L7", "L23"];
const AREAS = ["Lobby", "Lift lobby", "Corridor", "Car park", "Amenities"];
const QUICK_NOTES = ["Near lift bank B", "Recurring issue", "Blocking access"];
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Spillage: Droplets,
  "Dirty area": SprayCan,
  "Rubbish overflow": Trash2,
  "Toilet issue": Bath,
  "Glass/window": AppWindow,
  Graffiti: Paintbrush,
  Odour: Wind,
  "Carpet stain": Layers,
  "Lift interior": DoorClosed,
  Other: MessageSquare,
};

export default function SupportNewTicketPage() {
  useSdRehydrate();
  const createTicket = useSdStore((s) => s.createTicket);
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = React.useState<1 | 2>(1);
  const [level, setLevel] = React.useState<string | undefined>();
  const [area, setArea] = React.useState<string | undefined>();
  const [customArea, setCustomArea] = React.useState("");
  const [customOpen, setCustomOpen] = React.useState(false);
  const [category, setCategory] = React.useState<string | undefined>();
  const [moreCats, setMoreCats] = React.useState(false);
  const [priority, setPriority] = React.useState<SdPriority>("normal");
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [notes, setNotes] = React.useState<string[]>([]);
  const [noteText, setNoteText] = React.useState("");
  const [createdRef, setCreatedRef] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const areaLabel = area === "custom" ? customArea.trim() || undefined : area;
  const cats = moreCats ? sdCategories : sdCategories.slice(0, 6);

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const next = [...photos];
    for (const f of Array.from(files).slice(0, 5 - next.length)) {
      try {
        next.push(await compressImage(f));
      } catch {
        toast({ tone: "critical", title: "Couldn't read that image" });
      }
    }
    setPhotos(next);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = () => {
    if (photos.length === 0) {
      toast({ tone: "warning", title: "Add at least one photo", description: "The photo is the proof the cleaner works from" });
      return;
    }
    const description = [...notes, noteText.trim()].filter(Boolean).join(" · ") || `${category} reported from the front desk.`;
    const ref = createTicket({
      lodgedBy: CONCIERGE,
      category: category as SdTicket["category"],
      locations: [{ level: level!, area: areaLabel }],
      description,
      priority,
      followers: [],
      photoUrls: photos,
    });
    setCreatedRef(ref);
  };

  /* ---- success ---- */
  if (createdRef) {
    return (
      <main className="flex flex-1 flex-col px-6 pt-14 pb-9">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <span className="mb-5 flex size-[88px] items-center justify-center rounded-pill bg-success-subtle">
            <Check aria-hidden className="size-10 text-success-text" strokeWidth={2} />
          </span>
          <h1 className="font-display text-title-1 font-extrabold tracking-tight text-fg">Ticket created</h1>
          <p className="mt-2 font-mono text-body text-accent-text">{createdRef}</p>
          <div className="mt-6 flex w-full flex-col gap-2.5 rounded-control border border-edge p-4 text-left">
            {[
              ["Issue", `${category} · ${priority[0]!.toUpperCase()}${priority.slice(1)}`],
              ["Where", `${level}${areaLabel ? ` · ${areaLabel}` : ""}`],
              ["Assigned to", "Day shift — Cleaning"],
              ["Photos", `${photos.length} attached`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 text-body-sm">
                <span className="text-fg-muted">{k}</span>
                <span className="text-right font-semibold text-fg">{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <Link
            href="/support/jobs"
            className="flex h-[54px] items-center justify-center rounded-control bg-fg text-body-sm font-bold text-surface"
          >
            View ticket
          </Link>
          <Link
            href="/support"
            className="flex h-[54px] items-center justify-center rounded-control border border-edge-strong/40 bg-surface text-body-sm font-semibold text-fg"
          >
            Done
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col px-5 pt-14 pb-9">
      <div className="flex items-center justify-between pb-3.5">
        {step === 1 ? (
          <Link href="/support" className="text-body-sm font-semibold text-accent-text">
            Cancel
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex items-center gap-1 text-body-sm font-semibold text-accent-text [&_svg]:size-4"
          >
            <ChevronLeft aria-hidden /> Back
          </button>
        )}
        <span className="font-display text-body font-bold text-fg">New ticket</span>
        <span className="font-mono text-caption text-fg-disabled">{step} / 2</span>
      </div>

      {step === 1 ? (
        <>
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex items-center gap-2.5 rounded-control bg-hover px-3.5 py-3">
              <span className="text-body-sm font-semibold text-fg">{building.name}</span>
              <Check aria-hidden className="ml-auto size-4 text-success-text" />
            </div>

            <div>
              <MicroLabel>Level</MicroLabel>
              <div className="grid grid-cols-4 gap-2">
                {QUICK_LEVELS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLevel(l)}
                    aria-pressed={level === l}
                    className={cn(
                      "h-[46px] rounded-control border font-mono text-body-sm",
                      level === l
                        ? "border-fg bg-fg text-surface"
                        : "border-edge-strong/40 bg-surface text-fg-secondary"
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <div className="mt-2">
                <Select
                  placeholder="All levels — B4 to L40"
                  options={sdLevels.filter((l) => l !== "Other…").map((l) => ({ value: l, label: l }))}
                  value={level && !QUICK_LEVELS.includes(level) ? level : undefined}
                  onValueChange={setLevel}
                />
              </div>
            </div>

            <div>
              <MicroLabel>Area</MicroLabel>
              <div className="flex flex-wrap gap-2">
                {AREAS.map((a) => (
                  <Chip key={a} active={area === a} onClick={() => { setArea(a); setCustomOpen(false); }}>
                    {a}
                  </Chip>
                ))}
                <Chip dashed active={area === "custom"} onClick={() => { setArea("custom"); setCustomOpen(true); }}>
                  Custom…
                </Chip>
              </div>
              {customOpen && (
                <input
                  autoFocus
                  value={customArea}
                  onChange={(e) => setCustomArea(e.target.value)}
                  placeholder="Describe the area…"
                  className="mt-2 h-11 w-full rounded-control border border-edge-strong/40 bg-surface px-3.5 text-body-sm text-fg placeholder:text-fg-disabled"
                />
              )}
            </div>

            <div>
              <MicroLabel>Issue</MicroLabel>
              <div className="grid grid-cols-2 gap-2">
                {cats.map((c) => {
                  const Icon = CATEGORY_ICONS[c] ?? MessageSquare;
                  const active = category === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      aria-pressed={active}
                      className={cn(
                        "flex h-[52px] items-center gap-2.5 rounded-control border px-3.5 text-body-sm",
                        active
                          ? "border-[1.5px] border-accent bg-accent-subtle font-semibold text-fg"
                          : "border-edge-strong/40 bg-surface font-medium text-fg-secondary"
                      )}
                    >
                      <Icon aria-hidden className={cn("size-[18px] shrink-0", active ? "text-accent-text" : "text-fg-muted")} />
                      <span className="truncate">{c}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setMoreCats((m) => !m)}
                className="mt-2 text-body-sm font-medium text-accent-text"
              >
                {moreCats ? "Fewer options" : "More options…"}
              </button>
            </div>
          </div>
          <button
            type="button"
            disabled={!level || !category}
            onClick={() => setStep(2)}
            className="mt-3.5 h-14 rounded-control bg-accent text-body font-bold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-55"
          >
            Continue
          </button>
        </>
      ) : (
        <>
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex items-center gap-2 rounded-control bg-hover px-3 py-2.5">
              <span className="font-mono text-caption text-fg uppercase">
                {level}
                {areaLabel ? ` · ${areaLabel}` : ""}
              </span>
              <span aria-hidden className="size-1 rounded-pill bg-edge-strong" />
              <span className="text-body-sm font-semibold text-accent-text">{category}</span>
              <button type="button" onClick={() => setStep(1)} className="ml-auto text-caption text-fg-muted">
                Edit
              </button>
            </div>

            <div>
              <MicroLabel>Priority</MicroLabel>
              <div className="grid grid-cols-4 gap-1.5 rounded-control bg-hover p-1">
                {(["low", "normal", "high", "urgent"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    aria-pressed={priority === p}
                    className={cn(
                      "h-10 rounded-sm text-body-sm capitalize",
                      priority === p ? "bg-fg font-semibold text-surface" : "text-fg-muted"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <MicroLabel>Photos · 1–5</MicroLabel>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={photos.length >= 5}
                  className="flex h-28 flex-col items-center justify-center gap-2 rounded-control border-[1.5px] border-dashed border-edge-strong bg-hover text-fg disabled:opacity-55"
                >
                  <Camera aria-hidden className="size-6 text-accent-text" />
                  <span className="text-body-sm font-semibold">Take photo</span>
                </button>
                <div className="grid h-28 grid-rows-2 gap-2.5">
                  {photos.slice(0, 2).map((u, i) => (
                    <div key={i} className="relative overflow-hidden rounded-control">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt={`photo ${i + 1}`} className="size-full object-cover" />
                      <button
                        type="button"
                        aria-label={`Remove photo ${i + 1}`}
                        onClick={() => setPhotos((ps) => ps.filter((_, x) => x !== i))}
                        className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-pill bg-overlay text-on-accent"
                      >
                        <X aria-hidden className="size-3" />
                      </button>
                    </div>
                  ))}
                  {photos.length === 0 && (
                    <div className="row-span-2 flex items-center justify-center rounded-control bg-hover text-caption text-fg-disabled">
                      No photos yet
                    </div>
                  )}
                </div>
              </div>
              {photos.length > 2 && (
                <p className="mt-1.5 text-caption text-fg-muted">+{photos.length - 2} more attached</p>
              )}
            </div>

            <div>
              <MicroLabel>Quick note — tap to add</MicroLabel>
              <div className="flex flex-wrap gap-2">
                {QUICK_NOTES.map((n) => (
                  <Chip
                    key={n}
                    active={notes.includes(n)}
                    onClick={() => setNotes((ns) => (ns.includes(n) ? ns.filter((x) => x !== n) : [...ns, n]))}
                  >
                    {n}
                  </Chip>
                ))}
              </div>
              <input
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note… (optional)"
                className="mt-2 h-11 w-full rounded-control border border-edge bg-hover px-3.5 text-body-sm text-fg placeholder:text-fg-disabled"
              />
            </div>

            <div className="flex items-center justify-between rounded-control border border-edge px-3.5 py-3">
              <div>
                <p className="font-mono text-[10px] tracking-[0.1em] text-fg-disabled uppercase">Assign to</p>
                <p className="mt-0.5 text-body-sm font-semibold text-fg">Day shift — Cleaning</p>
              </div>
            </div>
          </div>
          <div className="mt-3.5">
            <button
              type="button"
              onClick={submit}
              className="h-14 w-full rounded-control bg-accent text-body font-bold text-on-accent transition-colors hover:bg-accent-hover"
            >
              Submit ticket
            </button>
            <p className="mt-2 text-center font-mono text-[10px] tracking-[0.08em] text-fg-disabled uppercase">
              Works offline — syncs automatically
            </p>
          </div>
        </>
      )}
    </main>
  );
}
