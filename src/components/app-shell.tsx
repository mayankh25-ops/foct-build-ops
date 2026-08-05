"use client";

import * as React from "react";

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
  Music2,
  Package,
  PersonStanding,
  ScanLine,
  ShieldCheck,
  SprayCan,
  Ticket,
  Timer,
  UsersRound,
  Waves,
  UserCog,
} from "lucide-react";
import { Building2 as SiteIcon, HeartPulse, IdCard, Palette, Plug } from "lucide-react";
import { Sidebar } from "@/components/ui/sidebar";
import { ToastProvider } from "@/components/ui/toast";
import { TopBar } from "@/components/ui/top-bar";
import { fontSlotStyle, ThemeRuntimeStyles } from "@/components/theme-runtime";
import { building } from "@/lib/demo-data";
import { BUILTIN_THEMES } from "@/lib/theme-registry";
import { DEFAULT_THEME, useThemeRehydrate, useThemeStore } from "@/lib/theme-store";
import { useRouter } from "next/navigation";
import { signOut, useSessionInit, useSessionStore } from "@/lib/session";

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
  useSessionInit();
  const router = useRouter();
  const sessionStatus = useSessionStore((s) => s.status);
  const profile = useSessionStore((s) => s.profile);
  const activeOrgId = useSessionStore((s) => s.activeOrgId);

  // live mode: unauthenticated users go to sign-in; demo mode never redirects
  React.useEffect(() => {
    if (sessionStatus === "signed-out") router.replace("/sign-in");
  }, [sessionStatus, router]);

  const membership = profile?.memberships.find((m) => m.org_id === activeOrgId);

  const assigned = useThemeStore((s) => s.assignedTheme);
  const customThemes = useThemeStore((s) => s.customThemes);
  const fontSlots = useThemeStore((s) => s.fontSlots);
  const uploadedFonts = useThemeStore((s) => s.uploadedFonts);

  const custom = customThemes.find((t) => t.slug === assigned);
  // stale persisted slugs (e.g. a since-deleted review variant) fall back
  const isKnown = custom || BUILTIN_THEMES.some((t) => t.slug === assigned);
  const dataTheme = custom ? custom.baseTheme : isKnown ? assigned : DEFAULT_THEME;
  // live mode: never paint the portal before the session is resolved — a
  // quiet gate screen covers loading AND the signed-out redirect in flight
  if (sessionStatus === "loading" || sessionStatus === "signed-out") {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <div className="flex items-center gap-3 text-fg-muted">
          <span aria-hidden className="size-3 animate-pulse rounded-pill bg-accent" />
          <p className="text-body-sm">
            {sessionStatus === "loading" ? "Checking your session…" : "Taking you to sign in…"}
          </p>
        </div>
      </div>
    );
  }

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
              { label: "Residents", icon: UsersRound, href: "/residents" },
              { label: "Parcels", icon: Package, disabled: true },
              { label: "Ambient audio", icon: Music2, disabled: true },
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
            items: [
              { label: "Sites", icon: SiteIcon, href: "/settings/sites" },
              // portal logins (invitations) — distinct from the cleaners below,
              // who sign in on a tablet with a PIN and never see this app
              { label: "People", icon: UserCog, href: "/settings/people" },
              { label: "Cleaners & kiosks", icon: IdCard, href: "/settings/staff" },
              { label: "Appearance", icon: Palette, href: "/settings/appearance" },
              { label: "Integrations", icon: Plug, href: "/settings/integrations" },
              // last, because you only look for it when something is wrong —
              // and when something IS wrong it must be findable without help
              { label: "System health", icon: HeartPulse, href: "/settings/health" },
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
          orgName={membership?.org_name ?? building.org}
          buildingName={profile?.buildings[0]?.name ?? building.name}
          userName={profile?.name ?? building.manager.name}
          userRole={membership?.role_name ?? building.manager.role}
          onSignOut={
            sessionStatus === "ready"
              ? () => {
                  void signOut().then(() => router.replace("/sign-in"));
                }
              : undefined
          }
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
