"use client";

import * as React from "react";
import { CheckCheck, ClipboardCheck, Download } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar, SegmentedControl } from "@/components/ui/filter-bar";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { fmtTime, timesheets, todaysShifts } from "@/lib/demo-data";
import { cn } from "@/lib/cn";

type RowKind = "ontime" | "variance" | "missing" | "progress" | "scheduled";

const rows = todaysShifts.map((s) => {
  const scheduledHours = s.scheduled[1] - s.scheduled[0];
  const done = s.actual && s.actual[1] !== null;
  const actualHours = done ? s.actual![1]! - s.actual![0] : undefined;
  const variance = actualHours !== undefined ? +(actualHours - scheduledHours).toFixed(2) : undefined;
  const kind: RowKind =
    s.status === "missed"
      ? "missing"
      : s.status === "rostered"
        ? "scheduled"
        : !done
          ? "progress"
          : Math.abs(variance!) >= 0.25
            ? "variance"
            : "ontime";
  return { ...s, scheduledHours, actualHours, variance, kind };
});

const kindPill: Record<RowKind, React.ReactNode> = {
  ontime: <Badge tone="success">On time</Badge>,
  variance: null, // rendered with the value
  missing: <StatusPill tone="critical">Missing</StatusPill>,
  progress: <StatusPill tone="accent">On site</StatusPill>,
  scheduled: <Badge tone="neutral">—</Badge>,
};

const statusChip: Record<RowKind, React.ReactNode> = {
  ontime: <Badge tone="neutral">complete</Badge>,
  variance: <Badge tone="neutral">complete</Badge>,
  missing: <Badge tone="neutral">scheduled</Badge>,
  progress: <Badge tone="accent">in progress</Badge>,
  scheduled: <Badge tone="neutral">scheduled</Badge>,
};

export default function TimesheetsPage() {
  const [filter, setFilter] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const { toast } = useToast();

  const visible = rows.filter((r) => {
    const byFilter =
      filter === "all" ||
      (filter === "variance" && r.kind === "variance") ||
      (filter === "missing" && r.kind === "missing");
    return byFilter && (r.cleaner + " " + r.zone).toLowerCase().includes(query.toLowerCase());
  });

  const scheduledTotal = rows.reduce((a, r) => a + r.scheduledHours, 0);
  const actualTotal = rows.reduce((a, r) => a + (r.actualHours ?? 0), 0);
  const over = rows.filter((r) => (r.variance ?? 0) >= 0.25).length;
  const under = rows.filter((r) => (r.variance ?? 0) <= -0.25).length;
  const missing = rows.filter((r) => r.kind === "missing").length;
  const notes = timesheets.filter((t) => t.note);

  return (
    <>
      <PageHeader
        eyebrow="Cleaning · Payroll"
        title="Timesheets & variance"
        description="Rostered hours vs actual kiosk check-in/out. Filter to review outliers, then export for payroll."
        actions={
          <>
            <Button variant="secondary">
              <Download aria-hidden /> Export CSV
            </Button>
            <Button
              onClick={() =>
                toast({
                  tone: "success",
                  title: "Week approved",
                  description: "6 timesheets · week ending 28 June · sent for payroll prep",
                })
              }
            >
              <CheckCheck aria-hidden /> Approve week
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard label="Scheduled hours" value={scheduledTotal.toFixed(1)} context={`${rows.length} shifts`} />
        <MetricCard
          label="Actual hours"
          value={actualTotal.toFixed(1)}
          context={`${rows.filter((r) => r.kind === "ontime").length} on time`}
          tone="success"
        />
        <MetricCard
          label="Variance flags"
          value={over + under}
          context={`+${over} over · −${under} under`}
        />
        <MetricCard label="Missing punches" value={missing} context="Alert sent 06:15" tone={missing ? "critical" : "neutral"} />
      </div>

      <div className="mt-8">
        <FilterBar>
          <SearchInput
            className="w-72"
            placeholder="Search shift or cleaner"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <SegmentedControl
            label="Timesheet filter"
            value={filter}
            onValueChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "variance", label: "Variance" },
              { value: "missing", label: "Missing" },
            ]}
          />
        </FilterBar>

        {visible.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Nothing to review here"
            description="No shifts match that filter — clear it to see the full day."
            action={
              <Button variant="secondary" size="sm" onClick={() => { setFilter("all"); setQuery(""); }}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Cleaner / shift</Th>
                <Th>Scheduled</Th>
                <Th numeric>Check in</Th>
                <Th numeric>Check out</Th>
                <Th className="w-52">Hours</Th>
                <Th>Variance</Th>
                <Th>Status</Th>
              </Tr>
            </THead>
            <TBody>
              {visible.map((r) => {
                const pct =
                  r.actualHours !== undefined
                    ? Math.min(100, (r.actualHours / r.scheduledHours) * 100)
                    : 0;
                return (
                  <Tr key={r.cleaner}>
                    <Td>
                      <span className="flex items-center gap-3">
                        <Avatar name={r.cleaner} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{r.cleaner}</span>
                          <span className="block truncate text-caption text-fg-muted">{r.zone}</span>
                        </span>
                      </span>
                    </Td>
                    <Td>
                      <span className="block text-caption text-fg-muted">Wed 2 Jul</span>
                      <span className="font-mono">
                        {fmtTime(r.scheduled[0])} → {fmtTime(r.scheduled[1])}
                      </span>
                    </Td>
                    <Td numeric>{fmtTime(r.actual?.[0])}</Td>
                    <Td numeric>{fmtTime(r.actual?.[1])}</Td>
                    <Td>
                      <span className="flex items-center gap-3">
                        <span className="h-1.5 w-24 overflow-hidden rounded-pill bg-hover">
                          <span
                            className={cn(
                              "block h-full rounded-pill",
                              r.kind === "missing" ? "bg-critical" : "bg-success"
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                        <span className="font-mono text-caption text-fg-secondary">
                          {r.actualHours !== undefined ? r.actualHours.toFixed(1) : "—"}/
                          {r.scheduledHours.toFixed(1)}h
                        </span>
                      </span>
                    </Td>
                    <Td>
                      {r.kind === "variance" ? (
                        <Badge tone="warning">
                          <span className="font-mono">
                            {r.variance! > 0 ? `+${r.variance}` : r.variance} h
                          </span>
                        </Badge>
                      ) : (
                        kindPill[r.kind]
                      )}
                    </Td>
                    <Td>{statusChip[r.kind]}</Td>
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
              <div key={t.cleaner} className={cn("flex items-start gap-3", i > 0 && "border-t border-edge pt-5")}>
                <Avatar name={t.cleaner} size="sm" />
                <div>
                  <p className="text-body-sm font-medium text-fg">{t.cleaner}</p>
                  <p className="mt-0.5 text-body-sm text-fg-secondary">{t.note}</p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </>
  );
}
