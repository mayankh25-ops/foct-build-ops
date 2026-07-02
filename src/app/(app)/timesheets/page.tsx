"use client";

import * as React from "react";
import { CheckCircle2, ClipboardCheck, Download, Printer } from "lucide-react";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar, SegmentedControl } from "@/components/ui/filter-bar";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { timesheets } from "@/lib/demo-data";

const statusMeta = {
  ready: { label: "Ready for approval", tone: "accent" as const },
  approved: { label: "Approved", tone: "success" as const },
  "needs-review": { label: "Needs review", tone: "warning" as const },
};

function VarianceBadge({ rostered, actual }: { rostered: number; actual: number }) {
  const diff = +(actual - rostered).toFixed(2);
  if (diff === 0) return <Badge tone="neutral">On roster</Badge>;
  const tone = Math.abs(diff) >= 1 ? "warning" : "neutral";
  return (
    <Badge tone={tone}>
      <span className="font-mono">{diff > 0 ? `+${diff}` : diff} h</span>
    </Badge>
  );
}

export default function TimesheetsPage() {
  const [range, setRange] = React.useState("week");
  const [filter, setFilter] = React.useState("all");
  const { toast } = useToast();

  const rows = timesheets.filter((t) => filter === "all" || t.status === filter);
  const notes = timesheets.filter((t) => t.note);

  const totalActual = timesheets.reduce((a, t) => a + t.actual, 0);
  const totalVariance = timesheets.reduce((a, t) => a + (t.actual - t.rostered), 0);

  return (
    <>
      <PageHeader
        eyebrow="Cleaning operations"
        title="Timesheets"
        description="Week ending Sunday 28 June · prepared from kiosk and QR check-ins"
        actions={
          <>
            <Button variant="secondary">
              <Printer aria-hidden /> Print
            </Button>
            <Button variant="secondary">
              <Download aria-hidden /> Export CSV
            </Button>
            <Button
              onClick={() =>
                toast({
                  tone: "success",
                  title: "3 timesheets approved",
                  description: "Marcus, Leila and Grace · week ending 28 June",
                })
              }
            >
              <CheckCircle2 aria-hidden /> Approve all ready
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Ready for approval" value="3" context="Of 6 timesheets this week" icon={ClipboardCheck} tone="accent" />
        <MetricCard label="Total hours" value={totalActual.toFixed(1)} context="Across Aurora on Collins" />
        <MetricCard
          label="Variance vs roster"
          value={`${totalVariance > 0 ? "+" : ""}${totalVariance.toFixed(1)} h`}
          context="Mostly Tom’s missed Wednesday shift"
          tone={Math.abs(totalVariance) >= 2 ? "warning" : "neutral"}
        />
      </div>

      <div className="mt-8">
        <FilterBar>
          <SegmentedControl
            label="Summary range"
            value={range}
            onValueChange={setRange}
            options={[
              { value: "day", label: "Daily" },
              { value: "week", label: "Weekly" },
            ]}
          />
          <Select
            className="w-56"
            options={[
              { value: "all", label: "All statuses" },
              { value: "ready", label: "Ready for approval" },
              { value: "needs-review", label: "Needs review" },
              { value: "approved", label: "Approved" },
            ]}
            value={filter}
            onValueChange={setFilter}
          />
        </FilterBar>

        {rows.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Nothing needs review"
            description="Every timesheet for this week has been approved. New ones appear here as shifts finish."
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Cleaner</Th>
                <Th>Building</Th>
                <Th numeric>Rostered</Th>
                <Th numeric>Actual</Th>
                <Th>Variance</Th>
                <Th>Status</Th>
                <Th />
              </Tr>
            </THead>
            <TBody>
              {rows.map((t) => {
                const meta = statusMeta[t.status];
                return (
                  <Tr key={t.cleaner}>
                    <Td className="font-medium">{t.cleaner}</Td>
                    <Td className="text-fg-secondary">{t.building}</Td>
                    <Td numeric>{t.rostered.toFixed(2)}</Td>
                    <Td numeric>{t.actual.toFixed(2)}</Td>
                    <Td>
                      <VarianceBadge rostered={t.rostered} actual={t.actual} />
                    </Td>
                    <Td>
                      <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                    </Td>
                    <Td className="text-right">
                      {t.status === "ready" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            toast({
                              tone: "success",
                              title: "Timesheet approved",
                              description: `${t.cleaner} · ${t.actual.toFixed(2)} h · week ending 28 June`,
                            })
                          }
                        >
                          Approve
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost">
                          View
                        </Button>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        )}
      </div>

      {notes.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Supervisor notes</CardTitle>
            <Badge tone="warning">{notes.length}</Badge>
          </CardHeader>
          <CardBody className="flex flex-col gap-5">
            {notes.map((t, i) => (
              <div key={t.cleaner} className={i > 0 ? "border-t border-edge pt-5" : ""}>
                <p className="text-body-sm font-medium text-fg">{t.cleaner}</p>
                <p className="mt-1 text-body-sm text-fg-secondary">{t.note}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </>
  );
}
