"use client";

import * as React from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { useSyncStatus } from "@/lib/sd-offline";
import { cn } from "@/lib/cn";

/**
 * SYNCED / QUEUED pill (from the FFM import). Tap to sync now. In demo mode
 * it reports the local store; in live mode it reflects the offline outbox.
 */
export function SyncPill({ className }: { className?: string }) {
  const s = useSyncStatus();

  const label = !s.enabled
    ? "Local demo"
    : s.syncing
      ? "Syncing…"
      : !s.online
        ? `Offline · ${s.pending} queued`
        : s.pending > 0
          ? `Queued ${s.pending}`
          : "Synced";

  const tone = !s.enabled
    ? "bg-hover text-fg-secondary"
    : s.syncing
      ? "bg-info-subtle text-info-text"
      : !s.online
        ? "bg-critical-subtle text-critical-text"
        : s.pending > 0
          ? "bg-warning-subtle text-warning-text"
          : "bg-success-subtle text-success-text";

  return (
    <button
      type="button"
      onClick={s.syncNow}
      title={
        !s.enabled
          ? "Demo mode — data lives on this device; Supabase live mode syncs it"
          : s.lastError
            ? `Last sync error: ${s.lastError} — tap to retry`
            : "Tap to sync now"
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-3 py-1 font-mono text-caption tracking-[0.05em] uppercase",
        tone,
        className
      )}
    >
      {!s.online && s.enabled ? (
        <CloudOff aria-hidden className="size-3.5" />
      ) : (
        <RefreshCw aria-hidden className={cn("size-3.5", s.syncing && "animate-spin")} />
      )}
      {label}
    </button>
  );
}
