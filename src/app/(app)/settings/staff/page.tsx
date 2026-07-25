"use client";

/**
 * Settings → Cleaners & kiosks (Stage 2 phase 2).
 *
 * This is the answer to "who creates it": a cleaning manager adds their
 * cleaners here and the system issues each a 4-digit PIN — shown once, never
 * retrievable, resettable. Kiosk tablets are provisioned the same way: create
 * the device, read the 6-digit pair code out to whoever is holding the tablet,
 * and it binds itself to this building for good.
 *
 * Live against 0007 when Supabase is configured; otherwise a clearly-labelled
 * demo view of the seeded directory, so the screen is never a broken shell.
 */
import * as React from "react";
import {
  CalendarClock,
  Camera,
  Copy,
  Info,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Tablet,
  Trash2,
  UserPlus,
  Users,
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
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useSessionStore } from "@/lib/session";
import {
  createDevice,
  createStaff,
  demoDevices,
  demoStaff,
  listDevices,
  listSessions,
  listStaff,
  selfieUrl,
  reissuePairCode,
  resetPin,
  retireDevice,
  setStaffActive,
  STAFF_LIVE,
  type AttendanceSession,
  type DeviceRow,
  type StaffRow,
} from "@/lib/staff-admin";
import { staffDirectory } from "@/lib/attendance-store";
import { cn } from "@/lib/cn";

const ROLE_OPTIONS = [
  { value: "Cleaner", label: "Cleaner" },
  { value: "Team leader", label: "Team leader" },
  { value: "Window cleaner", label: "Window cleaner" },
  { value: "Waste operator", label: "Waste operator" },
];

/* ------------------------------------------------------------------ */
/* A credential shown exactly once                                     */
/* ------------------------------------------------------------------ */

function CodeReveal({
  code,
  title,
  note,
  onDone,
}: {
  code: string;
  title: string;
  note: string;
  onDone: () => void;
}) {
  const { toast } = useToast();
  return (
    <>
      <ModalHeader>
        <ModalTitle>{title}</ModalTitle>
      </ModalHeader>
      <ModalBody className="text-center">
        <p
          className="font-numeric text-[3.5rem] leading-none font-bold tracking-[0.2em] text-fg tabular-nums"
          aria-label={code.split("").join(" ")}
        >
          {code}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-4"
          onClick={() => {
            void navigator.clipboard?.writeText(code);
            toast({ tone: "success", title: "Copied" });
          }}
        >
          <Copy aria-hidden className="size-4" />
          Copy
        </Button>
        <p className="mx-auto mt-5 max-w-sm text-body-sm text-fg-secondary">{note}</p>
      </ModalBody>
      <ModalFooter>
        <Button onClick={onDone}>Done</Button>
      </ModalFooter>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Cleaners                                                            */
/* ------------------------------------------------------------------ */

function CleanersTab({
  buildingId,
  live,
}: {
  buildingId: string | null;
  live: boolean;
}) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<StaffRow[]>(live ? [] : demoStaff);
  const [loading, setLoading] = React.useState(live);
  const [error, setError] = React.useState<string | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState("Cleaner");
  const [busy, setBusy] = React.useState(false);
  const [reveal, setReveal] = React.useState<{ pin: string; who: string } | null>(null);

  const refresh = React.useCallback(() => {
    if (!live || !buildingId) return;
    setLoading(true);
    listStaff(buildingId)
      .then((r) => {
        setRows(r);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [live, buildingId]);

  React.useEffect(refresh, [refresh]);

  const submit = async () => {
    if (!buildingId || name.trim().length < 2) return;
    setBusy(true);
    try {
      const { pin } = await createStaff(buildingId, name.trim(), role);
      setReveal({ pin, who: name.trim() });
      setAddOpen(false);
      setName("");
      refresh();
    } catch (e) {
      toast({ tone: "critical", title: "Couldn’t add cleaner", description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const onReset = async (row: StaffRow) => {
    try {
      const pin = await resetPin(row.id);
      setReveal({ pin, who: row.name });
    } catch (e) {
      toast({ tone: "critical", title: "Couldn’t reset PIN", description: (e as Error).message });
    }
  };

  const onToggle = async (row: StaffRow) => {
    try {
      await setStaffActive(row.id, !row.active);
      refresh();
    } catch (e) {
      toast({ tone: "critical", title: "Couldn’t update", description: (e as Error).message });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body-sm text-fg-secondary">
          {live
            ? "Each cleaner gets a system-generated 4-digit PIN for the kiosk. Read it out privately — it can’t be looked up again, only replaced."
            : "Demo directory. Adding cleaners and issuing PINs needs the live database."}
        </p>
        <Button onClick={() => setAddOpen(true)} disabled={!live || !buildingId}>
          <UserPlus aria-hidden className="size-4" />
          Add cleaner
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
            Loading cleaners…
          </CardBody>
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No cleaners yet"
          description="Add the people who sign in at this building and hand each of them their PIN."
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Kiosk PIN</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <Tr key={r.id}>
                  <Td className="font-medium text-fg">{r.name}</Td>
                  <Td className="text-fg-secondary">{r.role}</Td>
                  <Td className="font-mono text-fg-muted">
                    {live
                      ? "•••• "
                      : (staffDirectory.find((s) => s.id === r.id)?.pin ?? "••••")}
                  </Td>
                  <Td>
                    {r.active ? (
                      <Badge tone="success">Active</Badge>
                    ) : (
                      <Badge tone="neutral">Inactive</Badge>
                    )}
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!live}
                      onClick={() => void onReset(r)}
                    >
                      <KeyRound aria-hidden className="size-4" />
                      Reset PIN
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!live}
                      onClick={() => void onToggle(r)}
                    >
                      {r.active ? "Deactivate" : "Reactivate"}
                    </Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      {/* add cleaner */}
      <Modal open={addOpen} onOpenChange={setAddOpen}>
        <ModalContent size="lg">
          <ModalHeader>
            <ModalTitle>Add a cleaner</ModalTitle>
          </ModalHeader>
          <ModalBody className="space-y-5">
            <Input
              label="Full name"
              placeholder="e.g. Marcus Chen"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Select label="Role" options={ROLE_OPTIONS} value={role} onValueChange={setRole} />
            <p className="flex gap-2 rounded-card bg-accent-subtle px-4 py-3 text-body-sm text-fg-secondary">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-text" />
              A unique 4-digit PIN is generated for this building and shown on the next screen.
              Nobody — including you — can look it up afterwards.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} disabled={busy || name.trim().length < 2}>
              {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
              Add cleaner
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* PIN reveal */}
      <Modal open={reveal !== null} onOpenChange={(o) => !o && setReveal(null)}>
        <ModalContent>
          {reveal && (
            <CodeReveal
              code={reveal.pin}
              title={`${reveal.who}’s kiosk PIN`}
              note="Give this to them privately. It is not stored anywhere you can read it — if they forget it, issue a new one with Reset PIN."
              onDone={() => setReveal(null)}
            />
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Kiosk tablets                                                       */
/* ------------------------------------------------------------------ */

function deviceStatus(d: DeviceRow): { label: string; tone: "success" | "warning" | "neutral" } {
  if (!d.active) return { label: "Retired", tone: "neutral" };
  if (d.paired_at) return { label: "Paired", tone: "success" };
  return { label: "Waiting to pair", tone: "warning" };
}

function ago(iso: string | null): string {
  if (!iso) return "—";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

function KiosksTab({ buildingId, live }: { buildingId: string | null; live: boolean }) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<DeviceRow[]>(live ? [] : demoDevices);
  const [loading, setLoading] = React.useState(live);
  const [error, setError] = React.useState<string | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [label, setLabel] = React.useState("Cleaners room tablet");
  const [busy, setBusy] = React.useState(false);
  const [reveal, setReveal] = React.useState<{ code: string; label: string } | null>(null);

  const kioskUrl = typeof window === "undefined" ? "/kiosk" : `${window.location.origin}/kiosk`;

  const refresh = React.useCallback(() => {
    if (!live || !buildingId) return;
    setLoading(true);
    listDevices(buildingId)
      .then((r) => {
        setRows(r);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [live, buildingId]);

  React.useEffect(refresh, [refresh]);

  const submit = async () => {
    if (!buildingId || label.trim().length < 2) return;
    setBusy(true);
    try {
      const { pairCode } = await createDevice(buildingId, label.trim());
      setReveal({ code: pairCode, label: label.trim() });
      setAddOpen(false);
      refresh();
    } catch (e) {
      toast({ tone: "critical", title: "Couldn’t add tablet", description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body-sm text-fg-secondary">
          Open <span className="font-mono text-fg">{kioskUrl}</span> on the tablet and enter its
          pair code once. It stays bound to this building until you retire it.
        </p>
        <Button onClick={() => setAddOpen(true)} disabled={!live || !buildingId}>
          <Plus aria-hidden className="size-4" />
          Add tablet
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
            Loading tablets…
          </CardBody>
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Tablet}
          title="No kiosk tablets yet"
          description="Add the iPad or Android tablet in the cleaners room and pair it with a 6-digit code."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((d) => {
            const status = deviceStatus(d);
            return (
              <Card key={d.id} className={cn(!d.active && "opacity-60")}>
                <CardBody className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-fg">{d.label}</p>
                      <p className="mt-1 text-body-sm text-fg-muted">
                        Last seen {ago(d.last_seen)}
                      </p>
                    </div>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>

                  {d.pair_code && d.active && (
                    <p className="rounded-card bg-warning-subtle px-4 py-3 text-center">
                      <span className="block text-caption text-fg-secondary">Pair code</span>
                      <span className="font-numeric text-title-1 font-bold tracking-[0.15em] text-fg tabular-nums">
                        {d.pair_code}
                      </span>
                    </p>
                  )}

                  {d.active && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!live}
                        onClick={() => {
                          reissuePairCode(d.id)
                            .then((code) => {
                              setReveal({ code, label: d.label });
                              refresh();
                            })
                            .catch((e: Error) =>
                              toast({ tone: "critical", title: "Couldn’t issue a code", description: e.message })
                            );
                        }}
                      >
                        <RefreshCw aria-hidden className="size-4" />
                        New pair code
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!live}
                        onClick={() => {
                          retireDevice(d.id)
                            .then(refresh)
                            .catch((e: Error) =>
                              toast({ tone: "critical", title: "Couldn’t retire", description: e.message })
                            );
                        }}
                      >
                        <Trash2 aria-hidden className="size-4" />
                        Retire
                      </Button>
                    </div>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={addOpen} onOpenChange={setAddOpen}>
        <ModalContent size="lg">
          <ModalHeader>
            <ModalTitle>Add a kiosk tablet</ModalTitle>
          </ModalHeader>
          <ModalBody className="space-y-5">
            <Input
              label="Where is it?"
              placeholder="e.g. Cleaners room iPad"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <p className="flex gap-2 rounded-card bg-accent-subtle px-4 py-3 text-body-sm text-fg-secondary">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-text" />
              You’ll get a 6-digit code valid for 24 hours. On the tablet, open{" "}
              <span className="font-mono">{kioskUrl}</span> and type it in — the tablet then works
              offline of any login, for this building only.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} disabled={busy || label.trim().length < 2}>
              {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
              Add tablet
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal open={reveal !== null} onOpenChange={(o) => !o && setReveal(null)}>
        <ModalContent>
          {reveal && (
            <CodeReveal
              code={reveal.code}
              title={`Pair code for ${reveal.label}`}
              note={`On the tablet open ${kioskUrl} and enter this code. It works once and expires in 24 hours.`}
              onDone={() => setReveal(null)}
            />
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Attendance — what the kiosk actually recorded                       */
/* ------------------------------------------------------------------ */

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function hm(minutes: number | null): string {
  if (minutes === null) return "—";
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

function clock(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function AttendanceTab({ buildingId, live }: { buildingId: string | null; live: boolean }) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<AttendanceSession[]>([]);
  const [loading, setLoading] = React.useState(live);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!live || !buildingId) return;
    setLoading(true);
    listSessions(buildingId, isoDate(-6), isoDate(1))
      .then((r) => {
        setRows(r);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [live, buildingId]);

  const openSelfie = (path: string) => {
    selfieUrl(path)
      .then((url) => {
        if (url) window.open(url, "_blank", "noopener");
        else toast({ tone: "warning", title: "Photo unavailable" });
      })
      .catch(() => toast({ tone: "warning", title: "Photo unavailable" }));
  };

  if (!live) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="Live attendance needs the database"
        description="Once the kiosk is paired and cleaners start signing in, every punch appears here — and feeds the timesheet."
      />
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-body-sm text-fg-secondary">
        Every kiosk sign-in and sign-out from the last seven days, paired into worked sessions.
        These are the hours the timesheet is built from.
      </p>

      {error && (
        <Card>
          <CardBody className="text-body-sm text-critical-text">{error}</CardBody>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardBody className="flex items-center gap-2 text-body-sm text-fg-muted">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            Loading attendance…
          </CardBody>
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Nothing recorded yet"
          description="Sign in on the paired tablet and the punch shows up here straight away."
        />
      ) : (
        <Card>
          <Table>
            <THead>
              <Tr>
                <Th>Cleaner</Th>
                <Th>Date</Th>
                <Th>In</Th>
                <Th>Out</Th>
                <Th>Worked</Th>
                <Th className="text-right">Photos</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((r, i) => (
                <Tr key={`${r.staff_id}-${r.in_at}-${i}`}>
                  <Td className="font-medium text-fg">{r.staff_name}</Td>
                  <Td className="text-fg-secondary">
                    {new Date(`${r.work_date}T00:00:00`).toLocaleDateString("en-AU", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </Td>
                  <Td className="font-mono text-fg">{clock(r.in_at)}</Td>
                  <Td className="font-mono text-fg">
                    {r.out_at ? (
                      clock(r.out_at)
                    ) : (
                      <Badge tone="warning">Still on site</Badge>
                    )}
                  </Td>
                  <Td className="font-numeric font-semibold text-fg tabular-nums">
                    {hm(r.minutes)}
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    {r.in_selfie && (
                      <Button variant="ghost" size="sm" onClick={() => openSelfie(r.in_selfie!)}>
                        <Camera aria-hidden className="size-4" />
                        In
                      </Button>
                    )}
                    {r.out_selfie && (
                      <Button variant="ghost" size="sm" onClick={() => openSelfie(r.out_selfie!)}>
                        <Camera aria-hidden className="size-4" />
                        Out
                      </Button>
                    )}
                    {!r.in_selfie && !r.out_selfie && (
                      <span className="text-body-sm text-fg-muted">—</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function StaffSettingsPage() {
  const profile = useSessionStore((s) => s.profile);
  // stable identity: `?? []` would be a fresh array every render and re-fire
  // every effect downstream of it
  const buildings = React.useMemo(() => profile?.buildings ?? [], [profile]);
  const [buildingId, setBuildingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!buildingId && buildings[0]) setBuildingId(buildings[0].id);
  }, [buildings, buildingId]);

  const live = STAFF_LIVE && Boolean(profile);

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Cleaners & kiosks"
        description="Add the people who sign in at this building, issue their PINs, and pair the tablets they sign in on."
        actions={
          buildings.length > 1 ? (
            <Select
              aria-label="Building"
              options={buildings.map((b) => ({ value: b.id, label: b.name }))}
              value={buildingId ?? undefined}
              onValueChange={setBuildingId}
              className="w-56"
            />
          ) : undefined
        }
      />

      {!live && (
        <Card className="mb-6">
          <CardBody className="flex gap-3 text-body-sm text-fg-secondary">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-text" />
            <span>
              <span className="font-medium text-fg">Demo mode.</span>{" "}
              {STAFF_LIVE
                ? "Sign in to manage real cleaners and tablets."
                : "This build has no database connection, so the directory below is the seeded demo one."}
            </span>
          </CardBody>
        </Card>
      )}

      <Tabs defaultValue="cleaners">
        <TabsList>
          <TabsTrigger value="cleaners">Cleaners</TabsTrigger>
          <TabsTrigger value="kiosks">Kiosk tablets</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
        </TabsList>
        <TabsContent value="cleaners">
          <CleanersTab buildingId={buildingId} live={live} />
        </TabsContent>
        <TabsContent value="kiosks">
          <KiosksTab buildingId={buildingId} live={live} />
        </TabsContent>
        <TabsContent value="attendance">
          <AttendanceTab buildingId={buildingId} live={live} />
        </TabsContent>
      </Tabs>
    </>
  );
}
