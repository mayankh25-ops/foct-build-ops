"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Mail, MessageSquareText, Send, XCircle } from "lucide-react";

import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { CATEGORY_LABELS, type IntegrationCategory } from "@/lib/integrations/catalogue";
import {
  INTEGRATIONS_LIVE_FLAG,
  useIntegrationsStore,
  type SendOutcome,
} from "@/lib/integrations-store";
import { cn } from "@/lib/cn";

/**
 * Test page — fires a REAL email/SMS through whatever provider is active
 * (live mode → /api/integrations/send-test → notify(); demo mode simulates).
 * Proves a provider switch end-to-end: send → check inbox/phone → done.
 */
export default function IntegrationTestPage() {
  const credentials = useIntegrationsStore((s) => s.credentials);
  const sendLog = useIntegrationsStore((s) => s.sendLog);
  const sendTest = useIntegrationsStore((s) => s.sendTest);

  const [channel, setChannel] = React.useState<IntegrationCategory>("email");
  const [to, setTo] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [outcome, setOutcome] = React.useState<SendOutcome | null>(null);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const active = mounted
    ? credentials.find((c) => c.active && c.category === channel)
    : undefined;
  const recipientValid =
    channel === "email" ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) : /^\+?[0-9 ]{8,15}$/.test(to);

  const handleSend = async () => {
    setSending(true);
    setOutcome(null);
    try {
      setOutcome(await sendTest(channel, to.trim()));
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Settings · Integrations"
        title="Send a test"
        description="Sends a real message through the ACTIVE provider for this organisation — the same path notify() uses in production."
        actions={
          <Link
            href="/settings/integrations"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-control border border-edge bg-surface px-3.5 text-body-sm font-medium text-fg shadow-card transition-colors hover:bg-hover"
          >
            <ArrowLeft aria-hidden className="size-4" /> Back to integrations
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <Card>
          <CardBody className="flex flex-col gap-5">
            <SegmentedControl
              label="Test channel"
              options={[
                { value: "email", label: "Email" },
                { value: "sms", label: "SMS" },
              ]}
              value={channel}
              onValueChange={(next) => {
                setChannel(next as IntegrationCategory);
                setTo("");
                setOutcome(null);
              }}
            />

            <div className="flex items-center gap-2 text-body-sm text-fg-secondary">
              {channel === "email" ? (
                <Mail aria-hidden className="size-4 text-fg-muted" />
              ) : (
                <MessageSquareText aria-hidden className="size-4 text-fg-muted" />
              )}
              Active provider:{" "}
              {active ? (
                <StatusPill tone="success">{active.brand}</StatusPill>
              ) : (
                <StatusPill tone="warning">none configured</StatusPill>
              )}
              {!INTEGRATIONS_LIVE_FLAG && <Badge tone="info">Demo mode</Badge>}
            </div>

            <Input
              label={channel === "email" ? "Send test email to" : "Send test SMS to"}
              placeholder={channel === "email" ? "you@example.com" : "+61 4xx xxx xxx"}
              type={channel === "email" ? "email" : "tel"}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              hint={
                channel === "sms"
                  ? "E.164 format (+61…) — alphanumeric senders can't receive replies."
                  : undefined
              }
            />

            <Button
              onClick={handleSend}
              disabled={!recipientValid || !active}
              loading={sending}
              title={!active ? `Configure and activate a ${CATEGORY_LABELS[channel]} provider first` : undefined}
            >
              <Send aria-hidden /> Send test {channel === "email" ? "email" : "SMS"}
            </Button>

            {outcome && (
              <div
                className={cn(
                  "flex items-start gap-2 rounded-control border px-3.5 py-3 text-body-sm",
                  outcome.ok
                    ? "border-success bg-success-subtle text-success-text"
                    : "border-critical bg-critical-subtle text-critical-text"
                )}
              >
                {outcome.ok ? (
                  <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" />
                ) : (
                  <XCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
                )}
                <span>
                  {outcome.ok ? (
                    <>
                      Sent via <strong>{outcome.provider}</strong>
                      {outcome.providerMessageId && (
                        <>
                          {" — message id "}
                          <span className="font-numeric">{outcome.providerMessageId}</span>
                        </>
                      )}
                    </>
                  ) : (
                    outcome.error ?? "Send failed"
                  )}
                </span>
              </div>
            )}
          </CardBody>
        </Card>

        <section>
          <SectionHeader
            title="Recent sends"
            description="notification_log records which provider handled every message."
          />
          {!mounted || sendLog.length === 0 ? (
            <EmptyState
              title="Nothing sent yet"
              description="Test sends appear here with the provider that handled them."
            />
          ) : (
            <Card>
              <Table>
                <THead>
                  <Tr>
                    <Th>When</Th>
                    <Th>Channel</Th>
                    <Th>Provider</Th>
                    <Th>Recipient</Th>
                    <Th>Result</Th>
                  </Tr>
                </THead>
                <TBody>
                  {sendLog.slice(0, 10).map((entry) => (
                    <Tr key={entry.id}>
                      <Td className="font-numeric text-body-sm">
                        {new Date(entry.at).toLocaleString("en-AU", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Td>
                      <Td>{CATEGORY_LABELS[entry.channel]}</Td>
                      <Td className="font-medium text-fg">{entry.brand}</Td>
                      <Td className="font-numeric">{entry.recipient}</Td>
                      <Td>
                        <StatusPill tone={entry.status === "sent" ? "success" : "critical"}>
                          {entry.status}
                        </StatusPill>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
