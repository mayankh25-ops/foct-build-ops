"use client";

import * as React from "react";
import Link from "next/link";
import {
  Camera,
  Clock,
  FileText,
  Link2,
  Plus,
  RotateCcw,
  Smartphone,
  ThumbsDown,
  ThumbsUp,
  Ticket,
  TimerReset,
  UserRound,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { FilterBar } from "@/components/ui/filter-bar";
import { SearchInput } from "@/components/ui/search-input";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/ui/metric-card";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
} from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { RaiseTicketForm } from "@/components/service-desk/raise-ticket-form";
import { Select } from "@/components/ui/select";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { compressImage } from "@/lib/compress-image";
import {
  sdPriorityMeta,
  sdSiteStaff,
  sdStatusMeta,
  type SdTicket,
} from "@/lib/service-desk-data";
import { SyncPill } from "@/components/ui/sync-pill";
import { DevMenu } from "@/components/ui/dev-menu";
import { useSdRehydrate, useSdStore, type SdTicketLive } from "@/lib/service-desk-store";
import { cn } from "@/lib/cn";

const OPEN_STATUSES = ["new", "open", "in-progress", "reopened"];

function SlaChip({ sla }: { sla: SdTicket["sla"] }) {
  if (sla.state === "met")
    return <StatusPill tone="success">Met{sla.toResolve !== "met" ? ` · ${sla.toResolve}` : ""}</StatusPill>;
  if (sla.state === "breached") return <StatusPill tone="critical">{sla.over}</StatusPill>;
  return (
    <StatusPill tone={sla.state === "warning" ? "warning" : "neutral"}>
      {sla.remaining}
    </StatusPill>
  );
}

const eventDot: Record<string, string> = {
  created: "bg-accent",
  status: "bg-chart-1",
  note: "bg-edge-strong",
  photo: "bg-chart-2",
  notify: "bg-edge-strong",
  csat: "bg-chart-1",
};

function PhotoTiles({
  kind,
  count,
  urls,
}: {
  kind: "before" | "after";
  count: number;
  urls?: string[];
}) {
  if (urls && urls.length > 0) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-2 gap-1.5">
          {urls.map((u, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={u}
              alt={`${kind} photo ${i + 1}`}
              className="aspect-video w-full rounded-sm object-cover"
            />
          ))}
        </div>
        <p className="text-caption tracking-[0.06em] text-fg-muted uppercase">
          {kind} · {urls.length} photo{urls.length > 1 ? "s" : ""}
        </p>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex aspect-video flex-col items-center justify-center gap-1.5 rounded-card",
        count > 0 ? "bg-accent-subtle" : "border border-dashed border-edge-strong bg-canvas"
      )}
    >
      <Camera aria-hidden className={cn("size-4", count > 0 ? "text-accent-text" : "text-fg-muted")} />
      <p className={cn("text-caption tracking-[0.06em] uppercase", count > 0 ? "text-accent-text" : "text-fg-muted")}>
        {kind} · {count > 0 ? `${count} photo${count > 1 ? "s" : ""}` : "pending"}
      </p>
    </div>
  );
}

function TicketDrawer({
  ticketRef,
  onClose,
}: {
  ticketRef: string | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const ticket = useSdStore((s) => s.tickets.find((t) => t.ref === ticketRef));
  const { assign, attend, close, reopen, addInternalNote, addFollower, removeFollower, setCsat } =
    useSdStore();

  const [closing, setClosing] = React.useState(false);
  const [closeBy, setCloseBy] = React.useState<string | undefined>();
  const [closeNote, setCloseNote] = React.useState("");
  const [closePhotos, setClosePhotos] = React.useState<string[]>([]);
  const [noteDraft, setNoteDraft] = React.useState("");
  const [followerDraft, setFollowerDraft] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    // fresh close-flow state per ticket
    setClosing(false);
    setCloseBy(undefined);
    setCloseNote("");
    setClosePhotos([]);
    setNoteDraft("");
    setFollowerDraft("");
  }, [ticketRef]);

  if (!ticket) return <Drawer open={false} onOpenChange={(o) => !o && onClose()} />;

  const onAfterFiles = async (files: FileList | null) => {
    if (!files) return;
    const next = [...closePhotos];
    for (const f of Array.from(files).slice(0, 5 - next.length)) {
      try {
        next.push(await compressImage(f));
      } catch {
        toast({ tone: "critical", title: "Couldn't read that image" });
      }
    }
    setClosePhotos(next);
  };

  const confirmClose = () => {
    if (!closeBy || closePhotos.length === 0) return;
    close(ticket.ref, { by: closeBy, note: closeNote.trim() || undefined, photoUrls: closePhotos });
    setClosing(false);
    toast({
      tone: "success",
      title: `${ticket.ref} resolved`,
      description: `Closure sent to ${ticket.lodgedBy}${ticket.followers.length ? ` + ${ticket.followers.length} follower${ticket.followers.length === 1 ? "" : "s"}` : ""} · proof PDF queued`,
    });
  };

  const submitNote = () => {
    const text = noteDraft.trim();
    if (!text) return;
    addInternalNote(ticket.ref, sdSiteStaff.manager, text);
    setNoteDraft("");
  };

  const submitFollower = () => {
    const email = followerDraft.trim();
    if (!email || !email.includes("@")) return;
    addFollower(ticket.ref, email);
    setFollowerDraft("");
  };

  return (
    <Drawer open onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="w-[min(30rem,calc(100vw-2rem))]">
        <DrawerHeader>
          <div className="flex items-center gap-2.5">
            <p className="font-mono text-body-sm text-fg-muted">{ticket.ref}</p>
            <StatusPill tone={sdStatusMeta[ticket.status].tone}>
              {sdStatusMeta[ticket.status].label}
            </StatusPill>
            <StatusPill tone={sdPriorityMeta[ticket.priority].tone}>
              {sdPriorityMeta[ticket.priority].label}
            </StatusPill>
          </div>
          <DrawerTitle className="mt-2">{ticket.category}</DrawerTitle>
          <DrawerDescription className="mt-1 text-body-sm text-fg-muted">
            {ticket.locations.map((l) => `${l.level}${l.area ? ` · ${l.area}` : ""}`).join("  +  ")}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="text-body-sm text-fg-secondary">{ticket.description}</p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-card border border-edge bg-canvas p-3.5">
              <p className="text-caption tracking-[0.06em] text-fg-muted uppercase">Lodged by</p>
              <div className="mt-2 flex items-center gap-2">
                <Avatar name={ticket.lodgedBy} size="sm" />
                <div className="leading-tight">
                  <p className="text-body-sm font-medium text-fg">{ticket.lodgedBy}</p>
                  <p className="text-caption text-fg-muted">{ticket.createdAt}</p>
                </div>
              </div>
            </div>
            <div className="rounded-card border border-edge bg-canvas p-3.5">
              <p className="text-caption tracking-[0.06em] text-fg-muted uppercase">Assigned to</p>
              {ticket.assignee ? (
                <div className="mt-2 flex items-center gap-2">
                  <Avatar name={ticket.assignee} size="sm" />
                  <p className="text-body-sm font-medium text-fg">{ticket.assignee}</p>
                </div>
              ) : (
                <div className="mt-2">
                  <Select
                    placeholder="Assign cleaner…"
                    options={sdSiteStaff.cleaners.map((c) => ({ value: c, label: c }))}
                    onValueChange={(v) => {
                      assign(ticket.ref, v);
                      toast({ tone: "success", title: `${v} assigned`, description: ticket.ref });
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* before / after — the money shot */}
          <div className="mt-5">
            <p className="text-caption font-medium tracking-[0.06em] text-fg-muted uppercase">
              Photos
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <PhotoTiles kind="before" count={ticket.photosBefore} urls={ticket.photoUrlsBefore} />
              <PhotoTiles kind="after" count={ticket.photosAfter} urls={ticket.photoUrlsAfter} />
            </div>
          </div>

          {/* proof PDF + CSAT */}
          {(ticket.pdf || ticket.csat) && (
            <div className="mt-4 flex items-center gap-3">
              {ticket.pdf && (
                <button
                  type="button"
                  onClick={() =>
                    toast({ tone: "neutral", title: "PDF generation lands with the backend stage", description: ticket.pdf })
                  }
                  className="flex flex-1 items-center gap-2.5 rounded-card border border-edge bg-canvas px-3.5 py-2.5 text-left transition-colors hover:bg-hover"
                >
                  <FileText aria-hidden className="size-4 shrink-0 text-accent-text" />
                  <span className="truncate font-mono text-caption text-fg">{ticket.pdf}</span>
                </button>
              )}
              {ticket.csat && (
                <StatusPill tone={ticket.csat === "up" ? "success" : "critical"}>
                  {ticket.csat === "up" ? (
                    <>
                      <ThumbsUp aria-hidden className="size-3" /> Rated good
                    </>
                  ) : (
                    <>
                      <ThumbsDown aria-hidden className="size-3" /> Disputed
                    </>
                  )}
                </StatusPill>
              )}
            </div>
          )}

          {/* CSAT simulation on resolved-but-unrated tickets */}
          {ticket.status === "resolved" && !ticket.csat && (
            <div className="mt-4 flex items-center justify-between rounded-card border border-edge bg-canvas px-3.5 py-2.5">
              <p className="text-body-sm text-fg-secondary">
                {ticket.lodgedBy} gets a one-tap rating in the closure message:
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label="Simulate thumbs up"
                  onClick={() => setCsat(ticket.ref, "up")}
                  className="flex size-9 items-center justify-center rounded-control bg-success-subtle text-success-text transition-opacity hover:opacity-80"
                >
                  <ThumbsUp aria-hidden className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Simulate thumbs down"
                  onClick={() => setCsat(ticket.ref, "down")}
                  className="flex size-9 items-center justify-center rounded-control bg-critical-subtle text-critical-text transition-opacity hover:opacity-80"
                >
                  <ThumbsDown aria-hidden className="size-4" />
                </button>
              </div>
            </div>
          )}

          {/* followers */}
          <div className="mt-5">
            <p className="text-caption font-medium tracking-[0.06em] text-fg-muted uppercase">
              Followers · closure email
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ticket.followers.map((f) => (
                <Badge key={f} tone="neutral" className="gap-1.5">
                  {f}
                  <button
                    type="button"
                    aria-label={`Remove ${f}`}
                    onClick={() => removeFollower(ticket.ref, f)}
                    className="transition-opacity hover:opacity-70"
                  >
                    <X aria-hidden className="size-3" />
                  </button>
                </Badge>
              ))}
              {ticket.followers.length === 0 && (
                <p className="text-body-sm text-fg-muted">No followers yet.</p>
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                type="email"
                placeholder="Add follower email…"
                value={followerDraft}
                onChange={(e) => setFollowerDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submitFollower())}
              />
              <Button variant="secondary" size="sm" className="h-11 shrink-0" onClick={submitFollower}>
                Add
              </Button>
            </div>
          </div>

          {/* timeline */}
          <div className="mt-6">
            <p className="text-caption font-medium tracking-[0.06em] text-fg-muted uppercase">
              Activity
            </p>
            <ol className="mt-3 flex flex-col gap-4">
              {ticket.events.map((e, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    aria-hidden
                    className={cn("mt-1.5 size-2 shrink-0 rounded-pill", eventDot[e.kind])}
                  />
                  <div
                    className={cn(
                      "min-w-0 flex-1",
                      e.internal && "rounded-card bg-warning-subtle px-3 py-2"
                    )}
                  >
                    <p className="text-body-sm text-fg">
                      <span className="font-medium">{e.who}</span>{" "}
                      <span className="text-fg-secondary">— {e.what}</span>
                    </p>
                    <p className="mt-0.5 flex items-center gap-2 font-mono text-caption text-fg-muted">
                      {e.at}
                      {e.internal && (
                        <span className="font-body text-caption font-medium text-warning-text">
                          Internal note · hidden from concierge
                        </span>
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex gap-2">
              <Input
                placeholder="Add internal note (cleaning team only)…"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), submitNote())}
              />
              <Button variant="secondary" size="sm" className="h-11 shrink-0" onClick={submitNote}>
                Note
              </Button>
            </div>
          </div>

          {/* close flow */}
          {closing && (
            <div className="mt-6 rounded-card border border-edge bg-canvas p-4">
              <p className="text-body-sm font-medium text-fg">Close with proof</p>
              <p className="mt-1 text-caption text-fg-muted">
                Pick your name and add at least one after photo — that pair is the client-facing proof.
              </p>
              <div className="mt-3 flex flex-col gap-3">
                <Select
                  placeholder="Closed by…"
                  options={sdSiteStaff.cleaners.map((c) => ({ value: c, label: c }))}
                  value={closeBy}
                  onValueChange={setCloseBy}
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => onAfterFiles(e.target.files)}
                />
                {closePhotos.length > 0 && (
                  <div className="grid grid-cols-3 gap-1.5">
                    {closePhotos.map((u, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={u} alt={`after photo ${i + 1}`} className="aspect-video w-full rounded-sm object-cover" />
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex h-16 w-full flex-col items-center justify-center gap-1 rounded-card border border-dashed border-edge-strong bg-surface text-fg-muted transition-colors hover:bg-hover"
                >
                  <Camera aria-hidden className="size-4" />
                  <span className="text-caption">
                    {closePhotos.length ? `${closePhotos.length} after photo${closePhotos.length > 1 ? "s" : ""} · add more` : "Add after photos (required)"}
                  </span>
                </button>
                <Input
                  placeholder="Resolution note (optional)…"
                  value={closeNote}
                  onChange={(e) => setCloseNote(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setClosing(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" disabled={!closeBy || closePhotos.length === 0} onClick={confirmClose}>
                    Confirm close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-edge px-6 py-4">
          {OPEN_STATUSES.includes(ticket.status) && ticket.status !== "in-progress" ? (
            <Button
              size="sm"
              onClick={() => {
                const by = ticket.assignee ?? sdSiteStaff.cleaners[0] ?? sdSiteStaff.manager;
                attend(ticket.ref, by);
                toast({ tone: "success", title: "Attending", description: `${ticket.ref} → In progress · ${by}` });
              }}
            >
              Attend
            </Button>
          ) : ticket.status === "in-progress" ? (
            <Button size="sm" onClick={() => setClosing(true)} disabled={closing}>
              Close with photos
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                reopen(ticket.ref, ticket.lodgedBy);
                toast({ tone: "warning", title: `${ticket.ref} reopened`, description: "Manager alerted · SLA clock restarted" });
              }}
            >
              Reopen
            </Button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default function ServiceDeskPage() {
  useSdRehydrate();
  const tickets = useSdStore((s) => s.tickets);
  const resetDemo = useSdStore((s) => s.resetDemo);
  const [view, setView] = React.useState("All open");
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [selectedRef, setSelectedRef] = React.useState<string | null>(null);
  const [raiseOpen, setRaiseOpen] = React.useState(false);
  const { toast } = useToast();

  const counts = {
    "All open": tickets.filter((t) => OPEN_STATUSES.includes(t.status)).length,
    "Urgent open": tickets.filter((t) => t.priority === "urgent" && OPEN_STATUSES.includes(t.status)).length,
    "Unattended > 2h": tickets.filter((t) => t.sla.state === "breached" && OPEN_STATUSES.includes(t.status)).length,
    Reopened: tickets.filter((t) => t.status === "reopened").length,
    "Resolved this week": tickets.filter((t) => t.status === "resolved" || t.status === "closed").length,
  } as const;

  const q = query.trim().toLowerCase();
  const matchesQuery = (t: SdTicketLive) =>
    !q ||
    t.ref.toLowerCase().includes(q) ||
    t.category.toLowerCase().includes(q) ||
    t.lodgedBy.toLowerCase().includes(q) ||
    (t.assignee ?? "").toLowerCase().includes(q) ||
    t.locations.some((l) => `${l.level} ${l.area ?? ""}`.toLowerCase().includes(q));
  const visible = tickets.filter((t) => {
    if (!matchesQuery(t)) return false;
    if (view === "Urgent open") return t.priority === "urgent" && OPEN_STATUSES.includes(t.status);
    if (view === "Reopened") return t.status === "reopened";
    if (view === "Resolved this week") return t.status === "resolved" || t.status === "closed";
    if (view === "Unattended > 2h") return t.sla.state === "breached" && OPEN_STATUSES.includes(t.status);
    return status === "all" ? true : t.status === status;
  });

  const openCount = counts["All open"];

  return (
    <>
      <PageHeader
        eyebrow="Service desk"
        title="Tickets"
        description="Concierge-reported cleaning & facilities issues — attended and closed with photo proof."
        actions={
          <>
            <DevMenu>
              <SyncPill />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  resetDemo();
                  toast({ tone: "neutral", title: "Demo data reset" });
                }}
              >
                <RotateCcw aria-hidden /> Reset demo
              </Button>
            </DevMenu>
            <Link
              href="/support"
              className="inline-flex h-11 items-center gap-2 rounded-control border border-edge bg-surface px-4 text-body-sm font-medium text-fg transition-colors hover:bg-hover [&_svg]:size-4"
            >
              <Smartphone aria-hidden /> Mobile app
            </Link>
            <Button
              variant="secondary"
              onClick={() => {
                const url = `${window.location.origin}/support/new`;
                void navigator.clipboard?.writeText(url).catch(() => {});
                toast({ tone: "neutral", title: "Intake link copied", description: "Anyone with the link or QR can lodge — no login" });
              }}
            >
              <Link2 aria-hidden /> Copy intake link
            </Button>
            <Modal open={raiseOpen} onOpenChange={setRaiseOpen}>
              <ModalTrigger asChild>
                <Button>
                  <Plus aria-hidden /> Raise ticket
                </Button>
              </ModalTrigger>
              <ModalContent size="lg">
                <ModalHeader>
                  <ModalTitle>Raise a ticket</ModalTitle>
                  <ModalDescription>
                    Pick, snap, submit — the cleaning team is notified instantly.
                  </ModalDescription>
                </ModalHeader>
                <ModalBody>
                  <RaiseTicketForm onDone={() => setRaiseOpen(false)} />
                </ModalBody>
              </ModalContent>
            </Modal>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Open tickets"
          value={openCount}
          context={`${counts["Urgent open"]} urgent · ${counts.Reopened} reopened`}
          icon={Ticket}
          tone="accent"
        />
        <MetricCard label="Avg time to attend" value="14m" context="Target 45m · this week" icon={Clock} />
        <MetricCard label="Avg time to resolve" value="38m" context="Target 4h · this week" icon={TimerReset} />
        <MetricCard label="SLA compliance" value="94%" context="Last 30 days" icon={UserRound} tone="success" />
      </div>

      <div className="mt-8">
        <FilterBar>
          <SearchInput
            className="w-72"
            placeholder="Search area, ticket, category or reporter…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {(Object.keys(counts) as Array<keyof typeof counts>).map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setView(label)}
              aria-pressed={view === label}
              className={cn(
                "flex items-center gap-2 rounded-pill border px-3.5 py-1.5 text-body-sm transition-colors duration-150",
                view === label
                  ? "border-edge bg-accent-subtle font-medium text-accent-text"
                  : "border-edge bg-surface text-fg-secondary hover:bg-hover"
              )}
            >
              {label}
              <span className="font-mono text-caption text-fg-muted">{counts[label]}</span>
            </button>
          ))}
          <div className="ml-auto">
            <Select
              options={[
                { value: "all", label: "All statuses" },
                { value: "new", label: "New" },
                { value: "open", label: "Open" },
                { value: "in-progress", label: "In progress" },
                { value: "resolved", label: "Resolved" },
                { value: "closed", label: "Closed" },
              ]}
              value={status}
              onValueChange={setStatus}
              className="w-44"
            />
          </div>
        </FilterBar>

        {/* mobile: record cards (audit §23) */}
        <div className="flex flex-col gap-3 md:hidden">
          {visible.map((t: SdTicketLive) => (
            <button
              key={t.ref}
              type="button"
              onClick={() => setSelectedRef(t.ref)}
              className="rounded-card border border-edge bg-surface p-4 text-left shadow-card transition-colors hover:bg-hover"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-body-sm font-semibold text-fg">{t.category}</p>
                <StatusPill tone={sdStatusMeta[t.status].tone}>{sdStatusMeta[t.status].label}</StatusPill>
              </div>
              <p className="mt-0.5 font-mono text-caption text-fg-muted">{t.ref}</p>
              <p className="mt-2 text-body-sm text-fg-secondary">
                {t.locations.map((l) => `${l.level}${l.area ? ` · ${l.area}` : ""}`).join(" + ")} · {t.lodgedBy}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <StatusPill tone={sdPriorityMeta[t.priority].tone}>{sdPriorityMeta[t.priority].label}</StatusPill>
                <SlaChip sla={t.sla} />
              </div>
            </button>
          ))}
        </div>

        <div className="hidden md:block">
        <Table sticky>
          <THead>
            <Tr>
              <Th>Ticket</Th>
              <Th>Location</Th>
              <Th>Lodged by</Th>
              <Th>Priority</Th>
              <Th>SLA</Th>
              <Th>Assignee</Th>
              <Th>Status</Th>
            </Tr>
          </THead>
          <TBody>
            {visible.map((t: SdTicketLive) => (
              <Tr
                key={t.ref}
                className="cursor-pointer transition-colors hover:bg-hover"
                onClick={() => setSelectedRef(t.ref)}
              >
                <Td>
                  <p className="text-body-sm font-semibold text-fg">{t.category}</p>
                  <p className="mt-0.5 font-mono text-caption whitespace-nowrap text-fg-muted">{t.ref}</p>
                </Td>
                <Td>
                  {t.locations.map((l) => (
                    <p key={l.level + (l.area ?? "")} className="text-body-sm text-fg-secondary">
                      <span className="font-mono">{l.level}</span>
                      {l.area ? ` · ${l.area}` : ""}
                    </p>
                  ))}
                </Td>
                <Td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={t.lodgedBy} size="sm" />
                    <div className="leading-tight">
                      <p className="text-body-sm text-fg">{t.lodgedBy}</p>
                      <p className="font-mono text-caption text-fg-muted">{t.createdAt}</p>
                    </div>
                  </div>
                </Td>
                <Td>
                  <StatusPill tone={sdPriorityMeta[t.priority].tone}>
                    {sdPriorityMeta[t.priority].label}
                  </StatusPill>
                </Td>
                <Td>
                  <SlaChip sla={t.sla} />
                </Td>
                <Td>
                  {t.assignee ? (
                    <div className="flex items-center gap-2">
                      <Avatar name={t.assignee} size="sm" />
                      <span className="text-body-sm text-fg">{t.assignee}</span>
                    </div>
                  ) : (
                    <span className="text-body-sm text-fg-muted">—</span>
                  )}
                </Td>
                <Td>
                  <StatusPill tone={sdStatusMeta[t.status].tone}>
                    {sdStatusMeta[t.status].label}
                  </StatusPill>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
        </div>
      </div>

      <TicketDrawer ticketRef={selectedRef} onClose={() => setSelectedRef(null)} />
    </>
  );
}
