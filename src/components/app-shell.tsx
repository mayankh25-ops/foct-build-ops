"use client";

import {
  Bot,
  Building2,
  CalendarDays,
  Cctv,
  ClipboardList,
  FileSearch,
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
import { Palette } from "lucide-react";
import { Sidebar } from "@/components/ui/sidebar";
import { ToastProvider } from "@/components/ui/toast";
import { TopBar } from "@/components/ui/top-bar";
import { fontSlotStyle, ThemeRuntimeStyles } from "@/components/theme-runtime";
import { building } from "@/lib/demo-data";
import { BUILTIN_THEMES } from "@/lib/theme-registry";
import { DEFAULT_THEME, useThemeRehydrate, useThemeStore } from "@/lib/theme-store";

/**
 * AppShell. The rendered theme comes from the building's assignment in the
 * Theme Builder store (Stage 2 moves it to building_theme_assignments).
 * SSR renders the default; the persisted assignment applies post-hydration.
 * Custom themes render as data-theme={base} + data-custom-theme={slug} so
 * they inherit the base's radius/decorations while recolouring (see
 * theme-runtime.tsx). Nav mirrors module packaging: locked modules stay
 * visible but polished-off.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  useThemeRehydrate();
  const assigned = useThemeStore((s) => s.assignedTheme);
  const customThemes = useThemeStore((s) => s.customThemes);
  const fontSlots = useThemeStore((s) => s.fontSlots);
  const uploadedFonts = useThemeStore((s) => s.uploadedFonts);

  const custom = customThemes.find((t) => t.slug === assigned);
  // stale persisted slugs (e.g. a since-deleted review variant) fall back
  const isKnown = custom || BUILTIN_THEMES.some((t) => t.slug === assigned);
  const dataTheme = custom ? custom.baseTheme : isKnown ? assigned : DEFAULT_THEME;

  return (
    <div
      data-theme={dataTheme}
      data-custom-theme={custom?.slug}
      style={fontSlotStyle(fontSlots, uploadedFonts)}
      className="flex h-screen overflow-hidden bg-canvas text-fg"
    >
      <ThemeRuntimeStyles />
      <Sidebar
        buildingName={building.name}
        className="hidden lg:flex"
        sections={[
          {
            title: "Core",
            items: [
              { label: "Portfolio", icon: Building2, href: "/portfolio" },
              { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
              { label: "Service desk", icon: Ticket, href: "/service-desk" },
              { label: "Scope", icon: FileSearch, href: "/scope" },
              { label: "Tasks & incidents", icon: ListChecks, disabled: true },
              { label: "Calendar", icon: CalendarDays, href: "/calendar" },
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
              { label: "Concierge desk", icon: Building2, href: "/concierge" },
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
          {
            title: "Settings",
            items: [{ label: "Appearance", icon: Palette, href: "/settings/appearance" }],
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
            <div className="mx-auto max-w-[1440px] px-6 py-10 lg:px-12">{children}</div>
          </main>
        </ToastProvider>
      </div>
    </div>
  );
}
