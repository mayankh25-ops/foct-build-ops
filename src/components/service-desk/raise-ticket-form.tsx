"use client";

import * as React from "react";
import { Camera, Mail, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/filter-bar";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { compressImage } from "@/lib/compress-image";
import { sdCategories, sdLevels, sdSiteStaff } from "@/lib/service-desk-data";
import { useSdStore } from "@/lib/service-desk-store";
import type { SdPriority, SdTicket } from "@/lib/service-desk-data";

interface LocationRow {
  id: number;
  level?: string;
  area: string;
}

/**
 * The raise-a-ticket form, shared between the /service-desk/new page (QR +
 * deep links) and the big NEW-TICKET MODAL on the desk (owner direction
 * 2026-07-15: create forms open as large centred dialogs, not side panels).
 */
export function RaiseTicketForm({ onDone }: { onDone?: (ref: string) => void }) {
  const createTicket = useSdStore((s) => s.createTicket);
  const { toast } = useToast();

  const [name, setName] = React.useState<string | undefined>();
  const [locations, setLocations] = React.useState<LocationRow[]>([{ id: 1, area: "" }]);
  const [category, setCategory] = React.useState<string | undefined>();
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState<SdPriority>("normal");
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [followers, setFollowers] = React.useState<string[]>(["bm@auroraoncollins.com.au"]);
  const [followerDraft, setFollowerDraft] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const setLocation = (id: number, patch: Partial<LocationRow>) =>
    setLocations((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const addFollower = () => {
    const email = followerDraft.trim();
    if (email && email.includes("@") && !followers.includes(email)) {
      setFollowers((f) => [...f, email]);
      setFollowerDraft("");
    }
  };

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

  const errors = {
    name: !name,
    level: !locations.some((l) => l.level),
    category: !category,
    photos: photos.length === 0,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const submit = () => {
    setSubmitted(true);
    if (hasErrors) {
      toast({
        tone: "warning",
        title: "Almost there",
        description: [
          errors.name && "pick your name",
          errors.level && "pick a level",
          errors.category && "pick a category",
          errors.photos && "add at least 1 photo",
        ]
          .filter(Boolean)
          .join(" · "),
      });
      return;
    }
    const ref = createTicket({
      lodgedBy: name!,
      category: category as SdTicket["category"],
      locations: locations
        .filter((l) => l.level)
        .map((l) => ({ level: l.level!, area: l.area.trim() || undefined })),
      description: description.trim() || `${category} reported via intake form.`,
      priority,
      followers,
      photoUrls: photos,
    });
    toast({
      tone: "success",
      title: `Ticket ${ref} lodged`,
      description: `Cleaning team notified · ${followers.length} follower${followers.length === 1 ? "" : "s"} subscribed`,
    });
    onDone?.(ref);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Select
          label="Your name"
          placeholder="Pick your name — no typing"
          options={[
            ...sdSiteStaff.concierges.map((n) => ({ value: n, label: `${n} · Concierge` })),
            ...sdSiteStaff.cleaners.map((n) => ({ value: n, label: `${n} · Cleaning` })),
            { value: sdSiteStaff.manager, label: `${sdSiteStaff.manager} · Manager` },
          ]}
          value={name}
          onValueChange={setName}
        />
        {submitted && errors.name && (
          <p className="text-caption text-critical-text">Pick your name from the list.</p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-body-sm font-medium text-fg">Location</p>
        {locations.map((row) => (
          <div key={row.id} className="flex items-end gap-3">
            <Select
              placeholder="Level"
              options={sdLevels.map((l) => ({ value: l, label: l }))}
              value={row.level}
              onValueChange={(v) => setLocation(row.id, { level: v })}
              className="w-32"
            />
            <Input
              placeholder="Area (optional) — e.g. kitchen point, male amenities"
              value={row.area}
              onChange={(e) => setLocation(row.id, { area: e.target.value })}
            />
            {locations.length > 1 && (
              <button
                type="button"
                aria-label="Remove location"
                onClick={() => setLocations((ls) => ls.filter((l) => l.id !== row.id))}
                className="mb-1 flex size-9 shrink-0 items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-hover hover:text-fg"
              >
                <X aria-hidden className="size-4" />
              </button>
            )}
          </div>
        ))}
        {submitted && errors.level && (
          <p className="text-caption text-critical-text">Pick at least one level.</p>
        )}
        <button
          type="button"
          onClick={() => setLocations((ls) => [...ls, { id: Date.now(), area: "" }])}
          className="flex w-fit items-center gap-1.5 text-body-sm font-medium text-accent-text transition-colors hover:opacity-80"
        >
          <Plus aria-hidden className="size-4" /> Add another location
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <Select
          label="Issue category"
          placeholder="What kind of issue?"
          options={sdCategories.map((c) => ({ value: c, label: c }))}
          value={category}
          onValueChange={setCategory}
        />
        {submitted && errors.category && (
          <p className="text-caption text-critical-text">Pick a category.</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="sd-desc" className="text-body-sm font-medium text-fg">
          Description
        </label>
        <textarea
          id="sd-desc"
          rows={3}
          placeholder="One or two sentences — the photos do the talking."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-card border border-edge-strong bg-surface px-3.5 py-2.5 text-body text-fg placeholder:text-fg-disabled"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-body-sm font-medium text-fg">Photos · 1–5</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2 pb-1 sm:grid-cols-5">
            {photos.map((u, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt={`photo ${i + 1}`} className="aspect-square w-full rounded-sm object-cover" />
                <button
                  type="button"
                  aria-label={`Remove photo ${i + 1}`}
                  onClick={() => setPhotos((ps) => ps.filter((_, x) => x !== i))}
                  className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-pill bg-overlay text-on-accent transition-opacity hover:opacity-80"
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={photos.length >= 5}
          className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-edge-strong bg-canvas text-fg-muted transition-colors hover:bg-hover disabled:opacity-55"
        >
          <Camera aria-hidden className="size-5" />
          <span className="text-body-sm">
            {photos.length >= 5
              ? "5 photo limit reached"
              : photos.length > 0
                ? `${photos.length} added · tap to add more`
                : "Tap to use the camera or pick from gallery"}
          </span>
        </button>
        {submitted && errors.photos ? (
          <p className="text-caption text-critical-text">At least one photo is required.</p>
        ) : (
          <p className="text-caption text-fg-muted">
            Compressed on your phone before upload — works offline, syncs when signal returns.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-body-sm font-medium text-fg">Priority</p>
        <SegmentedControl
          label="Priority"
          options={[
            { value: "low", label: "Low" },
            { value: "normal", label: "Normal" },
            { value: "high", label: "High" },
            { value: "urgent", label: "Urgent" },
          ]}
          value={priority}
          onValueChange={(v) => setPriority(v as SdPriority)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="sd-follower" className="text-body-sm font-medium text-fg">
          Followers
        </label>
        <p className="-mt-1 text-caption text-fg-muted">
          Everyone here gets the updates and the closure email with the before/after PDF.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {followers.map((f) => (
            <Badge key={f} tone="accent" className="gap-1.5">
              <Mail aria-hidden className="size-3" />
              {f}
              <button
                type="button"
                aria-label={`Remove ${f}`}
                onClick={() => setFollowers((fs) => fs.filter((x) => x !== f))}
                className="transition-opacity hover:opacity-70"
              >
                <X aria-hidden className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <Input
            id="sd-follower"
            type="email"
            placeholder="name@company.com.au"
            value={followerDraft}
            onChange={(e) => setFollowerDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFollower())}
          />
          <Button variant="secondary" onClick={addFollower} className="shrink-0">
            Add
          </Button>
        </div>
      </div>

      <div className="flex justify-end border-t border-edge pt-5">
        <Button size="md" onClick={submit}>
          Submit ticket
        </Button>
      </div>
    </div>
  );
}
