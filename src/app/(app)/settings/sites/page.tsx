"use client";

/**
 * Settings → Sites.
 *
 * The building record itself: what it's called, where it is, what time it
 * thinks it is, and which language the kiosk leads with. Timezone is not
 * decoration — every "today" in attendance is evaluated in the site's zone, so
 * a 6am start is the right day even though UTC disagrees.
 *
 * Creating a NEW site is still a one-time SQL step (supabase/NEW_BUILDING.sql)
 * because it also creates organisations and memberships. This screen edits the
 * sites you already have.
 */
import * as React from "react";
import { Building2, Globe, Info, Loader2, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useSessionStore } from "@/lib/session";
import {
  LANGUAGES,
  listSites,
  NOTICES_LIVE,
  TIMEZONES,
  updateSite,
  type SiteRow,
} from "@/lib/notices-admin";
import { building as demoBuilding } from "@/lib/demo-data";

const demoSites: SiteRow[] = [
  {
    id: "demo",
    name: demoBuilding.name,
    slug: "aurora-on-collins",
    address: "380 Collins Street, Melbourne VIC 3000",
    timezone: "Australia/Melbourne",
    default_language: "en",
  },
];

function SiteCard({ site, live, onSaved }: { site: SiteRow; live: boolean; onSaved: () => void }) {
  const { toast } = useToast();
  const [draft, setDraft] = React.useState(site);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => setDraft(site), [site]);

  const dirty =
    draft.name !== site.name ||
    draft.address !== site.address ||
    draft.timezone !== site.timezone ||
    draft.default_language !== site.default_language;

  const save = () => {
    setBusy(true);
    updateSite(site.id, {
      name: draft.name,
      address: draft.address,
      timezone: draft.timezone,
      default_language: draft.default_language,
    })
      .then(() => {
        toast({ tone: "success", title: "Site updated" });
        onSaved();
      })
      .catch((e: Error) =>
        toast({ tone: "critical", title: "Couldn’t save", description: e.message })
      )
      .finally(() => setBusy(false));
  };

  return (
    <Card>
      <CardBody className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-control bg-accent-subtle">
              <Building2 aria-hidden className="size-5 text-accent-text" />
            </span>
            <div>
              <p className="font-medium text-fg">{site.name}</p>
              <p className="font-mono text-caption text-fg-muted">{site.slug}</p>
            </div>
          </div>
          <Badge tone="neutral">{site.timezone.split("/")[1]?.replace("_", " ")}</Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Site name"
            value={draft.name}
            disabled={!live}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
          <Input
            label="Address"
            value={draft.address}
            disabled={!live}
            onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
          />
          <Select
            label="Timezone"
            options={TIMEZONES.map((t) => ({ value: t, label: t.replace("_", " ") }))}
            value={draft.timezone}
            disabled={!live}
            onValueChange={(v) => setDraft((d) => ({ ...d, timezone: v }))}
          />
          <Select
            label="Kiosk leads with"
            options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
            value={draft.default_language}
            disabled={!live}
            onValueChange={(v) => setDraft((d) => ({ ...d, default_language: v }))}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-caption text-fg-muted">
            <MapPin aria-hidden className="size-3.5" />
            Attendance days, rosters and notice windows are all read in this timezone.
          </p>
          <Button onClick={save} disabled={!live || !dirty || busy}>
            {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

export default function SitesPage() {
  const profile = useSessionStore((s) => s.profile);
  const live = NOTICES_LIVE && Boolean(profile);
  const [sites, setSites] = React.useState<SiteRow[]>(live ? [] : demoSites);
  const [loading, setLoading] = React.useState(live);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => {
    if (!live) return;
    setLoading(true);
    listSites()
      .then((r) => {
        setSites(r);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [live]);

  React.useEffect(refresh, [refresh]);

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Sites"
        description="The buildings you service — their address, their clock, and the language the kiosk leads with."
      />

      <Card className="mb-6">
        <CardBody className="flex gap-3 text-body-sm text-fg-secondary">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-text" />
          <span>
            {live ? (
              <>
                Adding a <span className="font-medium text-fg">new</span> site also creates the
                organisations and memberships behind it, so it is still a one-time SQL step —
                paste <span className="font-mono">supabase/NEW_BUILDING.sql</span>. Everything
                below is editable here.
              </>
            ) : (
              <>
                <span className="font-medium text-fg">Demo mode.</span> Sign in with a live
                database to edit real sites.
              </>
            )}
          </span>
        </CardBody>
      </Card>

      {error && (
        <Card className="mb-6">
          <CardBody className="text-body-sm text-critical-text">{error}</CardBody>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardBody className="flex items-center gap-2 text-body-sm text-fg-muted">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            Loading sites…
          </CardBody>
        </Card>
      ) : sites.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No sites yet"
          description="Run supabase/NEW_BUILDING.sql to create your first building, then refresh."
        />
      ) : (
        <div className="grid gap-5">
          {sites.map((s) => (
            <SiteCard key={s.id} site={s} live={live} onSaved={refresh} />
          ))}
        </div>
      )}
    </>
  );
}
