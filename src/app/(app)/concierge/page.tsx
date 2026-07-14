"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Lock, Package, PackageCheck, Send, StickyNote, Ticket } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { sdCategories, sdPriorityMeta, sdStatusMeta, type SdPriority } from "@/lib/service-desk-data";
import { useSdRehydrate, useSdStore } from "@/lib/service-desk-store";
import { useConciergeReady, useConciergeStore } from "@/lib/concierge-store";
import { cn } from "@/lib/cn";

/**
 * Concierge desk — the concierge org's workspace. Tickets raise into the
 * SHARED Service Desk (same store the cleaning team works from); parcels
 * and handover notes are the concierge org's own records. The isolation
 * model is the point: concierge sees ticket status, never the cleaning
 * company's internal notes, rosters or payroll.
 */

const CONCIERGE = "Amelia Ng (Concierge)";

const ago = (iso: string) => {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

function RaiseTicketCard() {
  const createTicket = useSdStore((s) => s.createTicket);
  const { toast } = useToast();
  const [category, setCategory] = React.useState<(typeof sdCategories)[number]>("Spillage");
  const [level, setLevel] = React.useState("Ground");
  const [priority, setPriority] = React.useState<SdPriority>("normal");
  const [description, setDescription] = React.useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Raise a ticket</CardTitle>
        <Badge tone="accent">Goes to FOCT Cleaning</Badge>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-body-sm font-medium text-fg">
            Category
            <Select
              options={sdCategories.map((c) => ({ value: c, label: c }))}
              value={category}
              onValueChange={(v) => setCategory(v as (typeof sdCategories)[number])}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-body-sm font-medium text-fg">
            Level / area
            <Input value={level} onChange={(e) => setLevel(e.target.value)} placeholder="e.g. L14" />
          </label>
          <label className="flex flex-col gap-1.5 text-body-sm font-medium text-fg">
            Priority
            <Select
              options={(Object.keys(sdPriorityMeta) as SdPriority[]).map((p) => ({
                value: p,
                label: sdPriorityMeta[p].label,
              }))}
              value={priority}
              onValueChange={(v) => setPriority(v as SdPriority)}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1.5 text-body-sm font-medium text-fg">
          What needs attention?
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Coffee spill at the concierge desk, slippery"
          />
        </label>
        <div className="flex justify-end">
          <Button
            disabled={!description.trim() || !level.trim()}
            onClick={() => {
              const ref = createTicket({
                lodgedBy: CONCIERGE,
                category,
                locations: [{ level: level.trim() }],
                description: description.trim(),
                priority,
                followers: ["concierge@aurora.demo"],
                photoUrls: [],
              });
              setDescription("");
              toast({
                tone: "success",
                title: `Ticket ${ref} lodged`,
                description: "The cleaning team sees it on their queue now — you'll see status here.",
              });
            }}
          >
            <Send aria-hidden /> Lodge ticket
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

export default function ConciergePage() {
  useSdRehydrate();
  const ready = useConciergeReady();
  const tickets = useSdStore((s) => s.tickets);
  const parcels = useConciergeStore((s) => s.parcels);
  const notes = useConciergeStore((s) => s.notes);
  const logParcel = useConciergeStore((s) => s.logParcel);
  const markCollected = useConciergeStore((s) => s.markCollected);
  const addNote = useConciergeStore((s) => s.addNote);
  const { toast } = useToast();

  const [resident, setResident] = React.useState("");
  const [apartment, setApartment] = React.useState("");
  const [carrier, setCarrier] = React.useState("AusPost");
  const [noteText, setNoteText] = React.useState("");

  if (!ready) return null;

  const mine = tickets.filter((t) => t.lodgedBy.includes("Concierge"));
  const openStatuses = new Set(["new", "open", "in-progress", "reopened"]);
  const mineOpen = mine.filter((t) => openStatuses.has(t.status));
  const awaiting = parcels.filter((p) => p.status === "awaiting");

  return (
    <>
      <PageHeader
        eyebrow="Concierge Collective · Aurora on Collins"
        title="Concierge desk"
        description="Raise tickets to the cleaning team, run the parcels register, hand over between shifts."
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard label="My open tickets" value={mineOpen.length} context={`${mine.length} lodged all-time`} />
        <MetricCard
          label="Parcels awaiting"
          value={awaiting.length}
          context={`${parcels.length - awaiting.length} collected`}
          tone={awaiting.length > 5 ? "warning" : "neutral"}
        />
        <MetricCard label="Handover notes" value={notes.length} context="private to Concierge Collective" />
        <MetricCard label="Cleaning status" value="Live" context="completion visibility granted by BM" tone="success" />
      </div>

      <div className="mt-8 flex flex-col gap-6">
        <RaiseTicketCard />

        {/* my tickets */}
        <Card>
          <CardHeader>
            <CardTitle>My tickets</CardTitle>
            <Link href="/service-desk" className="flex items-center gap-1 text-body-sm font-medium text-accent-text">
              Full queue <ArrowRight aria-hidden className="size-4" />
            </Link>
          </CardHeader>
          <CardBody className="flex flex-col gap-0 p-0">
            {mine.length === 0 && (
              <p className="px-6 py-5 text-body-sm text-fg-muted">
                Nothing lodged yet — raise your first ticket above.
              </p>
            )}
            {mine.slice(0, 6).map((t, i) => {
              const st = sdStatusMeta[t.status];
              const pr = sdPriorityMeta[t.priority];
              return (
                <div
                  key={t.ref}
                  className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-3.5", i > 0 && "border-t border-edge")}
                >
                  <Ticket aria-hidden className="size-4 shrink-0 text-fg-muted" />
                  <span className="font-mono text-body-sm text-fg">{t.ref}</span>
                  <span className="min-w-0 flex-1 truncate text-body-sm text-fg-secondary">{t.description}</span>
                  <Badge tone={pr.tone}>{pr.label}</Badge>
                  <StatusPill tone={st.tone}>{st.label}</StatusPill>
                </div>
              );
            })}
          </CardBody>
        </Card>

        <div className="grid items-start gap-6 xl:grid-cols-2">
          {/* parcels */}
          <Card>
            <CardHeader>
              <CardTitle>Parcels register</CardTitle>
              <Badge tone="neutral">{awaiting.length} awaiting collection</Badge>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              <div className="grid grid-cols-[1fr_5rem_7rem_auto] items-end gap-2">
                <label className="flex min-w-0 flex-col gap-1.5 text-body-sm font-medium text-fg">
                  Resident
                  <Input value={resident} onChange={(e) => setResident(e.target.value)} placeholder="Name" />
                </label>
                <label className="flex flex-col gap-1.5 text-body-sm font-medium text-fg">
                  Apt
                  <Input value={apartment} onChange={(e) => setApartment(e.target.value)} placeholder="1203" />
                </label>
                <label className="flex flex-col gap-1.5 text-body-sm font-medium text-fg">
                  Carrier
                  <Select
                    options={["AusPost", "DHL", "Amazon", "StarTrack", "Courier"].map((c) => ({ value: c, label: c }))}
                    value={carrier}
                    onValueChange={setCarrier}
                  />
                </label>
                <Button
                  size="sm"
                  disabled={!resident.trim() || !apartment.trim()}
                  onClick={() => {
                    logParcel({
                      resident: resident.trim(),
                      apartment: apartment.trim(),
                      carrier,
                      description: "Parcel",
                    });
                    setResident("");
                    setApartment("");
                    toast({ tone: "success", title: "Parcel logged", description: "Resident notification queued." });
                  }}
                >
                  <Package aria-hidden /> Log
                </Button>
              </div>
              <div className="flex flex-col">
                {parcels.slice(0, 6).map((p, i) => (
                  <div key={p.id} className={cn("flex items-center gap-3 py-3", i > 0 && "border-t border-edge")}>
                    <Avatar name={p.resident} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-sm font-medium text-fg">
                        {p.resident} · <span className="font-mono">{p.apartment}</span>
                      </span>
                      <span className="block text-caption text-fg-muted">
                        {p.carrier} · {p.description} · {ago(p.receivedAt)}
                      </span>
                    </span>
                    {p.status === "awaiting" ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          markCollected(p.id);
                          toast({ tone: "success", title: "Collected", description: `${p.resident} · ${p.apartment}` });
                        }}
                      >
                        <PackageCheck aria-hidden /> Collected
                      </Button>
                    ) : (
                      <StatusPill tone="success">Collected</StatusPill>
                    )}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* handover notes */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Shift handover</CardTitle>
                <p className="mt-1 flex items-center gap-1.5 text-body-sm text-fg-muted">
                  <Lock aria-hidden className="size-3.5" /> Private to Concierge Collective — no other
                  org can read these
                </p>
              </div>
              <StickyNote aria-hidden className="size-5 text-fg-muted" />
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              <div className="flex items-end gap-2">
                <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-body-sm font-medium text-fg">
                  New note
                  <Input
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="What the next shift needs to know…"
                  />
                </label>
                <Button
                  size="sm"
                  disabled={!noteText.trim()}
                  onClick={() => {
                    addNote("Amelia Ng", noteText.trim());
                    setNoteText("");
                    toast({ tone: "success", title: "Handover note saved" });
                  }}
                >
                  Save
                </Button>
              </div>
              {notes.slice(0, 5).map((n, i) => (
                <div key={n.id} className={cn("flex items-start gap-3", i > 0 && "border-t border-edge pt-4")}>
                  <Avatar name={n.author} size="sm" />
                  <div className="min-w-0">
                    <p className="text-body-sm font-medium text-fg">
                      {n.author} <span className="font-normal text-fg-muted">· {ago(n.at)}</span>
                    </p>
                    <p className="mt-0.5 text-body-sm text-fg-secondary">{n.text}</p>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
