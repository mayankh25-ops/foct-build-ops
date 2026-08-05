"use client";

/**
 * Settings → System health.
 *
 * The screen that answers "why isn't it working?" without anybody opening a
 * browser console. It names the tables and functions the database is missing,
 * names the file that fixes each one, and puts them in the order they must be
 * run — the repair script before the bundle, because the other way round the
 * bundle succeeds and changes nothing.
 *
 * It is also careful to separate BROKEN from EMPTY. A brand-new project with no
 * sites is working perfectly; it just has nothing in it yet. Treating those two
 * the same is what turned an empty database into four screens that spun.
 */
import * as React from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Copy,
  Database,
  FileCode2,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import {
  fetchHealth,
  HEALTH_LIVE,
  remedySteps,
  verdict,
  type Health,
} from "@/lib/health-live";

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-edge bg-canvas px-4 py-3">
      <Icon aria-hidden className="size-4 shrink-0 text-fg-muted" />
      <div className="min-w-0">
        <p className="font-numeric text-title-3 tabular-nums text-fg">{value}</p>
        <p className="text-caption text-fg-muted">{label}</p>
      </div>
    </div>
  );
}

/** A list of names the database is missing — short enough to read, not a dump. */
function Missing({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-body-sm font-medium text-fg">
        {title} <span className="text-fg-muted">({items.length})</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((n) => (
          <span
            key={n}
            className="rounded-control bg-hover px-2 py-1 font-mono text-caption text-fg-secondary"
          >
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function HealthPage() {
  const { toast } = useToast();
  const [health, setHealth] = React.useState<Health | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    setLoading(true);
    // fetchHealth never rejects — "we couldn't ask" is itself a result, and
    // this page must render it rather than becoming another blank screen
    fetchHealth()
      .then(setHealth)
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(load, [load]);

  if (!HEALTH_LIVE) {
    return (
      <>
        <PageHeader
          eyebrow="Settings"
          title="System health"
          description="Whether your database has everything this version of the app needs."
        />
        <Card>
          <CardBody className="text-body-sm text-fg-secondary">
            Demo mode — there is no database to check. Set{" "}
            <span className="font-mono">NEXT_PUBLIC_SUPABASE_URL</span> and{" "}
            <span className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</span> to connect one.
          </CardBody>
        </Card>
      </>
    );
  }

  const v = health ? verdict(health) : null;
  const steps = health ? remedySteps(health) : [];

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="System health"
        description="Whether your database has everything this version of the app needs — and exactly what to run if it doesn't."
        actions={
          <Button variant="secondary" onClick={load} disabled={loading}>
            {loading ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <RefreshCw aria-hidden className="size-4" />
            )}
            Check again
          </Button>
        }
      />

      {loading && !health ? (
        <Card>
          <CardBody className="flex items-center gap-2 text-body-sm text-fg-muted">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            Checking your database…
          </CardBody>
        </Card>
      ) : !health ? null : (
        <div className="grid gap-5">
          {/* the verdict, in one sentence */}
          <Card>
            <CardBody className="flex items-start gap-3">
              {v!.tone === "success" ? (
                <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-success-text" />
              ) : (
                <AlertTriangle
                  aria-hidden
                  className={
                    v!.tone === "critical"
                      ? "mt-0.5 size-5 shrink-0 text-critical-text"
                      : "mt-0.5 size-5 shrink-0 text-warning-text"
                  }
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-title-3 text-fg">{v!.line}</p>
                {health.error && (
                  <p className="mt-1 font-mono text-caption break-words text-fg-muted">
                    {health.error}
                  </p>
                )}
              </div>
              <Badge tone={v!.tone === "success" ? "success" : v!.tone === "warning" ? "warning" : "critical"}>
                {health.ok ? "up to date" : "needs attention"}
              </Badge>
            </CardBody>
          </Card>

          {/* what to do about it */}
          {steps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>What to do</CardTitle>
              </CardHeader>
              <CardBody className="flex flex-col gap-4">
                <p className="text-body-sm text-fg-secondary">
                  Open your Supabase project → SQL Editor, then run these in order. Every one of
                  them is safe to run more than once.
                </p>
                {steps.map((s, i) => (
                  <div key={s.title} className="flex gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-pill bg-accent-subtle font-numeric text-caption text-accent-text">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-body-sm font-medium text-fg">{s.title}</p>
                      <p className="mt-0.5 text-body-sm text-fg-secondary">{s.detail}</p>
                      {s.file && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1.5 rounded-control bg-hover px-2 py-1 font-mono text-caption text-fg-secondary">
                            <FileCode2 aria-hidden className="size-3.5" />
                            {s.file}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              void navigator.clipboard.writeText(s.file!);
                              toast({ tone: "neutral", title: "Filename copied" });
                            }}
                          >
                            <Copy aria-hidden className="size-3.5" />
                            Copy name
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          {/* what's in there — the empty-vs-broken answer */}
          <Card>
            <CardHeader>
              <CardTitle>What's set up</CardTitle>
            </CardHeader>
            <CardBody className="grid gap-3 sm:grid-cols-3">
              <Stat label="Sites" value={health.counts.buildings} icon={Building2} />
              <Stat label="Cleaners" value={health.counts.staff} icon={Users} />
              <Stat label="Kiosk tablets" value={health.counts.kiosks} icon={Database} />
            </CardBody>
          </Card>

          {(health.missingColumns.length > 0 ||
            health.missingTables.length > 0 ||
            health.missingFunctions.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Detail</CardTitle>
              </CardHeader>
              <CardBody className="flex flex-col gap-5">
                <Missing title="Columns your project never got" items={health.missingColumns} />
                <Missing title="Missing tables" items={health.missingTables} />
                <Missing title="Missing functions" items={health.missingFunctions} />
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
