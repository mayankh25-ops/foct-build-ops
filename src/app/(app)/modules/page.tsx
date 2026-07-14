import type { Metadata } from "next";
import {
  Bot,
  Building2,
  Cctv,
  Map,
  MonitorSmartphone,
  Package,
  ShieldCheck,
  SprayCan,
  Ticket,
  Users,
  Waves,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { ModuleCard } from "@/components/ui/module-card";
import { PageHeader } from "@/components/ui/page-header";
import { building } from "@/lib/demo-data";

export const metadata: Metadata = { title: "Module access — FOCT BuildingOps" };

export default function ModulesPage() {
  return (
    <>
      <PageHeader
        eyebrow="FOCT BuildingOps"
        title="Module access"
        description={`What’s enabled for ${building.name}, and what the platform can grow into.`}
      />

      <Card className="mb-8">
        <CardBody className="flex items-start gap-4">
          <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-control bg-accent-subtle">
            <ShieldCheck aria-hidden className="size-5 text-accent-text" />
          </span>
          <div>
            <h2 className="text-title-3 text-fg">Your building access</h2>
            <p className="mt-1.5 max-w-3xl text-body-sm text-fg-secondary">
              You’re signed in with {building.org} as {building.manager.role.toLowerCase()}. You see
              your own cleaners, rosters, timesheets, consumables and audits — for buildings where{" "}
              {building.org} holds a service contract. Concierge records, parcels, resident data and
              other contractors’ information are never visible to cleaning accounts, and module
              access is granted per building by the building owner.
            </p>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ModuleCard
          icon={SprayCan}
          name="CleaningOps"
          description="Sign-in/out, kiosk and QR check-in, rosters, timesheets, missed check-in alerts, consumables, tasks with photos, site audits."
          status="enabled"
        />
        <ModuleCard
          icon={Ticket}
          name="Service desk"
          description="Zendesk-style ticketing: concierge or anyone with the QR/link lodges photo tickets, cleaners attend and close with before/after proof, followers get the closure PDF."
          status="enabled"
        />
        <ModuleCard
          icon={Building2}
          name="Concierge desk"
          description="Front-of-house log, visitor handling and handover notes for concierge teams."
          status="not-enabled"
        />
        <ModuleCard
          icon={Package}
          name="Parcels"
          description="Parcel intake, resident notification and collection tracking at the concierge desk."
          status="coming-soon"
        />
        <ModuleCard
          icon={MonitorSmartphone}
          name="Resident requests"
          description="Maintenance and amenity requests from residents, routed to the right provider."
          status="coming-soon"
        />
        <ModuleCard
          icon={Users}
          name="Contractors"
          description="Inductions, insurance and arrival tracking for visiting trades."
          status="coming-soon"
        />
        <ModuleCard
          icon={Map}
          name="Floor plans"
          description="Interactive levels with zones, assets and task locations."
          status="requires-pro"
        />
        <ModuleCard
          icon={Bot}
          name="Robots"
          description="Fleet status and schedules for cleaning robots, integrated with rosters."
          status="requires-automation-pro"
        />
        <ModuleCard
          icon={Cctv}
          name="Camera analytics"
          description="Presence verification and cleanliness signals from building cameras."
          status="requires-automation-pro"
        />
        <ModuleCard
          icon={Waves}
          name="Building automation"
          description="BMS signals — after-hours air-con, lift access windows, alarm events."
          status="requires-automation-pro"
        />
      </div>
    </>
  );
}
