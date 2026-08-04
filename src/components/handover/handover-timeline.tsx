"use client";

/**
 * The handover timeline: every note, who wrote it, and exactly when.
 *
 * Grouped by the building's own day, newest first, with the exact clock time on
 * every entry — "3h ago" alone is useless the moment somebody reads this a week
 * later asking why the dock was closed. History pages backwards rather than
 * being truncated to the last five.
 */
import * as React from "react";
import { AlertTriangle, History, Loader2, Lock, Send, Trash2 } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  addHandover,
  dayHeading,
  fetchHandover,
  groupByDay,
  noteTime,
  relative,
  withdrawHandover,
  type HandoverNote,
} from "@/lib/handover-live";
import { cn } from "@/lib/cn";

export function HandoverTimeline({
  buildingId,
  orgName,
}: {
  buildingId: string;
  /** named in the privacy line, because "private" means nothing without a who */
  orgName?: string;
}) {
  const { toast } = useToast();
  const [notes, setNotes] = React.useState<HandoverNote[]>([]);
  const [timezone, setTimezone] = React.useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [text, setText] = React.useState("");
  const [important, setImportant] = React.useState(false);

  const load = React.useCallback(() => {
    fetchHandover(buildingId)
      .then((p) => {
        setNotes(p.notes);
        setTimezone(p.timezone);
        setHasMore(p.has_more);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [buildingId]);

  React.useEffect(load, [load]);

  const older = async () => {
    const last = notes[notes.length - 1];
    if (!last) return;
    setBusy(true);
    try {
      const page = await fetchHandover(buildingId, last.created_at);
      setNotes((n) => [...n, ...page.notes]);
      setHasMore(page.has_more);
    } catch (e) {
      toast({ tone: "critical", title: "Couldn't load more", description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const post = async () => {
    if (!text.trim()) return;
    setBusy(true);
    const res = await addHandover(buildingId, text, important ? "important" : "info");
    setBusy(false);
    if (!res.ok) {
      toast({ tone: "critical", title: "Not saved", description: res.error });
      return;
    }
    setText("");
    setImportant(false);
    load();
  };

  const withdraw = async (n: HandoverNote) => {
    const res = await withdrawHandover(n.id);
    if (!res.ok) {
      toast({ tone: "warning", title: "Not withdrawn", description: res.error });
      return;
    }
    toast({ tone: "neutral", title: "Note withdrawn" });
    load();
  };

  const days = groupByDay(notes);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Shift handover</CardTitle>
          <p className="mt-1 flex items-center gap-1.5 text-body-sm text-fg-muted">
            <Lock aria-hidden className="size-3.5" />
            {orgName ? `Private to ${orgName}` : "Private to your organisation"} — kept, not
            overwritten
          </p>
        </div>
        <History aria-hidden className="size-5 text-fg-muted" />
      </CardHeader>

      <CardBody className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end gap-2">
          <Input
            className="min-w-56 flex-1"
            label="New note"
            placeholder="What the next shift needs to know…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void post()}
          />
          <Button
            variant={important ? "primary" : "secondary"}
            onClick={() => setImportant((v) => !v)}
            aria-pressed={important}
          >
            <AlertTriangle aria-hidden className="size-4" />
            Important
          </Button>
          <Button disabled={busy || !text.trim()} onClick={() => void post()}>
            {busy ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <Send aria-hidden className="size-4" />
            )}
            Post
          </Button>
        </div>

        {error && <p className="text-body-sm text-critical-text">{error}</p>}

        {loading ? (
          <p className="flex items-center gap-2 text-body-sm text-fg-muted">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            Loading the handover…
          </p>
        ) : notes.length === 0 ? (
          <p className="rounded-card border border-edge bg-canvas px-4 py-6 text-center text-body-sm text-fg-muted">
            Nothing handed over yet. The first note starts the log.
          </p>
        ) : (
          days.map((day) => (
            <div key={day.date} className="flex flex-col gap-4">
              <p className="text-caption font-medium tracking-[0.06em] text-fg-muted uppercase">
                {dayHeading(day.date, new Date(), timezone)}
              </p>

              {day.notes.map((n) => (
                <div key={n.id} className="flex items-start gap-3">
                  {/* the spine: a dot per entry, so a day reads as a sequence */}
                  <Avatar name={n.author} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-2 text-body-sm">
                      <span className="font-medium text-fg">{n.author}</span>
                      <span className="font-numeric tabular-nums text-fg-muted">
                        {noteTime(n.created_at, timezone)}
                      </span>
                      <span className="text-caption text-fg-muted">{relative(n.created_at)}</span>
                      {n.kind === "important" && <Badge tone="warning">important</Badge>}
                      {n.mine && !n.deleted && <Badge tone="neutral">you</Badge>}
                    </p>
                    {n.deleted ? (
                      <p className="mt-0.5 text-body-sm text-fg-muted italic">
                        {/* a gap nobody can account for is worse than this line */}
                        Note withdrawn by its author
                      </p>
                    ) : (
                      <p
                        className={cn(
                          "mt-0.5 text-body-sm whitespace-pre-wrap",
                          n.kind === "important" ? "text-fg" : "text-fg-secondary"
                        )}
                      >
                        {n.body}
                      </p>
                    )}
                  </div>
                  {n.can_delete && (
                    <Button variant="ghost" size="sm" onClick={() => void withdraw(n)}>
                      <Trash2 aria-hidden className="size-4" />
                      Withdraw
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ))
        )}

        {hasMore && (
          <Button variant="secondary" disabled={busy} onClick={() => void older()}>
            {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
            Load earlier notes
          </Button>
        )}
      </CardBody>
    </Card>
  );
}
