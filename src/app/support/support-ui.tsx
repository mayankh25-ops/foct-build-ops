"use client";

/** Shared bits for the Service Desk mobile surface. */
import * as React from "react";
import { StatusPill } from "@/components/ui/badge";
import type { SdStatus } from "@/lib/service-desk-data";
import { sdStatusMeta } from "@/lib/service-desk-data";

/** The mobile surface speaks the design's vocabulary ("Completed", "Assigned"). */
const surfaceLabels: Partial<Record<SdStatus, string>> = {
  open: "Assigned",
  resolved: "Completed",
};

export function JobStatusPill({ status }: { status: SdStatus }) {
  const meta = sdStatusMeta[status];
  return <StatusPill tone={meta.tone}>{surfaceLabels[status] ?? meta.label}</StatusPill>;
}

export function SyncedChip() {
  return (
    <span className="flex items-center gap-1.5 rounded-pill bg-success-subtle px-2.5 py-1">
      <span aria-hidden className="size-1.5 rounded-pill bg-success" />
      <span className="font-mono text-[10px] tracking-[0.08em] text-success-text uppercase">
        Synced
      </span>
    </span>
  );
}

export function MicroLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="pb-2 font-mono text-[10px] tracking-[0.1em] text-fg-muted uppercase">{children}</p>
  );
}

/**
 * Pill control on the phone surface. 44px tall, not 40 — the minimum touch
 * target in both Apple HIG and Material, and this is tapped by someone
 * holding a mop. Asserted in e2e/support-phone.mobile.spec.ts.
 */
export function Chip({
  active,
  dashed,
  onClick,
  children,
}: {
  active?: boolean;
  dashed?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "h-11 rounded-pill border border-fg bg-fg px-4 text-body-sm font-semibold text-surface"
          : dashed
            ? "h-11 rounded-pill border-[1.5px] border-dashed border-edge-strong bg-hover px-4 text-body-sm text-fg-secondary"
            : "h-11 rounded-pill border border-edge-strong/40 bg-surface px-4 text-body-sm text-fg-secondary"
      }
    >
      {children}
    </button>
  );
}
