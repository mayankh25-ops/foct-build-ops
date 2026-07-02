"use client";

import * as React from "react";
import { AlertTriangle, Package, Plus, TrendingUp } from "lucide-react";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { orders, stock, type ConsumableCategory } from "@/lib/demo-data";
import { cn } from "@/lib/cn";

const categories: Array<ConsumableCategory | "All"> = [
  "All",
  "Chemicals",
  "Paper products",
  "Bin liners",
  "Gloves & PPE",
  "Cleaning tools",
  "Machine accessories",
];

const orderStatusMeta = {
  "awaiting-approval": { label: "Awaiting approval", tone: "warning" as const },
  approved: { label: "Approved", tone: "success" as const },
  ordered: { label: "Ordered", tone: "info" as const },
};

export default function ConsumablesPage() {
  const [category, setCategory] = React.useState<(typeof categories)[number]>("All");
  const { toast } = useToast();

  const lowStock = stock.filter((s) => s.level <= 0.25);
  const visibleStock = stock.filter((s) => category === "All" || s.category === category);
  const queue = orders.filter((o) => o.status === "awaiting-approval");

  return (
    <>
      <PageHeader
        eyebrow="Cleaning operations"
        title="Consumables"
        description="Stock, requests and ordering for Aurora on Collins · level 20 store"
        actions={
          <Button>
            <Plus aria-hidden /> New request
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard
          label="Open requests"
          value={queue.length}
          context="Oldest from yesterday, 14:12"
          icon={Package}
          tone="accent"
        />
        <MetricCard
          label="Low stock items"
          value={lowStock.length}
          context="Below reorder point"
          icon={AlertTriangle}
          tone={lowStock.length > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Usage this month"
          value="$1,842"
          context="8% under June budget"
          icon={TrendingUp}
        />
      </div>

      <div className="mt-10">
        <SectionHeader
          title="Approval queue"
          description="Requests from cleaners on site — approving places the order with your supplier."
        />
        {queue.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No requests waiting"
            description="Cleaners can raise consumable requests from the kiosk or their phone. New requests land here for approval."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {queue.map((order) => {
              const meta = orderStatusMeta[order.status];
              return (
                <Card key={order.id}>
                  <CardHeader>
                    <div>
                      <CardTitle>
                        Request <span className="font-mono">{order.id}</span>
                      </CardTitle>
                      <p className="mt-1 text-body-sm text-fg-muted">
                        {order.requestedBy} · {order.requestedOn}
                      </p>
                    </div>
                    <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                  </CardHeader>
                  <CardBody className="flex flex-col gap-2.5">
                    {order.items.map((item) => (
                      <div key={item.name} className="flex items-baseline justify-between gap-4">
                        <p className="text-body-sm text-fg">{item.name}</p>
                        <p className="shrink-0 font-mono text-body-sm text-fg-secondary">
                          × {item.qty}
                        </p>
                      </div>
                    ))}
                  </CardBody>
                  <CardFooter>
                    <Button variant="ghost" size="sm">
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        toast({
                          tone: "success",
                          title: `Request ${order.id} approved`,
                          description: `${order.items.length} line items · order sent to supplier`,
                        })
                      }
                    >
                      Approve order
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-10">
        <SectionHeader
          title="Stock levels"
          description="Counted at the level 20 store · reorder points set per item."
        />
        <FilterBar>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={cn(
                "rounded-pill border px-3.5 py-1.5 text-body-sm transition-colors duration-150",
                category === c
                  ? "border-edge bg-accent-subtle font-medium text-accent-text"
                  : "border-edge bg-surface text-fg-secondary hover:bg-hover"
              )}
            >
              {c}
            </button>
          ))}
        </FilterBar>
        <Table>
          <THead>
            <Tr>
              <Th>Item</Th>
              <Th>Category</Th>
              <Th className="w-56">Level</Th>
              <Th numeric>On hand</Th>
              <Th numeric>Reorder at</Th>
              <Th>Status</Th>
            </Tr>
          </THead>
          <TBody>
            {visibleStock.map((item) => {
              const low = item.level <= 0.25;
              return (
                <Tr key={item.name}>
                  <Td className="font-medium">{item.name}</Td>
                  <Td>
                    <Badge tone="neutral">{item.category}</Badge>
                  </Td>
                  <Td>
                    <div
                      role="meter"
                      aria-label={`${item.name} stock level`}
                      aria-valuenow={Math.round(item.level * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="h-1.5 overflow-hidden rounded-pill bg-hover"
                    >
                      <div
                        className={cn("h-full rounded-pill", low ? "bg-critical" : "bg-accent")}
                        style={{ width: `${item.level * 100}%` }}
                      />
                    </div>
                  </Td>
                  <Td numeric>{item.onHand}</Td>
                  <Td numeric>{item.reorderAt}</Td>
                  <Td>
                    {low ? (
                      <StatusPill tone="critical">Low stock</StatusPill>
                    ) : (
                      <StatusPill tone="success">In stock</StatusPill>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      </div>
    </>
  );
}
