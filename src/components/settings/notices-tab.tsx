"use client";

/**
 * Settings → Cleaners & kiosks → Notices.
 *
 * What a cleaner is told when they sign in. Two kinds, one form:
 *   • General  — everyone at the site; also scrolls on the kiosk idle screen.
 *   • Personal — one employee; only ever shown to them, after they sign in.
 *
 * The text is typed once per language on tabs, because a notice nobody can
 * read is not a notice. Editing the wording bumps the version server-side, so
 * anyone who already acknowledged the old text is asked again.
 */
import * as React from "react";
import {
  AlertTriangle,
  CheckCheck,
  Clock,
  Info,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import {
  createNotice,
  demoNotices,
  filledLanguages,
  isCurrent,
  LANGUAGES,
  listNotices,
  setNoticeActive,
  updateNotice,
  type NoticeInput,
  type NoticePriority,
  type NoticeRow,
  type Translated,
} from "@/lib/notices-admin";
import type { StaffRow } from "@/lib/staff-admin";
import { cn } from "@/lib/cn";

const PRIORITY_OPTIONS = [
  { value: "info", label: "Information" },
  { value: "important", label: "Important" },
  { value: "urgent", label: "Urgent" },
];

const priorityTone: Record<NoticePriority, "neutral" | "warning" | "critical"> = {
  info: "neutral",
  important: "warning",
  urgent: "critical",
};

const today = () => new Date().toISOString().slice(0, 10);

function minToTime(min: number | null): string {
  if (min === null) return "";
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
function timeToMin(value: string): number | null {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

const EMPTY: NoticeInput = {
  staffId: null,
  title: {},
  body: {},
  priority: "info",
  startsOn: today(),
  endsOn: null,
  startMin: null,
  endMin: null,
  requiresAck: false,
};

/* ------------------------------------------------------------------ */
/* Write / edit                                                        */
/* ------------------------------------------------------------------ */

function NoticeForm({
  open,
  editing,
  staff,
  onClose,
  onSave,
}: {
  open: boolean;
  editing: NoticeRow | null;
  staff: StaffRow[];
  onClose: () => void;
  onSave: (input: NoticeInput) => Promise<void>;
}) {
  const [input, setInput] = React.useState<NoticeInput>(EMPTY);
  const [lang, setLang] = React.useState<string>("en");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // reset whenever the dialog opens, so a cancelled edit never leaks into the
  // next one
  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setLang("en");
    setInput(
      editing
        ? {
            staffId: editing.staff_id,
            title: { ...editing.title },
            body: { ...editing.body },
            priority: editing.priority,
            startsOn: editing.starts_on,
            endsOn: editing.ends_on,
            startMin: editing.start_min,
            endMin: editing.end_min,
            requiresAck: editing.requires_ack,
          }
        : EMPTY
    );
  }, [open, editing]);

  const setText = (field: "title" | "body", code: string, value: string) =>
    setInput((i) => ({ ...i, [field]: { ...(i[field] as Translated), [code]: value } }));

  const written = filledLanguages(input.body);
  const canSave = written.length > 0 && !busy;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      // drop empty language keys so the database never stores {"hi": ""}
      const clean = (t: Translated): Translated =>
        Object.fromEntries(Object.entries(t).filter(([, v]) => (v ?? "").trim().length > 0));
      await onSave({ ...input, title: clean(input.title), body: clean(input.body) });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()}>
      <ModalContent size="lg">
        <ModalHeader>
          <ModalTitle>{editing ? "Edit notice" : "Write a notice"}</ModalTitle>
        </ModalHeader>
        <ModalBody className="space-y-6">
          {/* who sees it */}
          <div>
            <p className="mb-2 text-body-sm font-medium text-fg">Who sees this?</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setInput((i) => ({ ...i, staffId: null }))}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-control border px-4 text-body-sm transition-colors",
                  input.staffId === null
                    ? "border-accent bg-accent-subtle font-medium text-accent-text"
                    : "border-edge-strong bg-surface text-fg-secondary hover:bg-hover"
                )}
              >
                <Megaphone aria-hidden className="size-4" />
                Everyone at this site
              </button>
              <button
                type="button"
                onClick={() =>
                  setInput((i) => ({ ...i, staffId: i.staffId ?? (staff[0]?.id ?? null) }))
                }
                className={cn(
                  "flex h-11 items-center gap-2 rounded-control border px-4 text-body-sm transition-colors",
                  input.staffId !== null
                    ? "border-accent bg-accent-subtle font-medium text-accent-text"
                    : "border-edge-strong bg-surface text-fg-secondary hover:bg-hover"
                )}
              >
                <UserRound aria-hidden className="size-4" />
                One person
              </button>
            </div>
            {input.staffId !== null && (
              <Select
                className="mt-3"
                aria-label="Employee"
                options={staff.map((s) => ({ value: s.id, label: s.name }))}
                value={input.staffId ?? undefined}
                onValueChange={(v) => setInput((i) => ({ ...i, staffId: v }))}
              />
            )}
            <p className="mt-2 text-caption text-fg-muted">
              {input.staffId === null
                ? "Scrolls on the kiosk screen all day and is shown again after each sign-in."
                : "Shown only to this person, only after they sign in. It is never cached on the tablet."}
            </p>
          </div>

          {/* the text, per language */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-body-sm font-medium text-fg">What does it say?</p>
              <p className="text-caption text-fg-muted">
                {written.length === 0
                  ? "at least one language"
                  : `${written.length} language${written.length > 1 ? "s" : ""}`}
              </p>
            </div>
            <Tabs value={lang} onValueChange={setLang}>
              <TabsList>
                {LANGUAGES.map((l) => (
                  <TabsTrigger key={l.code} value={l.code}>
                    {l.chip}
                    {written.includes(l.code) && (
                      <span aria-hidden className="ml-1.5 size-1.5 rounded-pill bg-accent" />
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
              {LANGUAGES.map((l) => (
                <TabsContent key={l.code} value={l.code} className="space-y-3">
                  <Input
                    label={`Heading — ${l.label} (optional)`}
                    value={input.title[l.code] ?? ""}
                    onChange={(e) => setText("title", l.code, e.target.value)}
                    placeholder={l.code === "en" ? "Loading dock" : ""}
                  />
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor={`body-${l.code}`}
                      className="text-body-sm font-medium text-fg"
                    >
                      Message — {l.label}
                    </label>
                    <textarea
                      id={`body-${l.code}`}
                      rows={4}
                      value={input.body[l.code] ?? ""}
                      onChange={(e) => setText("body", l.code, e.target.value)}
                      placeholder={
                        l.code === "en" ? "Loading dock closed until 06:30 — use Little Collins St." : ""
                      }
                      className="w-full rounded-control border border-edge-strong bg-surface px-3.5 py-2.5 text-body text-fg placeholder:text-fg-disabled"
                    />
                  </div>
                </TabsContent>
              ))}
            </Tabs>
            <p className="mt-2 text-caption text-fg-muted">
              The kiosk cycles through every language you fill in, about six seconds each.
            </p>
          </div>

          {/* when and how loudly */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Priority"
              options={PRIORITY_OPTIONS}
              value={input.priority}
              onValueChange={(v) => setInput((i) => ({ ...i, priority: v as NoticePriority }))}
            />
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2.5 text-body-sm text-fg">
                <input
                  type="checkbox"
                  checked={input.requiresAck}
                  onChange={(e) => setInput((i) => ({ ...i, requiresAck: e.target.checked }))}
                  className="size-4 rounded-sm accent-[var(--accent)]"
                />
                Must tap “I’ve read this”
              </label>
            </div>
            <Input
              label="Show from"
              type="date"
              value={input.startsOn}
              onChange={(e) => setInput((i) => ({ ...i, startsOn: e.target.value }))}
            />
            <Input
              label="Stop showing after (optional)"
              type="date"
              value={input.endsOn ?? ""}
              onChange={(e) => setInput((i) => ({ ...i, endsOn: e.target.value || null }))}
            />
            <Input
              label="Only between (optional)"
              type="time"
              value={minToTime(input.startMin)}
              onChange={(e) => setInput((i) => ({ ...i, startMin: timeToMin(e.target.value) }))}
            />
            <Input
              label="and"
              type="time"
              value={minToTime(input.endMin)}
              onChange={(e) => setInput((i) => ({ ...i, endMin: timeToMin(e.target.value) }))}
            />
          </div>

          {error && <p className="text-body-sm text-critical-text">{error}</p>}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!canSave}>
            {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {editing ? "Save changes" : "Post notice"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

export function NoticesTab({
  buildingId,
  orgId,
  staff,
  live,
}: {
  buildingId: string | null;
  orgId: string | null;
  staff: StaffRow[];
  live: boolean;
}) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<NoticeRow[]>(live ? [] : demoNotices);
  const [loading, setLoading] = React.useState(live);
  const [error, setError] = React.useState<string | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<NoticeRow | null>(null);

  const refresh = React.useCallback(() => {
    if (!live || !buildingId) return;
    setLoading(true);
    listNotices(buildingId)
      .then((r) => {
        setRows(r);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [live, buildingId]);

  React.useEffect(refresh, [refresh]);

  const save = async (input: NoticeInput) => {
    if (!buildingId || !orgId) throw new Error("No site selected");
    if (editing) await updateNotice(editing.id, input);
    else await createNotice(buildingId, orgId, input);
    refresh();
    toast({ tone: "success", title: editing ? "Notice updated" : "Notice posted" });
  };

  const showing = rows.filter((n) => isCurrent(n));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body-sm text-fg-secondary">
          {live
            ? `${showing.length} showing on the kiosk right now. General notices scroll all day; personal ones appear after that person signs in.`
            : "Demo notices. Writing real ones needs the live database."}
        </p>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          disabled={!live || !buildingId}
        >
          <Plus aria-hidden className="size-4" />
          Write a notice
        </Button>
      </div>

      {error && (
        <Card>
          <CardBody className="text-body-sm text-critical-text">{error}</CardBody>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardBody className="flex items-center gap-2 text-body-sm text-fg-muted">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            Loading notices…
          </CardBody>
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No notices yet"
          description="Write the things people need to know when they arrive — a closed loading dock, a changed roster, a new procedure."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((n) => {
            const langs = filledLanguages(n.body);
            const live_now = isCurrent(n);
            return (
              <Card key={n.id} className={cn(!n.active && "opacity-60")}>
                <CardBody className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={n.staff_id ? "neutral" : "accent"}>
                          {n.staff_id ? (n.staff?.name ?? "One person") : "Everyone"}
                        </Badge>
                        <Badge tone={priorityTone[n.priority]}>
                          {n.priority === "urgent" && (
                            <AlertTriangle aria-hidden className="mr-1 size-3" />
                          )}
                          {n.priority}
                        </Badge>
                        {n.requires_ack && (
                          <Badge tone="neutral">
                            <CheckCheck aria-hidden className="mr-1 size-3" />
                            must acknowledge
                          </Badge>
                        )}
                        {!n.active ? (
                          <Badge tone="neutral">off</Badge>
                        ) : live_now ? (
                          <Badge tone="success">showing now</Badge>
                        ) : (
                          <Badge tone="neutral">scheduled</Badge>
                        )}
                      </div>
                      {n.title.en && (
                        <p className="mt-2 font-medium text-fg">{n.title.en}</p>
                      )}
                      <p className="mt-1 text-body-sm text-fg-secondary">
                        {n.body.en ?? n.body[langs[0] ?? "en"]}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-fg-muted">
                    <span className="flex items-center gap-1.5">
                      <Info aria-hidden className="size-3.5" />
                      {langs.map((c) => LANGUAGES.find((l) => l.code === c)?.chip).join(" · ")}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock aria-hidden className="size-3.5" />
                      {n.starts_on}
                      {n.ends_on ? ` → ${n.ends_on}` : " → ongoing"}
                      {n.start_min !== null &&
                        ` · ${minToTime(n.start_min)}–${minToTime(n.end_min)}`}
                    </span>
                    {n.version > 1 && <span>v{n.version}</span>}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!live}
                      onClick={() => {
                        setEditing(n);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil aria-hidden className="size-4" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!live}
                      onClick={() => {
                        setNoticeActive(n.id, !n.active)
                          .then(refresh)
                          .catch((e: Error) =>
                            toast({ tone: "critical", title: "Couldn’t update", description: e.message })
                          );
                      }}
                    >
                      {n.active ? "Turn off" : "Turn on"}
                    </Button>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <NoticeForm
        open={formOpen}
        editing={editing}
        staff={staff}
        onClose={() => setFormOpen(false)}
        onSave={save}
      />
    </div>
  );
}
