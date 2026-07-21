"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, QrCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { RaiseTicketForm } from "@/components/service-desk/raise-ticket-form";
import { useSdRehydrate } from "@/lib/service-desk-store";

/**
 * Full-page raise-a-ticket — the QR / public-link landing. The desk itself
 * opens the same form in a big modal (owner direction 2026-07-15); this page
 * stays for phone scans and deep links.
 */
export default function RaiseTicketPage() {
  useSdRehydrate();
  const router = useRouter();

  return (
    <>
      <PageHeader
        eyebrow="Service desk"
        title="Raise a ticket"
        description="Under a minute on a phone — pick, snap, submit. The cleaning team is notified instantly."
        actions={
          <Link
            href="/service-desk"
            className="inline-flex h-9 items-center gap-2 rounded-control border border-edge bg-surface px-3.5 text-body-sm font-medium text-fg transition-colors hover:bg-hover [&_svg]:size-4"
          >
            <ArrowLeft aria-hidden /> Back to tickets
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardBody>
            <RaiseTicketForm onDone={() => router.push("/service-desk")} />
          </CardBody>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardBody className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="flex size-24 items-center justify-center rounded-card bg-accent-subtle">
                <QrCode aria-hidden className="size-12 text-accent-text" />
              </span>
              <p className="text-body-sm font-medium text-fg">This form has a public QR + link</p>
              <p className="text-body-sm text-fg-muted">
                Printed at the concierge desk and loading dock. Anyone who scans it lodges into this
                site&apos;s queue — no login, no app install.
              </p>
              <Badge tone="info">Scoped to Aurora on Collins</Badge>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex flex-col gap-2.5 py-5">
              <p className="text-caption font-medium tracking-[0.06em] text-fg-muted uppercase">
                What happens next
              </p>
              <p className="text-body-sm text-fg-secondary">
                1 · On-duty cleaner gets WhatsApp + push within 30 seconds.
              </p>
              <p className="text-body-sm text-fg-secondary">
                2 · They attend, fix, and upload after photos.
              </p>
              <p className="text-body-sm text-fg-secondary">
                3 · You and every follower get the closure email with the before/after PDF — and a
                one-tap 👍/👎.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
