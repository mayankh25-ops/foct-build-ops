import type { ModuleDefinition, ModuleId } from "./types";

/**
 * The module registry — single source of truth for what modules exist,
 * their catalogue status, and what they contribute to navigation.
 *
 * Rules (CLAUDE.md):
 * - Disabled modules must never look broken: "coming_soon" and
 *   "not_enabled" get polished placeholder states, nothing more.
 * - Do not build features for non-active modules beyond that shell.
 * - Statuses here are catalogue defaults; per-building enablement is an
 *   explicit row in building_modules (later stage), never an implicit default.
 */
export const modules: readonly ModuleDefinition[] = [
  {
    id: "core",
    name: "Core",
    status: "active",
    nav: { label: "Dashboard", href: "/", order: 0 },
  },
  {
    id: "cleaning-ops",
    name: "CleaningOps",
    status: "active",
    nav: { label: "Cleaning", href: "/cleaning", order: 10 },
  },
  {
    id: "concierge-desk",
    name: "ConciergeDesk",
    status: "not_enabled",
    nav: { label: "Concierge", href: "/concierge", order: 20 },
  },
  {
    id: "building-calendar",
    name: "Building Calendar",
    status: "coming_soon",
    nav: { label: "Calendar", href: "/calendar", order: 30 },
  },
  {
    id: "tasks",
    name: "Tasks",
    status: "coming_soon",
    nav: { label: "Tasks", href: "/tasks", order: 40 },
  },
  {
    id: "consumables",
    name: "Consumables",
    status: "coming_soon",
    nav: { label: "Consumables", href: "/consumables", order: 50 },
  },
  {
    id: "audits",
    name: "Audits",
    status: "coming_soon",
    nav: { label: "Audits", href: "/audits", order: 60 },
  },
  {
    id: "floor-plans",
    name: "Floor Plans",
    status: "coming_soon",
    nav: { label: "Floor Plans", href: "/floor-plans", order: 70 },
  },
  {
    id: "parcels",
    name: "Parcels",
    status: "coming_soon",
    nav: { label: "Parcels", href: "/parcels", order: 80 },
  },
  {
    id: "resident-requests",
    name: "Resident Requests",
    status: "coming_soon",
    nav: { label: "Requests", href: "/requests", order: 90 },
  },
  {
    id: "contractors",
    name: "Contractors",
    status: "coming_soon",
    nav: { label: "Contractors", href: "/contractors", order: 100 },
  },
  {
    id: "integrations",
    name: "Integrations",
    status: "coming_soon",
    nav: { label: "Integrations", href: "/integrations", order: 110 },
  },
];

export function getModule(id: ModuleId): ModuleDefinition {
  const found = modules.find((m) => m.id === id);
  if (!found) throw new Error(`Module not registered: ${id}`);
  return found;
}

/** Modules that contribute a nav item, in display order. */
export function navModules(): ModuleDefinition[] {
  return modules
    .filter((m): m is ModuleDefinition & { nav: NonNullable<ModuleDefinition["nav"]> } => m.nav !== null)
    .sort((a, b) => a.nav.order - b.nav.order);
}
