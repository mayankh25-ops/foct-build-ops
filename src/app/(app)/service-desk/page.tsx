"use client";

import * as React from "react";
import Link from "next/link";
import {
  Camera,
  Clock,
  FileText,
  Link2,
  Plus,
  QrCode,
  ThumbsDown,
  ThumbsUp,
  Ticket,
  TimerReset,
  UserRound,
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
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import {
  sdMetrics,
  sdPriorityMeta,
  sdSavedViews,
  sdStatusMeta,
  sdTickets,
  type SdTicket,
} from "@/lib/service-desk-data";
import { cn } from "@/lib/cn";

function SlaChip({ sla }: { sla: SdTicket["sla"] }) {
  if (sla.state === "met")
    return <StatusPill tone="success">Met · {sla.toResolve}</StatusPill>;
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

function TicketDrawer({
  ticket,
  onClose,
}: {
  ticket: SdTicket | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  return (
    <Drawer open={!!ticket} onOpenChange={(o) => !o && onClose()}>
      {ticket && (
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
                  <p className="mt-2 text-body-sm text-fg-muted">Unassigned</p>
                )}
              </div>
            </div>

            {/* before / after — the money shot */}
            <div className="mt-5">
              <p className="text-caption font-medium tracking-[0.06em] text-fg-muted uppercase">
                Photos
              </p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {(["before", "after"] as const).map((kind) => {
                  const n = kind === "before" ? ticket.photosBefore : ticket.photosAfter;
                  return (
                    <div
                      key={kind}
                      className={cn(
                        "flex aspect-video flex-col items-center justify-center gap-1.5 rounded-card",
                        n > 0 ? "bg-accent-subtle" : "border border-dashed border-edge-strong bg-canvas"
                      )}
                    >
                      <Camera aria-hidden className={cn("size-4", n > 0 ? "text-accent-text" : "text-fg-muted")} />
                      <p className={cn("text-caption tracking-[0.06em] uppercase", n > 0 ? "text-accent-text" : "text-fg-muted")}>
                        {kind} · {n > 0 ? `${n} photo${n > 1 ? "s" : ""}` : "pending"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* proof PDF + CSAT */}
            {(ticket.pdf || ticket.csat) && (
              <div className="mt-4 flex items-center gap-3">
                {ticket.pdf && (
                  <button
                    type="button"
                    onClick={() => toast({ tone: "neutral", title: "Download starts in the live build", description: ticket.pdf })}
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

            {/* followers */}
            {ticket.followers.length > 0 && (
              <div className="mt-5">
                <p className="text-caption font-medium tracking-[0.06em] text-fg-muted uppercase">
                  Followers · closure email
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ticket.followers.map((f) => (
                    <Badge key={f} tone="neutral">
                      {f}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

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
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-edge px-6 py-4">
            {ticket.status === "new" || ticket.status === "open" || ticket.status === "reopened" ? (
              <>
                <Button variant="secondary" size="sm">
                  Reassign
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    toast({ tone: "success", title: "Marked attending", description: `${ticket.ref} → In progress` })
                  }
                >
                  Attend
                </Button>
              </>
            ) : ticket.status === "in-progress" ? (
              <>
                <Button variant="secondary" size="sm">
                  Add internal note
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    toast({ tone: "success", title: "After photos required", description: "Upload at least 1 photo to close" })
                  }
                >
                  Close with photos
                </Button>
              </>
            ) : (
              <Button variant="secondary" size="sm">
                Reopen
              </Button>
            )}
          </div>
        </DrawerContent>
      )}
    </Drawer>
  );
}

export default function ServiceDeskPage() {
  const [view, setView] = React.useState("All open");
  const [status, setStatus] = React.useState("all");
  const [selected, setSelected] = React.useState<SdTicket | null>(null);
  const { toast } = useToast();

  const openStatuses = ["new", "open", "in-progress", "reopened"];
  const visible = sdTickets.filter((t) => {
    if (view === "Urgent open") return t.priority === "urgent" && openStatuses.includes(t.status);
    if (view === "Reopened") return t.status === "reopened";
    if (view === "Resolved this week") return t.status === "resolved" || t.status === "closed";
    if (view === "Unattended > 2h") return false;
    // All open
    return status === "all" ? true : t.status === status;
  });

  return (
    <>
      <PageHeader
        eyebrow="Service desk"
        title="Tickets"
        description="Concierge-reported cleaning & facilities issues — attended and closed with photo proof."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                toast({ tone: "neutral", title: "Intake link copied", description: "Anyone with the link or QR can lodge — no login" })
              }
            >
              <Link2 aria-hidden /> Copy intake link
            </Button>
            <Link
              href="/service-desk/new"
              className="inline-flex h-11 items-center gap-2 rounded-control bg-accent px-5 font-medium text-on-accent transition-colors hover:bg-accent-hover [&_svg]:size-4"
            >
              <Plus aria-hidden /> Raise ticket
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Open tickets" value={sdMetrics.openTickets} context="1 urgent · 1 reopened" icon={Ticket} tone="accent" />
        <MetricCard label="Avg time to attend" value={sdMetrics.avgAttend} context="Target 45m · this week" icon={Clock} />
        <MetricCard label="Avg time to resolve" value={sdMetrics.avgResolve} context="Target 4h · this week" icon={TimerReset} />
        <MetricCard label="SLA compliance" value={sdMetrics.slaCompliance} context="Last 30 days" icon={UserRound} tone="success" />
      </div>

      {/* public intake strip */}
      <Card className="mt-6">
        <CardBody className="flex flex-wrap items-center gap-4 py-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-card bg-accent-subtle">
            <QrCode aria-hidden className="size-5 text-accent-text" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-body-sm font-medium text-fg">Public intake form — QR &amp; link</p>
            <p className="text-body-sm text-fg-muted">
              Anyone with the site QR or link can lodge on this form — concierge desk, cleaning team, or
              a tenant rep. No password; the form is scoped to Aurora on Collins.
            </p>
          </div>
          <Badge tone="info">Per-site form · org-configurable</Badge>
        </CardBody>
      </Card>

      <div className="mt-8">
        <FilterBar>
          {sdSavedViews.map((v) => (
            <button
              key={v.label}
              type="button"
              onClick={() => setView(v.label)}
              aria-pressed={view === v.label}
              className={cn(
                "flex items-center gap-2 rounded-pill border px-3.5 py-1.5 text-body-sm transition-colors duration-150",
                view === v.label
                  ? "border-edge bg-accent-subtle font-medium text-accent-text"
                  : "border-edge bg-surface text-fg-secondary hover:bg-hover"
              )}
            >
              {v.label}
              <span className="font-mono text-caption text-fg-muted">{v.count}</span>
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

        <Table>
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
            {visible.map((t) => (
              <Tr
                key={t.ref}
                className="cursor-pointer transition-colors hover:bg-hover"
                onClick={() => setSelected(t)}
              >
                <Td>
                  <p className="font-mono text-body-sm text-fg">{t.ref}</p>
                  <p className="mt-0.5 text-body-sm font-medium text-fg">{t.category}</p>
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

      <TicketDrawer ticket={selected} onClose={() => setSelected(null)} />
    </>
  );
}
