"use client";

import * as React from "react";
import {
  CalendarCheck2,
  ClipboardList,
  KeyRound,
  Package,
  Plus,
  UserRoundPlus,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar, SegmentedControl } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/ui/metric-card";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
} from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { SectionHeader } from "@/components/ui/section-header";
import { Select } from "@/components/ui/select";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useConciergeReady, useConciergeStore } from "@/lib/concierge-store";
import {
  AMENITIES,
  requestKindMeta,
  useResidentsReady,
  useResidentsStore,
  type AmenityId,
  type CredentialKind,
  type HistoryKind,
  type RequestKind,
  type Resident,
} from "@/lib/residents-store";
import { fmtTime } from "@/lib/demo-data";
import { cn } from "@/lib/cn";

/**
 * Residents — the concierge/BM organisation's register. Cleaning staff
 * never see this surface; the RLS model makes that a database guarantee
 * at the backend stage (see residents-store.ts).
 */

const credentialKindLabel: Record<CredentialKind, string> = {
  fob: "Fob",
  "swipe-card": "Swipe card",
  "garage-remote": "Garage remote",
  "mailbox-key": "Mailbox key",
};

const historyKindMeta: Record<HistoryKind, { label: string; tone: "neutral" | "warning" | "critical" }> = {
  note: { label: "Note", tone: "neutral" },
  complaint: { label: "Complaint", tone: "warning" },
  incident: { label: "Incident", tone: "warning" },
  warning: { label: "Warning", tone: "critical" },
};

const requestStatusMeta = {
  new: { label: "New", tone: "accent" as const },
  scheduled: { label: "Scheduled", tone: "info" as const },
  "in-progress": { label: "In progress", tone: "warning" as const },
  done: { label: "Done", tone: "success" as const },
  declined: { label: "Declined", tone: "critical" as const },
};

const bookingStatusMeta = {
  pending: { label: "Pending approval", tone: "warning" as const },
  confirmed: { label: "Confirmed", tone: "success" as const },
  declined: { label: "Declined", tone: "critical" as const },
};

const fmtDate = (ymd?: string) =>
  ymd
    ? new Date(`${ymd}T12:00:00`).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })
    : "—";

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

const daysAhead = (d: number) => {
  const dt = new Date(Date.now() + d * 86400000);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <p className="shrink-0 text-body-sm text-fg-muted">{label}</p>
      <p className="text-right text-body-sm font-medium text-fg">{value || "—"}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Enrol resident — the big create modal                             */
/* ---------------------------------------------------------------- */

function EnrolModal() {
  const enrolResident = useResidentsStore((s) => s.enrolResident);
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [apartment, setApartment] = React.useState("");
  const [floor, setFloor] = React.useState("");
  const [type, setType] = React.useState<Resident["type"]>("owner-occupier");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [movedIn, setMovedIn] = React.useState(daysAhead(0));
  const [parkingBay, setParkingBay] = React.useState("");
  const [vehicle, setVehicle] = React.useState("");
  const [pets, setPets] = React.useState("");
  const [medicalNote, setMedicalNote] = React.useState("");
  const [ecName, setEcName] = React.useState("");
  const [ecRel, setEcRel] = React.useState("");
  const [ecPhone, setEcPhone] = React.useState("");
  const [nokName, setNokName] = React.useState("");
  const [nokRel, setNokRel] = React.useState("");
  const [nokPhone, setNokPhone] = React.useState("");

  const openChange = (o: boolean) => {
    setOpen(o);
    if (o) {
      setName(""); setApartment(""); setFloor(""); setPhone(""); setEmail("");
      setParkingBay(""); setVehicle(""); setPets(""); setMedicalNote("");
      setEcName(""); setEcRel(""); setEcPhone("");
      setNokName(""); setNokRel(""); setNokPhone("");
      setMovedIn(daysAhead(0));
    }
  };

  const onApartment = (v: string) => {
    setApartment(v);
    if (/^\d{4}$/.test(v.trim())) setFloor(String(Number.parseInt(v.trim().slice(0, 2), 10)));
  };

  const valid =
    name.trim() && apartment.trim() && phone.trim() && ecName.trim() && ecPhone.trim();

  const submit = () => {
    const apt = apartment.trim();
    const emergency = [{ name: ecName.trim(), relationship: ecRel.trim() || "Emergency contact", phone: ecPhone.trim() }];
    if (nokName.trim() && nokPhone.trim()) {
      emergency.push({
        name: nokName.trim(),
        relationship: `${nokRel.trim() || "Next of kin"} · next of kin`,
        phone: nokPhone.trim(),
      });
    }
    enrolResident({
      name: name.trim(),
      apartment: apt,
      floor: Number.parseInt(floor, 10) || 0,
      type,
      phone: phone.trim(),
      email: email.trim(),
      movedIn,
      parkingBay: parkingBay.trim() || undefined,
      vehicle: vehicle.trim() || undefined,
      pets: pets.trim() || undefined,
      medicalNote: medicalNote.trim() || undefined,
      emergency,
      credentials: [
        { id: `c-enrol-${Date.now()}`, kind: "fob", label: `FOB-${apt}-A`, issuedAt: movedIn, status: "active" },
      ],
    });
    setOpen(false);
    toast({
      tone: "success",
      title: `${name.trim()} enrolled — apartment ${apt}`,
      description: `First fob FOB-${apt}-A issued · emergency contacts on file`,
    });
  };

  const field = "flex flex-col gap-1.5 text-body-sm font-medium text-fg";

  return (
    <Modal open={open} onOpenChange={openChange}>
      <ModalTrigger asChild>
        <Button>
          <UserRoundPlus aria-hidden /> Enrol resident
        </Button>
      </ModalTrigger>
      <ModalContent size="xl">
        <ModalHeader>
          <ModalTitle>Enrol a resident</ModalTitle>
          <ModalDescription>
            Aurora on Collins · the record is private to the concierge / building-management
            organisation.
          </ModalDescription>
        </ModalHeader>
        <ModalBody className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className={cn(field, "sm:col-span-1")}>
              Full name
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex Fraser" />
            </label>
            <label className={field}>
              Apartment
              <Input value={apartment} onChange={(e) => onApartment(e.target.value)} placeholder="e.g. 1204" />
            </label>
            <label className={field}>
              Floor
              <Input value={floor} onChange={(e) => setFloor(e.target.value)} inputMode="numeric" placeholder="Auto from apartment" />
            </label>
            <div className={field}>
              Residency
              <SegmentedControl
                label="Residency type"
                value={type}
                onValueChange={(v) => setType(v as Resident["type"])}
                options={[
                  { value: "owner-occupier", label: "Owner-occupier" },
                  { value: "tenant", label: "Tenant" },
                ]}
              />
            </div>
            <label className={field}>
              Phone
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="04xx xxx xxx" />
            </label>
            <label className={field}>
              Email
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" />
            </label>
            <label className={field}>
              Move-in date
              <Input type="date" value={movedIn} onChange={(e) => setMovedIn(e.target.value)} />
            </label>
            <label className={field}>
              Parking bay (optional)
              <Input value={parkingBay} onChange={(e) => setParkingBay(e.target.value)} placeholder="e.g. B2-114" />
            </label>
            <label className={field}>
              Vehicle (optional)
              <Input value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="Make · plate" />
            </label>
            <label className={cn(field, "sm:col-span-2")}>
              Pets (optional)
              <Input value={pets} onChange={(e) => setPets(e.target.value)} placeholder="e.g. 1 small dog (approved)" />
            </label>
            <label className={field}>
              Medical note (optional)
              <Input value={medicalNote} onChange={(e) => setMedicalNote(e.target.value)} placeholder="Shown to emergency responders" />
            </label>
          </div>

          <div className="rounded-card border border-edge bg-canvas p-4">
            <p className="text-body-sm font-medium text-fg">Emergency contact (required)</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Input aria-label="Emergency contact name" placeholder="Name" value={ecName} onChange={(e) => setEcName(e.target.value)} />
              <Input aria-label="Emergency contact relationship" placeholder="Relationship, e.g. Spouse" value={ecRel} onChange={(e) => setEcRel(e.target.value)} />
              <Input aria-label="Emergency contact phone" placeholder="Phone" value={ecPhone} onChange={(e) => setEcPhone(e.target.value)} />
            </div>
            <p className="mt-4 text-body-sm font-medium text-fg">Next of kin (optional, if different)</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Input aria-label="Next of kin name" placeholder="Name" value={nokName} onChange={(e) => setNokName(e.target.value)} />
              <Input aria-label="Next of kin relationship" placeholder="Relationship" value={nokRel} onChange={(e) => setNokRel(e.target.value)} />
              <Input aria-label="Next of kin phone" placeholder="Phone" value={nokPhone} onChange={(e) => setNokPhone(e.target.value)} />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <p className="mr-auto text-body-sm text-fg-secondary">
            The first fob is issued automatically on enrolment.
          </p>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!valid} onClick={submit}>
            Enrol resident
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

/* ---------------------------------------------------------------- */
/* Resident drawer — profile / access / history / parcels /          */
/* bookings / requests. One controlled page-level instance.          */
/* ---------------------------------------------------------------- */

function ResidentDrawer({
  resident,
  onClose,
}: {
  resident: Resident | null;
  onClose: () => void;
}) {
  const addHistory = useResidentsStore((s) => s.addHistory);
  const addCredential = useResidentsStore((s) => s.addCredential);
  const setCredentialStatus = useResidentsStore((s) => s.setCredentialStatus);
  const addBooking = useResidentsStore((s) => s.addBooking);
  const addRequest = useResidentsStore((s) => s.addRequest);
  const bookings = useResidentsStore((s) => s.bookings);
  const requests = useResidentsStore((s) => s.requests);
  const parcels = useConciergeStore((s) => s.parcels);
  const markCollected = useConciergeStore((s) => s.markCollected);
  const { toast } = useToast();

  const [histKind, setHistKind] = React.useState<HistoryKind>("note");
  const [histText, setHistText] = React.useState("");
  const [credKind, setCredKind] = React.useState<CredentialKind>("fob");
  const [credLabel, setCredLabel] = React.useState("");
  const [bkAmenity, setBkAmenity] = React.useState<AmenityId>("cinema");
  const [bkDate, setBkDate] = React.useState(daysAhead(3));
  const [bkStart, setBkStart] = React.useState("19");
  const [bkHours, setBkHours] = React.useState("3");
  const [bkGuests, setBkGuests] = React.useState("6");
  const [reqKind, setReqKind] = React.useState<RequestKind>("hard-rubbish");
  const [reqDetail, setReqDetail] = React.useState("");
  const [reqDate, setReqDate] = React.useState(daysAhead(5));

  const r = resident;
  const myParcels = r ? parcels.filter((p) => p.apartment === r.apartment) : [];
  const myBookings = r ? bookings.filter((b) => b.residentId === r.id) : [];
  const myRequests = r ? requests.filter((q) => q.residentId === r.id) : [];
  const warnings = r ? r.history.filter((h) => h.kind === "warning").length : 0;

  // the Root stays mounted and is driven by `open` — see the calendar
  // DayDrawer lesson (unmounting an open dialog leaks pointer-events)
  return (
    <Drawer open={!!r} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="w-[min(36rem,calc(100vw-2rem))]">
        <DrawerHeader>
          <DrawerTitle>
            {r?.name} <span className="font-mono text-fg-secondary">· {r?.apartment}</span>
          </DrawerTitle>
          <DrawerDescription>
            {r?.type === "tenant" ? "Tenant" : "Owner-occupier"} · level {r?.floor} · moved in{" "}
            {r ? fmtWhen(`${r.movedIn}T12:00:00`) : ""}
            {r?.status === "moving-out" && " · moving out"}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <Tabs defaultValue="profile" key={r?.id}>
            <TabsList className="flex-wrap gap-x-5 gap-y-1">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="access">Access</TabsTrigger>
              <TabsTrigger value="history">
                History{warnings > 0 ? ` (${warnings}⚠)` : ""}
              </TabsTrigger>
              <TabsTrigger value="parcels">Parcels{myParcels.filter((p) => p.status === "awaiting").length ? ` (${myParcels.filter((p) => p.status === "awaiting").length})` : ""}</TabsTrigger>
              <TabsTrigger value="bookings">Bookings</TabsTrigger>
              <TabsTrigger value="requests">Requests</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="flex flex-col gap-5">
              <div>
                <InfoRow label="Phone" value={r?.phone} />
                <InfoRow label="Email" value={r?.email} />
                <InfoRow label="Parking bay" value={r?.parkingBay} />
                <InfoRow label="Storage cage" value={r?.storageCage} />
                <InfoRow label="Vehicle" value={r?.vehicle} />
                <InfoRow label="Pets" value={r?.pets} />
              </div>
              {r?.medicalNote && (
                <div className="rounded-card border border-edge bg-critical-subtle px-4 py-3">
                  <p className="text-caption font-medium text-critical-text">Medical note</p>
                  <p className="mt-1 text-body-sm text-fg">{r.medicalNote}</p>
                </div>
              )}
              <div className="rounded-card border border-edge bg-canvas p-4">
                <p className="text-body-sm font-semibold text-fg">Emergency contacts & next of kin</p>
                <div className="mt-2 flex flex-col gap-3">
                  {r?.emergency.map((c) => (
                    <div key={`${c.name}-${c.phone}`} className="flex items-baseline justify-between gap-4">
                      <div>
                        <p className="text-body-sm font-medium text-fg">{c.name}</p>
                        <p className="text-caption text-fg-muted">{c.relationship}</p>
                      </div>
                      <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="shrink-0 font-mono text-body-sm font-medium text-accent-text">
                        {c.phone}
                      </a>
                    </div>
                  ))}
                  {r?.emergency.length === 0 && (
                    <p className="text-body-sm text-warning-text">No emergency contact on file — add one.</p>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="access" className="flex flex-col gap-4">
              {r?.credentials.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-card border border-edge bg-surface p-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-card bg-accent-subtle">
                    <KeyRound aria-hidden className="size-5 text-accent-text" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-body-sm font-medium text-fg">{c.label}</p>
                    <p className="text-caption text-fg-muted">
                      {credentialKindLabel[c.kind]} · issued {fmtWhen(`${c.issuedAt}T12:00:00`)}
                    </p>
                  </div>
                  <StatusPill
                    tone={c.status === "active" ? "success" : c.status === "lost" ? "critical" : "neutral"}
                  >
                    {c.status === "active" ? "Active" : c.status === "lost" ? "Lost" : "Returned"}
                  </StatusPill>
                  {c.status === "active" && r && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCredentialStatus(r.id, c.id, "lost");
                        toast({ tone: "neutral", title: `${c.label} marked lost`, description: "Deactivate it at the access panel too." });
                      }}
                    >
                      Mark lost
                    </Button>
                  )}
                  {c.status === "lost" && r && (
                    <Button variant="ghost" size="sm" onClick={() => setCredentialStatus(r.id, c.id, "active")}>
                      Found — reactivate
                    </Button>
                  )}
                </div>
              ))}
              {r && (
                <div className="rounded-card border border-edge bg-canvas p-4">
                  <p className="text-body-sm font-medium text-fg">Issue a credential</p>
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <Select
                      aria-label="Credential type"
                      className="w-40"
                      options={Object.entries(credentialKindLabel).map(([value, label]) => ({ value, label }))}
                      value={credKind}
                      onValueChange={(v) => setCredKind(v as CredentialKind)}
                    />
                    <Input
                      aria-label="Credential label"
                      placeholder={`e.g. FOB-${r.apartment}-C`}
                      value={credLabel}
                      onChange={(e) => setCredLabel(e.target.value)}
                      className="w-44"
                    />
                    <Button
                      variant="secondary"
                      disabled={!credLabel.trim()}
                      onClick={() => {
                        addCredential(r.id, credKind, credLabel);
                        setCredLabel("");
                        toast({ tone: "success", title: "Credential issued" });
                      }}
                    >
                      <Plus aria-hidden /> Issue
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="flex flex-col gap-4">
              {r && (
                <div className="rounded-card border border-edge bg-canvas p-4">
                  <p className="text-body-sm font-medium text-fg">Log an entry</p>
                  <div className="mt-3 flex flex-col gap-2">
                    <Select
                      aria-label="History entry type"
                      className="w-44"
                      options={Object.entries(historyKindMeta).map(([value, m]) => ({ value, label: m.label }))}
                      value={histKind}
                      onValueChange={(v) => setHistKind(v as HistoryKind)}
                    />
                    <div className="flex items-end gap-2">
                      <Input
                        aria-label="New history entry"
                        placeholder="What happened — kept on the resident's record"
                        value={histText}
                        onChange={(e) => setHistText(e.target.value)}
                      />
                      <Button
                        variant="secondary"
                        className="shrink-0"
                        disabled={!histText.trim()}
                        onClick={() => {
                          addHistory(r.id, { kind: histKind, by: "Concierge desk", text: histText.trim() });
                          setHistText("");
                          toast({ tone: "success", title: `${historyKindMeta[histKind].label} logged` });
                        }}
                      >
                        Add entry
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              {r?.history.length === 0 && (
                <p className="text-body-sm text-fg-muted">Clean record — nothing logged.</p>
              )}
              {r?.history.map((h) => (
                <div key={h.id} className="rounded-card border border-edge bg-surface p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <StatusPill tone={historyKindMeta[h.kind].tone}>{historyKindMeta[h.kind].label}</StatusPill>
                    <p className="text-caption text-fg-muted">
                      {fmtWhen(h.at)} · {h.by}
                    </p>
                  </div>
                  <p className="mt-2 text-body-sm text-fg">{h.text}</p>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="parcels" className="flex flex-col gap-3">
              {myParcels.length === 0 && (
                <p className="text-body-sm text-fg-muted">No parcels on the register for {r?.apartment}.</p>
              )}
              {myParcels.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-card border border-edge bg-surface p-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-card bg-accent-subtle">
                    <Package aria-hidden className="size-5 text-accent-text" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-body-sm font-medium text-fg">
                      {p.carrier} · {p.description}
                    </p>
                    <p className="text-caption text-fg-muted">received {fmtWhen(p.receivedAt)}</p>
                  </div>
                  {p.status === "awaiting" ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        markCollected(p.id);
                        toast({ tone: "success", title: "Parcel marked collected" });
                      }}
                    >
                      Mark collected
                    </Button>
                  ) : (
                    <StatusPill tone="success">Collected</StatusPill>
                  )}
                </div>
              ))}
              <p className="text-caption text-fg-muted">
                Shared with the concierge desk parcel register — one source of truth.
              </p>
            </TabsContent>

            <TabsContent value="bookings" className="flex flex-col gap-4">
              {r && (
                <div className="rounded-card border border-edge bg-canvas p-4">
                  <p className="text-body-sm font-medium text-fg">Book an amenity</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Select
                      aria-label="Amenity"
                      options={AMENITIES.map((a) => ({ value: a.id, label: `${a.name} · ${a.where}` }))}
                      value={bkAmenity}
                      onValueChange={(v) => setBkAmenity(v as AmenityId)}
                    />
                    <Input aria-label="Booking date" type="date" value={bkDate} onChange={(e) => setBkDate(e.target.value)} />
                    <div className="flex gap-2">
                      <Select
                        aria-label="Start time"
                        className="flex-1"
                        options={Array.from({ length: 15 }, (_, i) => i + 8).map((h) => ({ value: String(h), label: fmtTime(h) }))}
                        value={bkStart}
                        onValueChange={setBkStart}
                      />
                      <Select
                        aria-label="Duration"
                        className="flex-1"
                        options={[1, 2, 3, 4].map((h) => ({ value: String(h), label: `${h} h` }))}
                        value={bkHours}
                        onValueChange={setBkHours}
                      />
                    </div>
                    <Input
                      aria-label="Guests"
                      type="number"
                      min={1}
                      max={30}
                      value={bkGuests}
                      onChange={(e) => setBkGuests(e.target.value)}
                      placeholder="Guests"
                    />
                  </div>
                  <Button
                    className="mt-3"
                    variant="secondary"
                    onClick={() => {
                      addBooking({
                        residentId: r.id,
                        amenityId: bkAmenity,
                        date: bkDate,
                        start: Number(bkStart),
                        end: Number(bkStart) + Number(bkHours),
                        guests: Math.max(1, Number(bkGuests) || 1),
                      });
                      toast({
                        tone: "success",
                        title: "Booking requested",
                        description: "The building manager confirms amenity bookings.",
                      });
                    }}
                  >
                    <CalendarCheck2 aria-hidden /> Request booking
                  </Button>
                </div>
              )}
              {myBookings.map((b) => {
                const amenity = AMENITIES.find((a) => a.id === b.amenityId);
                const meta = bookingStatusMeta[b.status];
                return (
                  <div key={b.id} className="flex items-center justify-between gap-3 rounded-card border border-edge bg-surface p-3.5">
                    <div>
                      <p className="text-body-sm font-medium text-fg">{amenity?.name}</p>
                      <p className="text-caption text-fg-muted">
                        {fmtDate(b.date)} · {fmtTime(b.start)}–{fmtTime(b.end)} · {b.guests} guests
                      </p>
                    </div>
                    <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                  </div>
                );
              })}
              {myBookings.length === 0 && (
                <p className="text-body-sm text-fg-muted">No amenity bookings yet.</p>
              )}
            </TabsContent>

            <TabsContent value="requests" className="flex flex-col gap-4">
              {r && (
                <div className="rounded-card border border-edge bg-canvas p-4">
                  <p className="text-body-sm font-medium text-fg">New request</p>
                  <div className="mt-3 flex flex-col gap-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Select
                        aria-label="Request type"
                        options={Object.entries(requestKindMeta).map(([value, m]) => ({ value, label: m.label }))}
                        value={reqKind}
                        onValueChange={(v) => setReqKind(v as RequestKind)}
                      />
                      <Input aria-label="Preferred date" type="date" value={reqDate} onChange={(e) => setReqDate(e.target.value)} />
                    </div>
                    <div className="flex items-end gap-2">
                      <Input
                        aria-label="Request detail"
                        placeholder="e.g. Old couch + mattress for hard rubbish"
                        value={reqDetail}
                        onChange={(e) => setReqDetail(e.target.value)}
                      />
                      <Button
                        variant="secondary"
                        className="shrink-0"
                        disabled={!reqDetail.trim()}
                        onClick={() => {
                          const ref = addRequest({
                            residentId: r.id,
                            kind: reqKind,
                            detail: reqDetail.trim(),
                            preferredDate: reqDate || undefined,
                          });
                          setReqDetail("");
                          toast({
                            tone: "success",
                            title: `Request ${ref} lodged`,
                            description: `${requestKindMeta[reqKind].label} — the desk will schedule it`,
                          });
                        }}
                      >
                        Submit request
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              {myRequests.map((q) => {
                const meta = requestStatusMeta[q.status];
                return (
                  <div key={q.id} className="rounded-card border border-edge bg-surface p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-body-sm font-medium text-fg">{q.ref}</p>
                      <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                    </div>
                    <p className="mt-1.5 text-body-sm text-fg">{q.detail}</p>
                    <p className="mt-1 text-caption text-fg-muted">
                      {requestKindMeta[q.kind].label}
                      {q.preferredDate ? ` · preferred ${fmtDate(q.preferredDate)}` : ""}
                    </p>
                  </div>
                );
              })}
              {myRequests.length === 0 && <p className="text-body-sm text-fg-muted">No requests yet.</p>}
            </TabsContent>
          </Tabs>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

/* ---------------------------------------------------------------- */
/* Page                                                              */
/* ---------------------------------------------------------------- */

export default function ResidentsPage() {
  const ready = useResidentsReady();
  const conciergeReady = useConciergeReady();
  const residents = useResidentsStore((s) => s.residents);
  const bookings = useResidentsStore((s) => s.bookings);
  const requests = useResidentsStore((s) => s.requests);
  const setBookingStatus = useResidentsStore((s) => s.setBookingStatus);
  const setRequestStatus = useResidentsStore((s) => s.setRequestStatus);
  const parcels = useConciergeStore((s) => s.parcels);
  const { toast } = useToast();

  const [query, setQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [openId, setOpenId] = React.useState<string | null>(null);

  if (!ready || !conciergeReady) return null;

  const visible = residents.filter((r) => {
    const q = query.trim().toLowerCase();
    const matches =
      !q || r.name.toLowerCase().includes(q) || r.apartment.includes(q) || r.email.toLowerCase().includes(q);
    const byType = typeFilter === "all" || r.type === typeFilter;
    return matches && byType;
  });

  const awaitingParcels = parcels.filter((p) => p.status === "awaiting").length;
  const openRequests = requests.filter((q) => q.status === "new" || q.status === "scheduled" || q.status === "in-progress");
  const pendingBookings = bookings.filter((b) => b.status === "pending");
  const upcomingBookings = [...bookings].sort((a, b) => a.date.localeCompare(b.date));
  const residentById = new Map(residents.map((r) => [r.id, r]));

  return (
    <>
      <PageHeader
        eyebrow="Concierge · Residents"
        title="Residents"
        description="Enrolment, emergency details, access credentials, conduct history, amenity bookings and requests — private to the concierge / building-management organisation."
        actions={<EnrolModal />}
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard label="Residents" value={residents.filter((r) => r.status !== "former").length} context={`${residents.filter((r) => r.type === "tenant").length} tenants`} icon={Users} />
        <MetricCard label="Parcels awaiting" value={awaitingParcels} context="Concierge register" icon={Package} tone={awaitingParcels ? "accent" : "neutral"} />
        <MetricCard label="Open requests" value={openRequests.length} context="Hard rubbish, maintenance, guests…" icon={ClipboardList} tone={openRequests.length ? "warning" : "neutral"} />
        <MetricCard label="Bookings to approve" value={pendingBookings.length} context={`${bookings.length} upcoming total`} icon={CalendarCheck2} tone={pendingBookings.length ? "warning" : "neutral"} />
      </div>

      <div className="mt-10">
        <SectionHeader title="Directory" description="Search by name, apartment or email — open a resident for the full record." />
        <FilterBar>
          <SearchInput
            className="w-72"
            placeholder="Search residents…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <SegmentedControl
            label="Residency filter"
            value={typeFilter}
            onValueChange={setTypeFilter}
            options={[
              { value: "all", label: "All" },
              { value: "owner-occupier", label: "Owner-occupiers" },
              { value: "tenant", label: "Tenants" },
            ]}
          />
        </FilterBar>

        {visible.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No residents match"
            description="Clear the search or enrol the resident — enrolment takes under a minute."
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Resident</Th>
                <Th>Residency</Th>
                <Th>Contact</Th>
                <Th numeric>Credentials</Th>
                <Th>Record</Th>
                <Th numeric>Parcels</Th>
                <Th className="text-right">Action</Th>
              </Tr>
            </THead>
            <TBody>
              {visible.map((r) => {
                const warnings = r.history.filter((h) => h.kind === "warning").length;
                const complaints = r.history.filter((h) => h.kind === "complaint" || h.kind === "incident").length;
                const awaiting = parcels.filter((p) => p.apartment === r.apartment && p.status === "awaiting").length;
                const activeCreds = r.credentials.filter((c) => c.status === "active").length;
                const lostCreds = r.credentials.filter((c) => c.status === "lost").length;
                return (
                  <Tr key={r.id}>
                    <Td>
                      <span className="flex items-center gap-3">
                        <Avatar name={r.name} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{r.name}</span>
                          <span className="block truncate text-caption text-fg-muted">
                            Apt {r.apartment} · level {r.floor}
                            {r.status === "moving-out" ? " · moving out" : ""}
                          </span>
                        </span>
                      </span>
                    </Td>
                    <Td>
                      <Badge tone="neutral">{r.type === "tenant" ? "Tenant" : "Owner-occupier"}</Badge>
                    </Td>
                    <Td>
                      <span className="font-mono text-body-sm text-fg-secondary">{r.phone}</span>
                    </Td>
                    <Td numeric>
                      <span className="font-numeric tabular-nums">{activeCreds}</span>
                      {lostCreds > 0 && (
                        <Badge tone="critical" className="ml-2">
                          {lostCreds} lost
                        </Badge>
                      )}
                    </Td>
                    <Td>
                      {warnings > 0 ? (
                        <StatusPill tone="critical">
                          {warnings} warning{warnings === 1 ? "" : "s"}
                        </StatusPill>
                      ) : complaints > 0 ? (
                        <StatusPill tone="warning">
                          {complaints} logged
                        </StatusPill>
                      ) : (
                        <StatusPill tone="success">Clear</StatusPill>
                      )}
                    </Td>
                    <Td numeric>
                      {awaiting > 0 ? <Badge tone="accent">{awaiting} awaiting</Badge> : <span className="text-fg-muted">—</span>}
                    </Td>
                    <Td className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setOpenId(r.id)} aria-label={`Open ${r.name}`}>
                        Open resident
                      </Button>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        )}
      </div>

      <div className="mt-10">
        <SectionHeader
          title="Amenity bookings"
          description="Cinema, karaoke, BBQ terrace, private dining, pool hire and the PT room — pending requests need the building manager's confirmation."
        />
        {upcomingBookings.length === 0 ? (
          <EmptyState icon={CalendarCheck2} title="No bookings" description="Residents book amenities from their record — requests land here." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {upcomingBookings.map((b) => {
              const amenity = AMENITIES.find((a) => a.id === b.amenityId);
              const who = residentById.get(b.residentId);
              const meta = bookingStatusMeta[b.status];
              return (
                <Card key={b.id}>
                  <CardHeader>
                    <div>
                      <CardTitle>{amenity?.name}</CardTitle>
                      <p className="mt-1 text-body-sm text-fg-muted">
                        {who?.name} · Apt {who?.apartment}
                      </p>
                    </div>
                    <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                  </CardHeader>
                  <CardBody>
                    <p className="text-body-sm text-fg">
                      {fmtDate(b.date)} · {fmtTime(b.start)}–{fmtTime(b.end)} · {b.guests} guests
                      <span className="text-fg-muted"> · {amenity?.where} · cap {amenity?.capacity}</span>
                    </p>
                    {b.note && <p className="mt-1 text-caption text-fg-muted">{b.note}</p>}
                    {amenity && b.guests > amenity.capacity && (
                      <p className="mt-1.5 text-body-sm text-warning-text">
                        Over the room capacity of {amenity.capacity} — confirm numbers before approving.
                      </p>
                    )}
                  </CardBody>
                  {b.status === "pending" && (
                    <CardFooter>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setBookingStatus(b.id, "declined");
                          toast({ tone: "neutral", title: "Booking declined" });
                        }}
                      >
                        Decline
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setBookingStatus(b.id, "confirmed");
                          toast({ tone: "success", title: `${amenity?.name} confirmed`, description: `${fmtDate(b.date)} · ${fmtTime(b.start)}–${fmtTime(b.end)}` });
                        }}
                      >
                        Confirm booking
                      </Button>
                    </CardFooter>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-10">
        <SectionHeader
          title="Requests queue"
          description="Hard rubbish, in-apartment maintenance, guest access and move bookings lodged by residents."
        />
        {requests.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No requests" description="Resident requests land here for scheduling." />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Ref</Th>
                <Th>Resident</Th>
                <Th>Type</Th>
                <Th>Detail</Th>
                <Th>Preferred</Th>
                <Th>Status</Th>
                <Th className="text-right">Action</Th>
              </Tr>
            </THead>
            <TBody>
              {requests.map((q) => {
                const who = residentById.get(q.residentId);
                const meta = requestStatusMeta[q.status];
                return (
                  <Tr key={q.id}>
                    <Td className="font-mono">{q.ref}</Td>
                    <Td>
                      <span className="block font-medium">{who?.name}</span>
                      <span className="block text-caption text-fg-muted">Apt {who?.apartment}</span>
                    </Td>
                    <Td>
                      <Badge tone="neutral">{requestKindMeta[q.kind].label}</Badge>
                    </Td>
                    <Td className="max-w-72">
                      <span className="block truncate" title={q.detail}>
                        {q.detail}
                      </span>
                    </Td>
                    <Td>{fmtDate(q.preferredDate)}</Td>
                    <Td>
                      <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                    </Td>
                    <Td className="text-right">
                      {q.status === "new" && (
                        <span className="inline-flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setRequestStatus(q.id, "declined");
                              toast({ tone: "neutral", title: `${q.ref} declined` });
                            }}
                          >
                            Decline
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setRequestStatus(q.id, "scheduled");
                              toast({ tone: "success", title: `${q.ref} scheduled`, description: q.preferredDate ? `Preferred ${fmtDate(q.preferredDate)}` : undefined });
                            }}
                          >
                            Schedule
                          </Button>
                        </span>
                      )}
                      {(q.status === "scheduled" || q.status === "in-progress") && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setRequestStatus(q.id, "done");
                            toast({ tone: "success", title: `${q.ref} done` });
                          }}
                        >
                          Mark done
                        </Button>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        )}
      </div>

      <ResidentDrawer
        resident={residents.find((r) => r.id === openId) ?? null}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}
