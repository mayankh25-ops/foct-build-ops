"use client";

/**
 * Alert settings for one site: how long is late, who hears about it.
 *
 * Deliberately small. The only decisions worth making here are the grace
 * period, whether a forgotten sign-out is worth chasing, and the recipients —
 * everything else about alerting is a rule in the database, not a preference.
 */
import * as React from "react";
import { BellRing, Loader2, MailWarning } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  fetchAlertSettings,
  parseEmails,
  saveAlertSettings,
  type AlertSettings,
} from "@/lib/alerts-live";

const GRACE = [0, 5, 10, 15, 20, 30, 45, 60];
const OVERDUE = [30, 60, 90, 120, 180, 240];

export function AlertSettingsCard({ buildingId, siteName }: { buildingId: string; siteName: string }) {
  const { toast } = useToast();
  const [s, setS] = React.useState<AlertSettings | null>(null);
  const [emails, setEmails] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchAlertSettings(buildingId)
      .then((res) => {
        setS(res);
        setEmails(res.notify_emails.join(", "));
      })
      .catch((e: Error) => setError(e.message));
  }, [buildingId]);

  if (error) {
    return (
      <Card>
        <CardBody className="text-body-sm text-critical-text">{error}</CardBody>
      </Card>
    );
  }
  if (!s) return null;

  const save = async () => {
    setBusy(true);
    const res = await saveAlertSettings({
      buildingId,
      enabled: s.enabled,
      graceMin: s.grace_min,
      overdueAfterMin: s.overdue_after_min,
      raiseOverdue: s.raise_overdue,
      emails: parseEmails(emails),
    });
    setBusy(false);
    if (!res.ok) {
      toast({ tone: "critical", title: "Not saved", description: res.error });
      return;
    }
    toast({
      tone: "success",
      title: "Alert settings saved",
      description:
        parseEmails(emails).length === 0
          ? "Alerts will show on Today but nobody will be emailed."
          : undefined,
    });
  };

  return (
    <Card>
      <CardBody className="space-y-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-control bg-accent-subtle">
            <BellRing aria-hidden className="size-5 text-accent-text" />
          </span>
          <div>
            <p className="font-medium text-fg">Missed check-in alerts</p>
            <p className="text-caption text-fg-muted">{siteName}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Alerts"
            options={[
              { value: "on", label: "On" },
              { value: "off", label: "Off" },
            ]}
            value={s.enabled ? "on" : "off"}
            onValueChange={(v) => setS({ ...s, enabled: v === "on" })}
          />
          <Select
            label="Someone is missing after"
            options={GRACE.map((g) => ({ value: String(g), label: g === 0 ? "their start time" : `${g} minutes` }))}
            value={String(s.grace_min)}
            onValueChange={(v) => setS({ ...s, grace_min: Number(v) })}
          />
          <Select
            label="Chase a forgotten sign-out"
            options={[
              { value: "on", label: "Yes" },
              { value: "off", label: "No" },
            ]}
            value={s.raise_overdue ? "on" : "off"}
            onValueChange={(v) => setS({ ...s, raise_overdue: v === "on" })}
          />
          <Select
            label="…after the shift ended by"
            options={OVERDUE.map((o) => ({ value: String(o), label: `${o} minutes` }))}
            value={String(s.overdue_after_min)}
            disabled={!s.raise_overdue}
            onValueChange={(v) => setS({ ...s, overdue_after_min: Number(v) })}
          />
        </div>

        <Input
          label="Email these people"
          placeholder="ops@example.com, supervisor@example.com"
          hint="Separate with commas. Leave empty and alerts still appear on Today — nobody is emailed."
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-caption text-fg-muted">
            <MailWarning aria-hidden className="size-3.5" />
            Sends go through this organisation&rsquo;s active email provider, and each alert is
            emailed once.
          </p>
          <Button onClick={() => void save()} disabled={busy}>
            {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
            Save alert settings
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
