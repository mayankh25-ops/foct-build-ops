"use client";

/**
 * "You haven't added a site yet."
 *
 * The screen that used to be a spinner that never stopped.
 *
 * Cleaners, kiosk tablets, notices and attendance all hang off a building. With
 * no building there is nothing to fetch — but the code returned early from the
 * effect WITHOUT clearing its loading flag, so the spinner ran forever and the
 * app looked broken when in fact it was simply empty. Four screens, one cause.
 *
 * The fix is two halves and both are needed: clear the flag on the bail-out
 * path, and render something that says what to do next. This is that something.
 */
import Link from "next/link";
import { Building2, HeartPulse, Plus } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";

export function NoSiteState({ what }: { what: string }) {
  return (
    <EmptyState
      icon={Building2}
      title="Add a site first"
      description={`${what} belong to a building, and you haven't added one yet. It takes about twenty seconds.`}
      action={
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/settings/sites"
            className="inline-flex items-center gap-2 rounded-control bg-accent px-3.5 py-2 text-body-sm text-on-accent hover:bg-accent-hover"
          >
            <Plus aria-hidden className="size-4" />
            Add a site
          </Link>
          <Link
            href="/settings/health"
            className="inline-flex items-center gap-2 rounded-control border border-edge bg-surface px-3.5 py-2 text-body-sm text-fg hover:bg-hover"
          >
            <HeartPulse aria-hidden className="size-4" />
            Check system health
          </Link>
        </div>
      }
    />
  );
}
