"use client";

/**
 * Settings → Sites.
 *
 * The building record itself: what it's called, where it is, what time it
 * thinks it is, and which language the kiosk leads with. Timezone is not
 * decoration — every "today" in attendance is evaluated in the site's zone, so
 * a 6am start is the right day even though UTC disagrees.
 *
 * Adding a site used to mean editing supabase/NEW_BUILDING.sql and pasting it
 * into the SQL editor, which a supervisor cannot do. It is a form now (0017):
 * `site_create()` makes the building, the organisations, the cross-org grants,
 * the module switches and the caller's own membership in one transaction.
 *
 * The empty state matters as much as the form. With no sites, four other
 * screens have nothing to load — so this page has to say "add your first site"
 * rather than leaving somebody staring at a spinner elsewhere.
 */
import * as React from "react";
import {
  Building2,
  Globe,
  HeartPulse,
  Info,
  Loader2,
  MapPin,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";

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
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { AlertSettingsCard } from "@/components/roster/alert-settings-card";
import { refreshProfile, useSessionStore } from "@/lib/session";
import {
  createSite,
  deleteSite,
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

/* ------------------------------------------------------------ new site ---- */

function NewSiteModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [timezone, setTimezone] = React.useState("Australia/Melbourne");
  const [language, setLanguage] = React.useState("en");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setName("");
      setAddress("");
      setTimezone("Australia/Melbourne");
      setLanguage("en");
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    if (name.trim().length < 2) return;
    setBusy(true);
    setError(null);
    const res = await createSite({ name: name.trim(), address: address.trim(), timezone, language });
    setBusy(false);
    if (!res.ok) {
      // stays in the form, next to the field they'd change — a toast that
      // disappears is no use when the message is "that isn't a timezone"
      setError(res.error);
      return;
    }
    // the profile carries the buildings every other screen reads, so it has to
    // be refetched here or the new site exists and nothing can see it
    await refreshProfile();
    toast({ tone: "success", title: `${name.trim()} added` });
    onOpenChange(false);
    onCreated();
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="lg">
        <ModalHeader>
          <ModalTitle>Add a site</ModalTitle>
        </ModalHeader>
        <ModalBody className="space-y-5">
          <p className="text-body-sm text-fg-secondary">
            This creates the building, switches on cleaning and the service desk, and gives you
            and your colleagues access to it. You can change any of it afterwards.
          </p>

          <Input
            label="Site name"
            placeholder="Aurora on Collins"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
          />
          <Input
            label="Address"
            placeholder="380 Collins Street, Melbourne VIC 3000"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Timezone"
              options={TIMEZONES.map((t) => ({ value: t, label: t.replace("_", " ") }))}
              value={timezone}
              onValueChange={setTimezone}
            />
            <Select
              label="Kiosk leads with"
              options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
              value={language}
              onValueChange={setLanguage}
            />
          </div>
          <p className="flex items-center gap-1.5 text-caption text-fg-muted">
            <MapPin aria-hidden className="size-3.5" />
            Every shift, roster day and notice window at this site is read in this timezone.
          </p>

          {error && (
            <p className="rounded-card border border-critical-edge bg-critical-subtle px-3 py-2 text-body-sm text-critical-text">
              {error}
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy || name.trim().length < 2}>
            {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
            Add site
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

/* --------------------------------------------------------------- a site --- */

function SiteCard({
  site,
  live,
  onSaved,
  onRemoved,
}: {
  site: SiteRow;
  live: boolean;
  onSaved: () => void;
  onRemoved: () => void;
}) {
  const { toast } = useToast();
  const [draft, setDraft] = React.useState(site);
  const [busy, setBusy] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

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
      .then(async () => {
        await refreshProfile();
        toast({ tone: "success", title: "Site updated" });
        onSaved();
      })
      .catch((e: Error) =>
        toast({ tone: "critical", title: "Couldn't save", description: e.message })
      )
      .finally(() => setBusy(false));
  };

  const remove = async () => {
    setBusy(true);
    const res = await deleteSite(site.id);
    setBusy(false);
    setConfirmOpen(false);
    if (!("ok" in res) || !res.ok) {
      toast({
        tone: "critical",
        title: "Not removed",
        description: (res as { error: string }).error,
      });
      return;
    }
    await refreshProfile();
    toast({ tone: "neutral", title: `${site.name} removed` });
    onRemoved();
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
          <div className="flex items-center gap-2">
            {live && (
              <Button variant="ghost" onClick={() => setConfirmOpen(true)} disabled={busy}>
                <Trash2 aria-hidden className="size-4" />
                Remove
              </Button>
            )}
            <Button onClick={save} disabled={!live || !dirty || busy}>
              {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        </div>
      </CardBody>

      <Modal open={confirmOpen} onOpenChange={setConfirmOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Remove {site.name}?</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <p className="text-body-sm text-fg-secondary">
              This removes the site and its cleaners and kiosk tablets. If anybody has ever
              clocked on here it will be refused instead — those are payroll records, and they
              stay.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={() => void remove()} disabled={busy}>
              {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
              Remove site
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  );
}

/* ---------------------------------------------------------------- page ---- */

export default function SitesPage() {
  const profile = useSessionStore((s) => s.profile);
  const live = NOTICES_LIVE && Boolean(profile);
  const [sites, setSites] = React.useState<SiteRow[]>(live ? [] : demoSites);
  const [loading, setLoading] = React.useState(live);
  const [error, setError] = React.useState<string | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);

  const refresh = React.useCallback(() => {
    if (!live) {
      setLoading(false); // a bail-out that leaves `loading` true is a screen
      return; //            that spins forever — the bug this release fixes
    }
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
        actions={
          <Button onClick={() => setAddOpen(true)} disabled={!live}>
            <Plus aria-hidden className="size-4" />
            New site
          </Button>
        }
      />

      {!live && (
        <Card className="mb-6">
          <CardBody className="flex gap-3 text-body-sm text-fg-secondary">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-text" />
            <span>
              <span className="font-medium text-fg">Demo mode.</span> Sign in with a live database
              to add and edit real sites.
            </span>
          </CardBody>
        </Card>
      )}

      {error && (
        <Card className="mb-6">
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-body-sm text-critical-text">{error}</p>
            <Link
              href="/settings/health"
              className="inline-flex items-center gap-2 rounded-control border border-edge bg-surface px-3 py-2 text-body-sm text-fg hover:bg-hover"
            >
              <HeartPulse aria-hidden className="size-4" />
              What&rsquo;s wrong?
            </Link>
          </CardBody>
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
          description="A site is a building you service. Adding one switches on cleaning and the service desk, and lets you add cleaners and kiosk tablets to it."
          action={
            <Button onClick={() => setAddOpen(true)} disabled={!live}>
              <Plus aria-hidden className="size-4" />
              Add your first site
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5">
          {sites.map((s) => (
            <React.Fragment key={s.id}>
              <SiteCard site={s} live={live} onSaved={refresh} onRemoved={refresh} />
              {/* alerting is a per-site decision, so it lives beside the site
                  it belongs to rather than in a settings page of its own */}
              {live && <AlertSettingsCard buildingId={s.id} siteName={s.name} />}
            </React.Fragment>
          ))}
        </div>
      )}

      <NewSiteModal open={addOpen} onOpenChange={setAddOpen} onCreated={refresh} />
    </>
  );
}
