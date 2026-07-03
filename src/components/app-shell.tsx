"use client";

import {
  Bot,
  Building2,
  Cctv,
  ClipboardList,
  LayoutDashboard,
  LayoutGrid,
  Map,
  MonitorSmartphone,
  Package,
  ScanLine,
  SprayCan,
  Timer,
  Waves,
} from "lucide-react";
import Link from "next/link";
import { Sidebar } from "@/components/ui/sidebar";
import { ToastProvider } from "@/components/ui/toast";
import { TopBar } from "@/components/ui/top-bar";
import { building } from "@/lib/demo-data";

/**
 * AppShell. Theme comes from the building's assignment in Stage 2; for the
 * design review the app renders in Graphite — the retuned TailAdmin-inspired
 * default (owner direction, DECISIONS.md 2026-07-03). Switch data-theme to
 * "harbour" etc. to preview a building-assigned theme.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="graphite" className="flex h-screen overflow-hidden bg-canvas text-fg">
      <Sidebar
        buildingName={building.name}
        className="hidden lg:flex"
        sections={[
          {
            items: [
              { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
              { label: "Module access", icon: LayoutGrid, href: "/modules" },
            ],
          },
          {
            title: "Cleaning operations",
            items: [
              { label: "Roster", icon: ClipboardList, href: "/roster" },
              { label: "Timesheets", icon: Timer, href: "/timesheets" },
              { label: "Consumables", icon: SprayCan, href: "/consumables" },
            ],
          },
          {
            title: "Building modules",
            items: [
              { label: "Concierge desk", icon: Building2, disabled: true, disabledLabel: "Locked" },
              { label: "Parcels", icon: Package, disabled: true },
              { label: "Resident requests", icon: MonitorSmartphone, disabled: true },
              { label: "Floor plans", icon: Map, disabled: true, disabledLabel: "Pro" },
              { label: "Robots", icon: Bot, disabled: true, disabledLabel: "Pro" },
              { label: "Camera analytics", icon: Cctv, disabled: true, disabledLabel: "Pro" },
              { label: "Building automation", icon: Waves, disabled: true, disabledLabel: "Pro" },
            ],
          },
        ]}
        footer={
          <div className="flex flex-col gap-3">
            <Link
              href="/kiosk"
              className="flex items-center gap-2.5 text-body-sm font-medium text-sidebar-muted transition-colors hover:text-sidebar-fg"
            >
              <ScanLine aria-hidden className="size-4" />
              Open check-in kiosk
            </Link>
            <p className="text-caption text-sidebar-muted">
              {building.org} · {building.manager.role}
            </p>
          </div>
        }
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          buildingName={building.name}
          orgName={building.org}
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
