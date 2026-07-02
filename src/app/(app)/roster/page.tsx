"use client";

import * as React from "react";
import { CalendarDays, Plus } from "lucide-react";
import { AttendanceTimeline } from "@/components/ui/attendance-timeline";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar, SegmentedControl } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { fmtTime, shiftStatusMeta, todaysShifts, type Shift } from "@/lib/demo-data";

const weekDays = ["Mon 30", "Tue 1", "Wed 2", "Thu 3", "Fri 4"];

function ShiftDrawer({ shift }: { shift: Shift }) {
  const meta = shiftStatusMeta[shift.status];
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="ghost" size="sm">
          Details
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{shift.cleaner}</DrawerTitle>
          <DrawerDescription>
            {shift.zone} · Wednesday 2 July
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <p className="text-body-sm text-fg-secondary">Status</p>
            <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-body-sm text-fg-secondary">Scheduled</p>
            <p className="font-mono text-body-sm text-fg">
              {fmtTime(shift.scheduled[0])}–{fmtTime(shift.scheduled[1])}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-body-sm text-fg-secondary">Checked in</p>
            <p className="font-mono text-body-sm text-fg">{fmtTime(shift.actual?.[0])}</p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-body-sm text-fg-secondary">Checked out</p>
            <p className="font-mono text-body-sm text-fg">{fmtTime(shift.actual?.[1])}</p>
          </div>
          <div className="rounded-control border border-edge bg-canvas p-4">
            <p className="text-body-sm font-medium text-fg">Supervisor note</p>
            <p className="mt-1 text-body-sm text-fg-muted">
              {shift.status === "missed"
                ? "Missed check-in alert sent 06:15. Zone reassignment pending."
                : "No notes for this shift."}
            </p>
          </div>
        </DrawerBody>
        <DrawerFooter>
          <Button variant="secondary">Edit shift</Button>
          <Button>Reassign</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export default function RosterPage() {
  const [view, setView] = React.useState("day");
  const [status, setStatus] = React.useState("all");
  const [query, setQuery] = React.useState("");

  const filtered = todaysShifts.filter(
    (s) =>
      (status === "all" || s.status === status) &&
      s.cleaner.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <PageHeader
        eyebrow="Cleaning operations"
        title="Roster"
        description="Scheduled shifts, live check-ins and exceptions for Aurora on Collins"
        actions={
          <>
            <Button variant="secondary">
              <CalendarDays aria-hidden /> Week of 30 June
            </Button>
            <Button>
              <Plus aria-hidden /> Add shift
            </Button>
          </>
        }
      />

      <FilterBar>
        <SegmentedControl
          label="Roster view"
          value={view}
          onValueChange={setView}
          options={[
            { value: "day", label: "Day" },
            { value: "week", label: "Week" },
            { value: "timeline", label: "Timeline" },
          ]}
        />
        <Select
          className="w-52"
          options={[
            { value: "all", label: "All statuses" },
            { value: "on-site", label: "On site now" },
            { value: "late", label: "Started late" },
            { value: "missed", label: "Missed check-in" },
            { value: "completed", label: "Completed" },
            { value: "rostered", label: "Rostered" },
          ]}
          value={status}
          onValueChange={setStatus}
        />
        <SearchInput
          className="w-64"
          placeholder="Find a cleaner…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No shifts match those filters"
          description="Try a different status or clear the search — today’s roster has 6 shifts in total."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setStatus("all");
                setQuery("");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : view === "week" ? (
        <div className="grid gap-4 md:grid-cols-5">
          {weekDays.map((day, di) => (
            <div key={day} className="flex flex-col gap-3">
              <p className={`text-body-sm font-medium ${di === 2 ? "text-accent-text" : "text-fg-muted"}`}>
                {day}
                {di === 2 && " · today"}
              </p>
              {filtered.slice(0, di === 2 ? filtered.length : 3 + (di % 2)).map((s) => {
                const meta = shiftStatusMeta[di === 2 ? s.status : "rostered"];
                return (
                  <div
                    key={`${day}-${s.cleaner}`}
                    className="rounded-control border border-edge bg-surface p-3.5 shadow-card"
                  >
                    <p className="truncate text-body-sm font-medium text-fg">{s.cleaner}</p>
                    <p className="mt-0.5 font-mono text-caption text-fg-muted">
                      {fmtTime(s.scheduled[0])}–{fmtTime(s.scheduled[1])}
                    </p>
                    <div className="mt-2.5">
                      <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : view === "timeline" ? (
        <Card>
          <CardBody>
            <AttendanceTimeline
              now={9.25}
              windowStart={5}
              windowEnd={14}
              rows={filtered.map((s) => ({
                name: s.cleaner,
                zone: s.zone,
                scheduled: s.scheduled,
                actual: s.actual,
                status: s.status === "rostered" ? "completed" : s.status,
              }))}
            />
          </CardBody>
        </Card>
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>Cleaner</Th>
              <Th>Zone</Th>
              <Th numeric>Scheduled</Th>
              <Th numeric>Check-in</Th>
              <Th numeric>Check-out</Th>
              <Th numeric>Duration</Th>
              <Th>Status</Th>
              <Th />
            </Tr>
          </THead>
          <TBody>
            {filtered.map((s) => {
              const meta = shiftStatusMeta[s.status];
              const dur =
                s.actual && s.actual[1] !== null
                  ? (s.actual[1] - s.actual[0]).toFixed(2)
                  : "—";
              return (
                <Tr key={s.cleaner}>
                  <Td className="font-medium">{s.cleaner}</Td>
                  <Td className="text-fg-secondary">{s.zone}</Td>
                  <Td numeric>
                    {fmtTime(s.scheduled[0])}–{fmtTime(s.scheduled[1])}
                  </Td>
                  <Td numeric>{fmtTime(s.actual?.[0])}</Td>
                  <Td numeric>{fmtTime(s.actual?.[1])}</Td>
                  <Td numeric>{dur}</Td>
                  <Td>
                    <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                  </Td>
                  <Td className="text-right">
                    <ShiftDrawer shift={s} />
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}
    </>
  );
}
