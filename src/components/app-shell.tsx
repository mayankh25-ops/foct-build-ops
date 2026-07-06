"use client";

import {
  Bot,
  Building2,
  CalendarDays,
  Cctv,
  ClipboardList,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  Map,
  MonitorSmartphone,
  Package,
  PersonStanding,
  ScanLine,
  ShieldCheck,
  SprayCan,
  Ticket,
  Timer,
  Waves,
} from "lucide-react";
import { Sidebar } from "@/components/ui/sidebar";
import { ToastProvider } from "@/components/ui/toast";
import { TopBar } from "@/components/ui/top-bar";
import { building } from "@/lib/demo-data";

/**
 * AppShell. Theme comes from the building's assignment in Stage 2; the design
 * review renders Graphite (owner-reference look, DECISIONS.md 2026-07-03).
 * Nav mirrors module packaging: locked modules stay visible but polished-off.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="option-sunset" className="flex h-screen overflow-hidden bg-canvas text-fg">
      <Sidebar
        buildingName={building.name}
        className="hidden lg:flex"
        sections={[
          {
            title: "Core",
            items: [
              { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
              { label: "Service desk", icon: Ticket, href: "/service-desk" },
              { label: "Tasks & incidents", icon: ListChecks, disabled: true },
              { label: "Calendar", icon: CalendarDays, disabled: true },
              { label: "Floor plans", icon: Map, disabled: true, disabledLabel: "Pro" },
              { label: "Module access", icon: LayoutGrid, href: "/modules" },
            ],
          },
          {
            title: "Cleaning",
            items: [
              { label: "Roster", icon: ClipboardList, href: "/roster" },
              { label: "Kiosk & QR", icon: ScanLine, href: "/kiosk" },
              { label: "Timesheets", icon: Timer, href: "/timesheets" },
              { label: "Site audits", icon: ShieldCheck, disabled: true },
              { label: "Consumables", icon: SprayCan, href: "/consumables" },
            ],
          },
          {
            title: "Concierge",
            items: [
              { label: "Concierge desk", icon: Building2, disabled: true, disabledLabel: "Locked" },
              { label: "Parcels", icon: Package, disabled: true },
              { label: "Resident requests", icon: MonitorSmartphone, disabled: true },
            ],
          },
          {
            title: "Automation",
            items: [
              { label: "People counting", icon: PersonStanding, disabled: true, disabledLabel: "Pro" },
              { label: "Lift control", icon: Landmark, disabled: true, disabledLabel: "Pro" },
              { label: "Robots", icon: Bot, disabled: true, disabledLabel: "Pro" },
              { label: "Camera analytics", icon: Cctv, disabled: true, disabledLabel: "Pro" },
              { label: "Building automation", icon: Waves, disabled: true, disabledLabel: "Pro" },
            ],
          },
        ]}
        footer={
          <p className="text-caption text-sidebar-muted">
            {building.org} · {building.manager.role}
          </p>
        }
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          orgName={building.org}
          buildingName={building.name}
          userName={building.manager.name}
          userRole={building.manager.role}
        />
        <ToastProvider>
          <main className="min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1440px] px-6 py-8 lg:px-10">{children}</div>
          </main>
        </ToastProvider>
      </div>
    </div>
  );
}
