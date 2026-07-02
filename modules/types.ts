/**
 * Module system contracts. Every product area is a module declared in
 * modules/registry.ts; the app shell renders navigation and gating from
 * the registry, never from hardcoded lists.
 */

export type ModuleId =
  | "core"
  | "cleaning-ops"
  | "concierge-desk"
  | "building-calendar"
  | "tasks"
  | "consumables"
  | "audits"
  | "floor-plans"
  | "parcels"
  | "resident-requests"
  | "contractors"
  | "integrations";

/**
 * Catalogue-level status (product-wide default).
 * Per-building enablement is a separate concern and lives in the
 * building_modules table once the database schema ships.
 *
 * - "active"      — built and available.
 * - "coming_soon" — registered, shows a polished "Coming soon" state.
 * - "not_enabled" — built or planned, but off unless a building enables it;
 *                   shows "Not enabled for this building".
 */
export type ModuleStatus = "active" | "coming_soon" | "not_enabled";

export interface ModuleNavContribution {
  /** Label shown in the app navigation. */
  label: string;
  /** Route the nav item points at (module root). */
  href: string;
  /** Sort order within the nav; lower renders first. */
  order: number;
}

export interface ModuleDefinition {
  id: ModuleId;
  name: string;
  status: ModuleStatus;
  /** null = module contributes nothing to the main navigation. */
  nav: ModuleNavContribution | null;
}
