"use client";

import * as React from "react";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Inbox,
  LayoutDashboard,
  LogIn,
  MapPin,
  Package,
  Plug,
  Plus,
  SprayCan,
  Users,
} from "lucide-react";

import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ComingSoonState } from "@/components/ui/coming-soon-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Modal,
  ModalBody,
  ModalClose,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
} from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Sidebar } from "@/components/ui/sidebar";
import { KioskButton } from "@/components/ui/kiosk-button";
import { MetricCard } from "@/components/ui/metric-card";
import { ModuleCard } from "@/components/ui/module-card";
import { SearchInput } from "@/components/ui/search-input";
import { SegmentedControl } from "@/components/ui/filter-bar";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { TopBar } from "@/components/ui/top-bar";
import { cn } from "@/lib/cn";

const THEMES = ["graphite", "harbour", "eucalypt", "sandstone", "ink"] as const;
type Theme = (typeof THEMES)[number];

/* ------------------------------------------------------------------ */
/* Demo data — Aurora on Collins cast (see CLAUDE.md, no lorem ipsum)  */
/* ------------------------------------------------------------------ */

const shifts = [
  { cleaner: "Marcus Chen", zone: "Lobby + L1–L8", in: "05:58", out: "10:04", hours: "4.10", status: "success", label: "Completed" },
  { cleaner: "Leila Haddad", zone: "L9–L24", in: "06:02", out: "—", hours: "—", status: "accent", label: "On site" },
  { cleaner: "Tom Nguyen", zone: "L25–L40 + BOH", in: "—", out: "—", hours: "—", status: "critical", label: "Missed check-in" },
] as const;

const zoneOptions = [
  { value: "lobby", label: "Lobby + L1–L8" },
  { value: "mid", label: "L9–L24" },
  { value: "high", label: "L25–L40 + BOH" },
  { value: "carpark", label: "Car park (not contracted)", disabled: true },
];

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-title-3 text-fg">{title}</h3>
      {children}
    </section>
  );
}

function Swatch({ name, className, border }: { name: string; className: string; border?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className={cn("size-8 shrink-0 rounded-sm", border && "border border-edge", className)}
      />
      <code className="font-mono text-caption text-fg-secondary">{name}</code>
    </div>
  );
}

function ColourSection() {
  return (
    <SectionCard title="Colour tokens">
      <Card>
        <CardBody className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-3">
          <Swatch name="--bg-canvas" className="bg-canvas" border />
          <Swatch name="--bg-surface" className="bg-surface" border />
          <Swatch name="--bg-raised" className="bg-raised shadow-raised" border />
          <Swatch name="--bg-hover" className="bg-hover" border />
          <Swatch name="--border-subtle" className="bg-edge" />
          <Swatch name="--border-strong" className="bg-edge-strong" />
          <Swatch name="--text-primary" className="bg-fg" />
          <Swatch name="--text-secondary" className="bg-fg-secondary" />
          <Swatch name="--text-muted" className="bg-fg-muted" />
          <Swatch name="--accent" className="bg-accent" />
          <Swatch name="--accent-subtle" className="bg-accent-subtle" border />
          <Swatch name="--brand" className="bg-brand" />
          <Swatch name="--success" className="bg-success" />
          <Swatch name="--warning" className="bg-warning" />
          <Swatch name="--critical" className="bg-critical" />
        </CardBody>
      </Card>
    </SectionCard>
  );
}

function TypographySection() {
  return (
    <SectionCard title="Typography">
      <Card>
        <CardBody className="flex flex-col gap-4">
          <div>
            <p className="text-caption text-fg-muted">display · General Sans · 32/40</p>
            <p className="font-display text-display text-fg">Aurora on Collins</p>
          </div>
          <div>
            <p className="text-caption text-fg-muted">title-1 · 24/32</p>
            <p className="font-display text-title-1 text-fg">Cleaning operations</p>
          </div>
          <div>
            <p className="text-caption text-fg-muted">title-2 · 20/28</p>
            <p className="font-display text-title-2 text-fg">Morning roster, Tower A</p>
          </div>
          <div>
            <p className="text-caption text-fg-muted">body · Hanken Grotesk · 15/22</p>
            <p className="text-body text-fg">
              Marcus checked in at the loading dock kiosk and started the lobby run.
              Missed check-ins alert the cleaning manager after 15 minutes.
            </p>
          </div>
          <div>
            <p className="text-caption text-fg-muted">body-sm · 13/20 · secondary</p>
            <p className="text-body-sm text-fg-secondary">
              Shift variance is calculated against the rostered window, not the swipe time.
            </p>
          </div>
          <div>
            <p className="text-caption text-fg-muted">mono · Geist Mono · numerics only</p>
            <p className="font-mono text-body text-fg">06:02 → 10:04 · 4.10 h · ID C-2381</p>
          </div>
        </CardBody>
      </Card>
    </SectionCard>
  );
}

function ButtonSection() {
  return (
    <SectionCard title="Buttons">
      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Approve timesheet</Button>
            <Button variant="secondary">Export CSV</Button>
            <Button variant="ghost">View history</Button>
            <Button variant="destructive">Remove cleaner</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">
              <Plus aria-hidden /> Add shift
            </Button>
            <Button size="sm" variant="secondary">
              Small secondary
            </Button>
            <Button loading>Saving…</Button>
            <Button disabled>Disabled</Button>
            <Button variant="destructive" disabled>
              Disabled
            </Button>
          </div>
        </CardBody>
      </Card>
    </SectionCard>
  );
}

function FormSection() {
  return (
    <SectionCard title="Input & Select">
      <Card>
        <CardBody className="grid gap-5 md:grid-cols-2">
          <Input
            label="Cleaner name"
            placeholder="e.g. Marcus Chen"
            hint="As it appears on the induction record."
          />
          <Input
            label="Contact mobile"
            defaultValue="04x1 234 5"
            error="Enter a valid Australian mobile number."
          />
          <Input label="Site code" value="AOC-40" disabled readOnly />
          <Select label="Assigned zone" options={[...zoneOptions]} defaultValue="mid" />
        </CardBody>
      </Card>
    </SectionCard>
  );
}

function BadgeSection() {
  return (
    <SectionCard title="Badge & StatusPill">
      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge>Core</Badge>
            <Badge tone="accent">CleaningOps</Badge>
            <Badge tone="success">Enabled</Badge>
            <Badge tone="warning">Trial</Badge>
            <Badge tone="critical">Overdue</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <StatusPill tone="success">Checked in</StatusPill>
            <StatusPill tone="accent">On site</StatusPill>
            <StatusPill tone="warning">Running late</StatusPill>
            <StatusPill tone="critical">Missed check-in</StatusPill>
            <StatusPill>Rostered</StatusPill>
          </div>
        </CardBody>
      </Card>
    </SectionCard>
  );
}

function CardSection() {
  return (
    <SectionCard title="Card">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Consumables order</CardTitle>
            <CardDescription>Restock request for Aurora on Collins, level 20 store.</CardDescription>
          </div>
          <StatusPill tone="warning">Awaiting approval</StatusPill>
        </CardHeader>
        <CardBody className="text-body-sm text-fg-secondary">
          12 × neutral floor cleaner (5 L), 8 × microfibre pack, 2 × glass polish.
          Requested by Priya Sharma (FOCT Cleaning).
        </CardBody>
        <CardFooter>
          <Button variant="ghost" size="sm">Decline</Button>
          <Button size="sm">Approve order</Button>
        </CardFooter>
      </Card>
    </SectionCard>
  );
}

function TableSection() {
  return (
    <SectionCard title="Table">
      <Table>
        <THead>
          <Tr>
            <Th>Cleaner</Th>
            <Th>Zone</Th>
            <Th numeric>Check-in</Th>
            <Th numeric>Check-out</Th>
            <Th numeric>Hours</Th>
            <Th>Status</Th>
          </Tr>
        </THead>
        <TBody>
          {shifts.map((s) => (
            <Tr key={s.cleaner}>
              <Td className="font-medium">{s.cleaner}</Td>
              <Td className="text-fg-secondary">{s.zone}</Td>
              <Td numeric>{s.in}</Td>
              <Td numeric>{s.out}</Td>
              <Td numeric>{s.hours}</Td>
              <Td>
                <StatusPill tone={s.status}>{s.label}</StatusPill>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </SectionCard>
  );
}

function TabsSection() {
  return (
    <SectionCard title="Tabs">
      <Card>
        <CardBody>
          <Tabs defaultValue="shifts">
            <TabsList>
              <TabsTrigger value="shifts">Shifts</TabsTrigger>
              <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
              <TabsTrigger value="variance">Variance</TabsTrigger>
              <TabsTrigger value="audits">Site audits</TabsTrigger>
            </TabsList>
            <TabsContent value="shifts" className="text-body-sm text-fg-secondary">
              Today’s roster covers 3 zones across 40 levels. One missed check-in requires action.
            </TabsContent>
            <TabsContent value="timesheets" className="text-body-sm text-fg-secondary">
              4 timesheets awaiting approval from Priya Sharma.
            </TabsContent>
            <TabsContent value="variance" className="text-body-sm text-fg-secondary">
              Weekly variance is 1.6 hours under roster.
            </TabsContent>
            <TabsContent value="audits" className="text-body-sm text-fg-secondary">
              Last site audit scored 96% — two follow-up photos requested.
            </TabsContent>
          </Tabs>
        </CardBody>
      </Card>
    </SectionCard>
  );
}

function OverlaySection({ theme }: { theme: Theme }) {
  const { toast } = useToast();
  return (
    <SectionCard title="Modal & Toast">
      <Card>
        <CardBody className="flex flex-wrap items-center gap-3">
          <Modal>
            <ModalTrigger asChild>
              <Button variant="secondary">Open modal</Button>
            </ModalTrigger>
            {/* data-theme keeps the portaled modal inside this column's theme */}
            <ModalContent data-theme={theme}>
              <ModalHeader>
                <ModalTitle>Reassign zone</ModalTitle>
                <ModalDescription>
                  Move Tom Nguyen’s remaining shift to another cleaner. The change is
                  audit-logged and the roster re-issues automatically.
                </ModalDescription>
              </ModalHeader>
              <ModalBody>
                <Select label="Reassign to" options={[
                  { value: "marcus", label: "Marcus Chen" },
                  { value: "leila", label: "Leila Haddad" },
                ]} placeholder="Choose a cleaner" />
              </ModalBody>
              <ModalFooter>
                <ModalClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </ModalClose>
                <Button>Reassign shift</Button>
              </ModalFooter>
            </ModalContent>
          </Modal>
          <Button
            variant="secondary"
            onClick={() =>
              toast({
                tone: "success",
                title: "Timesheet approved",
                description: "Marcus Chen · 4.10 h · Mon 29 Jun",
              })
            }
          >
            Success toast
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast({
                tone: "critical",
                title: "Missed check-in",
                description: "Tom Nguyen has not checked in for the 06:00 shift.",
              })
            }
          >
            Alert toast
          </Button>
        </CardBody>
      </Card>
    </SectionCard>
  );
}

function OperationalSection() {
  const [view, setView] = React.useState("day");
  return (
    <SectionCard title="Operational components">
      <div className="grid gap-4 md:grid-cols-2">
        <MetricCard
          label="On site now"
          value="3"
          context="Since 05:58"
          icon={MapPin}
          tone="accent"
        />
        <MetricCard
          label="Missed check-ins"
          value="1"
          context="Tom · 06:00 shift"
          icon={AlertTriangle}
          tone="critical"
        />
      </div>
      <Card>
        <CardBody className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            label="Roster view"
            value={view}
            onValueChange={setView}
            options={[
              { value: "day", label: "Day" },
              { value: "week", label: "Week" },
              { value: "timeline", label: "Timeline" },
            ]}
          />
          <SearchInput className="w-56" placeholder="Find a cleaner…" />
        </CardBody>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <ModuleCard
          icon={SprayCan}
          name="CleaningOps"
          description="Rosters, check-ins, timesheets, consumables and audits."
          status="enabled"
        />
        <ModuleCard
          icon={Building2}
          name="Concierge desk"
          description="Front-of-house log and handover notes for concierge teams."
          status="not-enabled"
        />
      </div>
      <KioskButton icon={LogIn}>Check in</KioskButton>
    </SectionCard>
  );
}

function StateSection() {
  return (
    <SectionCard title="EmptyState & ComingSoonState">
      <div className="grid gap-4 xl:grid-cols-2">
        <EmptyState
          icon={Inbox}
          title="No open requests"
          description="Consumable orders and task requests from your buildings will appear here."
          action={
            <Button size="sm" variant="secondary">
              <Plus aria-hidden /> New order
            </Button>
          }
        />
        <ComingSoonState
          icon={Package}
          moduleName="Parcels"
          mode="not-enabled"
          footnote="Contact Meridian Strata Group to enable this module for Aurora on Collins."
        />
      </div>
    </SectionCard>
  );
}

function ShellSection() {
  return (
    <SectionCard title="App shell — Sidebar, TopBar, PageHeader">
      <div className="overflow-hidden rounded-card border border-edge shadow-card">
        <div className="flex h-[26rem] bg-canvas">
          <Sidebar
            buildingName="Aurora on Collins"
            className="hidden md:flex"
            sections={[
              {
                items: [
                  { label: "Dashboard", icon: LayoutDashboard },
                  { label: "CleaningOps", icon: SprayCan, active: true },
                  { label: "Calendar", icon: CalendarDays },
                ],
              },
              {
                title: "Modules",
                items: [
                  { label: "ConciergeDesk", icon: Building2, disabled: true },
                  { label: "Parcels", icon: Package, disabled: true },
                  { label: "Contractors", icon: Users, disabled: true },
                  { label: "Integrations", icon: Plug, disabled: true },
                ],
              },
            ]}
            footer={<p className="text-caption text-fg-muted">FOCT Cleaning · manager</p>}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar
              buildingName="Aurora on Collins"
              orgName="FOCT Cleaning"
              userName="Priya Sharma"
              userRole="Cleaning manager"
            />
            <div className="min-w-0 flex-1 overflow-y-auto p-6">
              <PageHeader
                eyebrow="CleaningOps"
                title="Today’s shifts"
                description="3 cleaners rostered · 1 missed check-in"
                actions={
                  <>
                    <Button variant="secondary" size="sm">Export</Button>
                    <Button size="sm">
                      <Plus aria-hidden /> Add shift
                    </Button>
                  </>
                }
              />
              <TableSection />
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/* Frame: one theme column                                             */
/* ------------------------------------------------------------------ */

function ThemeFrame({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return (
    <div data-theme={theme} className="min-w-0 rounded-card border border-edge bg-canvas">
      <ToastProvider>
        <div className="flex items-center justify-between border-b border-edge px-5 py-3">
          <p className="font-display text-title-3 text-fg capitalize">{theme}</p>
          <span aria-hidden className="size-3 rounded-pill bg-accent" />
        </div>
        <div className="flex flex-col gap-8 p-5">{children}</div>
      </ToastProvider>
    </div>
  );
}

function AllSections({ theme }: { theme: Theme }) {
  return (
    <>
      <ColourSection />
      <TypographySection />
      <ButtonSection />
      <FormSection />
      <BadgeSection />
      <CardSection />
      <TableSection />
      <TabsSection />
      <OverlaySection theme={theme} />
      <OperationalSection />
      <StateSection />
      <ShellSection />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function DesignPreview() {
  const [theme, setTheme] = React.useState<Theme>("graphite");
  const [compare, setCompare] = React.useState(false);

  // Keep the page chrome (and portaled overlays in single mode) on the picked theme.
  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 border-b border-edge bg-surface">
        <div className="mx-auto flex max-w-[120rem] flex-wrap items-center gap-4 px-6 py-3">
          <div className="mr-auto">
            <h1 className="font-display text-title-3 text-fg">FOCT design system</h1>
            <p className="text-caption text-fg-muted">
              Stage 1 acceptance gate — every component, every theme, semantic tokens only.
            </p>
          </div>
          <div role="group" aria-label="Theme" className="flex rounded-control border border-edge bg-canvas p-0.5">
            {THEMES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                aria-pressed={theme === t}
                className={cn(
                  "rounded-sm px-3 py-1.5 text-body-sm capitalize transition-colors",
                  theme === t
                    ? "bg-accent font-medium text-on-accent"
                    : "text-fg-secondary hover:text-fg"
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setCompare((c) => !c)}
            aria-pressed={compare}
            className={cn(
              "rounded-control border px-3 py-1.5 text-body-sm font-medium transition-colors",
              compare
                ? "border-edge bg-accent-subtle text-accent-text"
                : "border-edge bg-surface text-fg-secondary hover:text-fg"
            )}
          >
            {compare ? "Comparing all 5" : "Compare all themes"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[120rem] px-6 py-8">
        {compare ? (
          <div className="grid gap-5 xl:grid-cols-2 min-[1900px]:grid-cols-3">
            {THEMES.map((t) => (
              <ThemeFrame key={t} theme={t}>
                <AllSections theme={t} />
              </ThemeFrame>
            ))}
          </div>
        ) : (
          <ThemeFrame theme={theme}>
            <AllSections theme={theme} />
          </ThemeFrame>
        )}
      </main>
    </div>
  );
}
