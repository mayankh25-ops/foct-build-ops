"use client";

/**
 * Open attendance alerts, above today's board.
 *
 * These are the same rows the scheduled job emails, read back — so the screen
 * and the inbox always say the same thing. Acknowledging closes an alert with a
 * name and a reason on it; nobody can make one disappear silently.
 */
import * as React from "react";
import { AlertTriangle, BellRing, Check, Loader2, MailWarning, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  ackAlert,
  alertLine,
  deliveryNote,
  fetchOpenAlerts,
  scanNow,
  type OpenAlert,
} from "@/lib/alerts-live";
import { cn } from "@/lib/cn";

export function AlertStrip({
  buildingId,
  date,
  onChanged,
}: {
  buildingId: string;
  date: string;
  /** the day board reloads too, so a resolved alert and its row agree */
  onChanged?: () => void;
}) {
  const { toast } = useToast();
  const [alerts, setAlerts] = React.useState<OpenAlert[]>([]);
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState<string | null>(null);
  const [scanning, setScanning] = React.useState(false);

  const load = React.useCallback(() => {
    fetchOpenAlerts(buildingId, date)
      .then(setAlerts)
      // a failure here must not take the day board down with it
      .catch(() => setAlerts([]));
  }, [buildingId, date]);

  React.useEffect(load, [load]);

  const acknowledge = async (a: OpenAlert) => {
    setBusy(a.id);
    const res = await ackAlert(a.id, notes[a.id] ?? "");
    setBusy(null);
    if (!res.ok) {
      toast({ tone: "critical", title: "Not saved", description: res.error });
      return;
    }
    toast({ tone: "neutral", title: `Acknowledged — ${a.staff_name}` });
    load();
    onChanged?.();
  };

  const check = async () => {
    setScanning(true);
    const res = await scanNow(buildingId);
    setScanning(false);
    if (!res.ok) {
      toast({ tone: "critical", title: "Could not check", description: res.error });
      return;
    }
    toast({
      tone: (res.raised ?? 0) > 0 ? "warning" : "success",
      title:
        (res.raised ?? 0) > 0
          ? `${res.raised} new alert${res.raised === 1 ? "" : "s"}`
          : "Nothing new — everyone is accounted for",
      description: (res.resolved ?? 0) > 0 ? `${res.resolved} resolved themselves` : undefined,
    });
    load();
    onChanged?.();
  };

  if (alerts.length === 0) {
    return (
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <p className="flex items-center gap-2 text-body-sm text-fg-muted">
          <BellRing aria-hidden className="size-4" />
          No open alerts.
        </p>
        <Button variant="ghost" size="sm" disabled={scanning} onClick={() => void check()}>
          {scanning ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : (
            <RefreshCw aria-hidden className="size-4" />
          )}
          Check now
        </Button>
      </div>
    );
  }

  return (
    <Card className="mb-6 border-critical">
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-medium text-fg">
            <AlertTriangle aria-hidden className="size-4 text-critical-text" />
            {alerts.length} open alert{alerts.length === 1 ? "" : "s"}
          </p>
          <Button variant="ghost" size="sm" disabled={scanning} onClick={() => void check()}>
            {scanning ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <RefreshCw aria-hidden className="size-4" />
            )}
            Check now
          </Button>
        </div>

        {alerts.map((a) => (
          <div
            key={a.id}
            className="flex flex-wrap items-end gap-3 border-t border-edge pt-4 first:border-t-0 first:pt-0"
          >
            <div className="min-w-56 flex-1">
              <p className="font-medium text-fg">{alertLine(a)}</p>
              <p
                className={cn(
                  "mt-0.5 flex items-center gap-1.5 text-caption",
                  a.notify_error ? "text-critical-text" : "text-fg-muted"
                )}
              >
                {a.notify_error && <MailWarning aria-hidden className="size-3" />}
                {deliveryNote(a, true)}
                <Badge tone={a.kind === "missed" ? "critical" : "warning"} className="ml-1">
                  {a.kind === "missed" ? "no check-in" : "no sign-out"}
                </Badge>
              </p>
            </div>
            <Input
              className="min-w-48 flex-1"
              label="What happened?"
              placeholder="e.g. called her, running 20 minutes late"
              value={notes[a.id] ?? ""}
              onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
            />
            <Button
              variant="secondary"
              disabled={busy === a.id}
              onClick={() => void acknowledge(a)}
            >
              {busy === a.id ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <Check aria-hidden className="size-4" />
              )}
              Acknowledge
            </Button>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
