"use client";

import * as React from "react";
import Link from "next/link";
import { Camera, ClipboardList, Search } from "lucide-react";
import { JobStatusPill, SyncedChip, MicroLabel } from "@/app/support/support-ui";
import { sdSiteStaff } from "@/lib/service-desk-data";
import { useSdRehydrate, useSdStore } from "@/lib/service-desk-store";
import { building } from "@/lib/demo-data";

const CONCIERGE = sdSiteStaff.concierges[0] ?? "Amelia Ng";

export default function SupportHomePage() {
  useSdRehydrate();
  const tickets = useSdStore((s) => s.tickets);
  const mine = tickets.filter((t) => t.lodgedBy === CONCIERGE);
  const today = tickets.slice(0, 3);

  return (
    <main className="flex flex-1 flex-col px-5 pt-14 pb-9">
      <div className="flex items-center justify-between pb-4">
        <p className="font-display text-body-sm font-bold tracking-tight">FOCT BuildingOps</p>
        <SyncedChip />
      </div>

      <h1 className="font-display text-title-1 font-extrabold tracking-tight text-fg">
        Good morning,
        <br />
        {CONCIERGE.split(" ")[0]}.
      </h1>
      <p className="mt-1 text-body-sm text-fg-muted">{building.name} · Front desk</p>

      <Link
        href="/support/new"
        className="mt-6 flex h-16 items-center justify-center gap-3 rounded-control bg-accent text-body font-bold text-on-accent transition-colors hover:bg-accent-hover [&_svg]:size-5"
      >
        <Camera aria-hidden /> Create ticket
      </Link>
      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <Link
          href="/support/jobs"
          className="flex h-[54px] items-center justify-center gap-2 rounded-control border border-edge-strong/40 bg-surface text-body-sm font-semibold text-fg [&_svg]:size-4"
        >
          <ClipboardList aria-hidden /> My tickets
          <span className="rounded-pill bg-canvas px-2 py-0.5 font-mono text-caption text-fg-secondary">
            {mine.length}
          </span>
        </Link>
        <button
          type="button"
          className="flex h-[54px] items-center justify-center gap-2 rounded-control border border-edge-strong/40 bg-surface text-body-sm font-semibold text-fg [&_svg]:size-4"
        >
          <Search aria-hidden /> Search
        </button>
      </div>

      <div className="mt-7">
        <MicroLabel>Today at {building.name.split(" ")[0]}</MicroLabel>
        <div className="flex flex-col gap-2.5">
          {today.map((t) => (
            <div key={t.ref} className="flex items-center gap-3 rounded-control border border-edge p-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-sm font-semibold text-fg">
                  {t.category} — {t.locations[0]?.area ?? t.locations[0]?.level}
                </p>
                <p className="mt-0.5 font-mono text-caption text-fg-disabled">
                  {t.ref} · {t.locations[0]?.level} · {t.createdAt.replace("Today ", "")}
                </p>
              </div>
              <JobStatusPill status={t.status} />
            </div>
          ))}
        </div>
      </div>

      <p className="mt-auto pt-8 text-center font-mono text-[10px] tracking-[0.08em] text-fg-disabled uppercase">
        Works offline — syncs automatically
      </p>
      <Link href="/service-desk" className="pt-2 text-center text-caption text-fg-muted underline-offset-2 hover:underline">
        Open the desktop dashboard
      </Link>
    </main>
  );
}
