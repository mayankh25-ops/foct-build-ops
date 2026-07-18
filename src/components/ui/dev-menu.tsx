"use client";

import * as React from "react";
import { Wrench } from "lucide-react";

/**
 * Developer-only affordances (demo reset, sync state) live behind this
 * quiet menu instead of the page header — audit §8: "Remove development
 * actions such as Reset demo and Local demo from production-facing
 * layouts."
 */
export function DevMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Developer options"
        aria-expanded={open}
        title="Developer options"
        onClick={() => setOpen((o) => !o)}
        className="flex size-10 items-center justify-center rounded-control border border-edge bg-surface text-fg-muted transition-colors hover:bg-hover hover:text-fg"
      >
        <Wrench aria-hidden className="size-4" />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close developer options"
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 flex w-64 flex-col items-start gap-3 rounded-card border border-edge bg-raised p-4 shadow-raised">
            <p className="text-caption font-semibold tracking-[0.05em] text-fg-muted uppercase">
              Developer
            </p>
            {children}
          </div>
        </>
      )}
    </div>
  );
}
