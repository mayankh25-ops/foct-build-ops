"use client";

import * as React from "react";
import {
  AlertTriangle,
  Brush,
  Camera,
  Cog,
  FlaskConical,
  Hand,
  Minus,
  Package,
  Plus,
  Scroll,
  Settings2,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar, SegmentedControl } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/ui/metric-card";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
} from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { SectionHeader } from "@/components/ui/section-header";
import { Select } from "@/components/ui/select";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { compressImage } from "@/lib/compress-image";
import { staffDirectory } from "@/lib/attendance-store";
import {
  peekNextOrderId,
  useConsumablesReady,
  useConsumablesStore,
  type CatalogueItem,
  type OrderFrequency,
  type OrderLine,
  type OrderUrgency,
} from "@/lib/consumables-store";
import { stock, type ConsumableCategory } from "@/lib/demo-data";
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

/** The item "image" — a calm icon tile per category (no stock photography). */
const categoryIcon: Record<ConsumableCategory, React.ComponentType<{ className?: string }>> = {
  Chemicals: FlaskConical,
  "Paper products": Scroll,
  "Bin liners": Trash2,
  "Gloves & PPE": Hand,
  "Cleaning tools": Brush,
  "Machine accessories": Cog,
};

function ItemTile({ item, size = "md" }: { item: CatalogueItem; size?: "md" | "lg" }) {
  const Icon = categoryIcon[item.category];
  const box = size === "lg" ? "size-20" : "size-12";
  if (item.imageDataUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.imageDataUrl}
        alt=""
        className={cn(box, "shrink-0 rounded-card border border-edge object-cover")}
      />
    );
  }
  return (
    <span className={cn(box, "flex shrink-0 items-center justify-center rounded-card bg-accent-subtle")}>
      <Icon aria-hidden className={size === "lg" ? "size-9 text-accent-text" : "size-6 text-accent-text"} />
    </span>
  );
}

const orderStatusMeta = {
  "awaiting-approval": { label: "Awaiting approval", tone: "warning" as const },
  approved: { label: "Approved", tone: "success" as const },
  declined: { label: "Declined", tone: "critical" as const },
  ordered: { label: "Ordered", tone: "info" as const },
  draft: { label: "Recurring draft", tone: "neutral" as const },
};

const freqLabel: Record<OrderFrequency, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/* ---------------------------------------------------------------- */
/* New order — item tiles + quantity steppers + the "Other" line     */
/* ---------------------------------------------------------------- */

function NewOrderModal() {
  const catalogue = useConsumablesStore((s) => s.catalogue);
  const orders = useConsumablesStore((s) => s.orders);
  const recipients = useConsumablesStore((s) => s.recipients);
  const createOrder = useConsumablesStore((s) => s.createOrder);
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const openChange = (o: boolean) => {
    setOpen(o);
    if (o) {
      setSearch("");
      setQty({});
      setOthers([]);
      setUrgency("standard");
      setRepeat("one-off");
      setExtraEmails([]);
      setExtraEmail("");
    }
  };
  const [qty, setQty] = React.useState<Record<string, number>>({});
  const [requestedBy, setRequestedBy] = React.useState(staffDirectory[0]!.name);
  const [otherName, setOtherName] = React.useState("");
  const [otherQty, setOtherQty] = React.useState(1);
  const [others, setOthers] = React.useState<OrderLine[]>([]);
  const [search, setSearch] = React.useState("");
  const [urgency, setUrgency] = React.useState<OrderUrgency>("standard");
  const [repeat, setRepeat] = React.useState<"one-off" | OrderFrequency>("one-off");
  const [extraEmail, setExtraEmail] = React.useState("");
  const [extraEmails, setExtraEmails] = React.useState<string[]>([]);

  const nextId = peekNextOrderId(orders);
  const addEmail = () => {
    const e = extraEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(e) || extraEmails.includes(e) || recipients.includes(e)) return;
    setExtraEmails((xs) => [...xs, e]);
    setExtraEmail("");
  };

  const allowed = catalogue.filter(
    (c) => c.allowed && c.name.toLowerCase().includes(search.trim().toLowerCase())
  );
  const lines: OrderLine[] = [
    ...allowed
      .filter((c) => (qty[c.id] ?? 0) > 0)
      .map((c) => ({ name: c.name, qty: qty[c.id]!, unit: c.unit })),
    ...others,
  ];

  const bump = (id: string, delta: number) =>
    setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(99, (q[id] ?? 0) + delta)) }));

  const addOther = () => {
    const name = otherName.trim();
    if (!name) return;
    setOthers((o) => [...o, { name, qty: Math.max(1, otherQty), custom: true }]);
    setOtherName("");
    setOtherQty(1);
  };

  const submit = (asDraft: boolean) => {
    const id = createOrder({
      requestedBy,
      items: lines,
      urgency,
      recurrence: repeat === "one-off" ? undefined : repeat,
      asDraft,
      extraEmails,
    });
    setOpen(false);
    setQty({});
    setOthers([]);
    toast({
      tone: "success",
      title: asDraft ? `Draft ${id} saved` : `Order ${id} raised`,
      description: asDraft
        ? `Raises itself ${freqLabel[repeat as OrderFrequency].toLowerCase()} for approval — submit it any time from the drafts list`
        : `${lines.length} line item${lines.length === 1 ? "" : "s"}${urgency === "urgent" ? " · URGENT" : ""}${repeat !== "one-off" ? ` · repeats ${freqLabel[repeat as OrderFrequency].toLowerCase()}` : ""} — waiting for the manager's approval`,
    });
  };

  return (
    <Modal open={open} onOpenChange={openChange}>
      <ModalTrigger asChild>
        <Button>
          <Plus aria-hidden /> New order
        </Button>
      </ModalTrigger>
      <ModalContent size="xl">
        <ModalHeader>
          <ModalTitle>Order consumables</ModalTitle>
          <ModalDescription>
            Pick from the building&apos;s allowed list and set quantities — anything unusual goes
            under &quot;Other&quot;.
          </ModalDescription>
        </ModalHeader>
        <ModalBody className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            <label className="flex w-56 flex-col gap-1.5 text-body-sm font-medium text-fg">
              Requested by
              <Select
                options={staffDirectory.map((s) => ({ value: s.name, label: s.name }))}
                value={requestedBy}
                onValueChange={setRequestedBy}
              />
            </label>
            <div className="flex flex-col gap-1.5">
              <span className="text-body-sm font-medium text-fg">Urgency</span>
              <SegmentedControl
                label="Order urgency"
                value={urgency}
                onValueChange={(v) => setUrgency(v as OrderUrgency)}
                options={[
                  { value: "standard", label: "Standard" },
                  { value: "urgent", label: "Urgent" },
                ]}
              />
            </div>
            <div className="ml-auto text-right">
              <p className="text-caption font-medium text-fg-muted">Order number</p>
              <p className="font-mono text-title-3 font-semibold text-fg">{nextId}</p>
            </div>
          </div>
          {urgency === "urgent" && (
            <p className="-mt-2 rounded-card border border-edge bg-warning-subtle px-4 py-2.5 text-body-sm text-warning-text">
              Urgent requests jump to the top of the manager&apos;s queue — use for genuine run-outs.
            </p>
          )}
          <SearchInput
            className="w-72"
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {allowed.length === 0 && (
            <p className="text-body-sm text-fg-muted">
              Nothing on the allowed list matches “{search}”. Use “Other” below for anything unusual.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {allowed.map((item) => {
              const count = qty[item.id] ?? 0;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-3.5 rounded-card border p-3.5 transition-colors",
                    count > 0 ? "border-edge-strong bg-accent-subtle/40" : "border-edge bg-surface"
                  )}
                >
                  <ItemTile item={item} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-sm font-medium text-fg">{item.name}</p>
                    <p className="truncate text-caption text-fg-muted">{item.unit}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      aria-label={`Fewer ${item.name}`}
                      disabled={count === 0}
                      onClick={() => bump(item.id, -1)}
                      className="flex size-8 items-center justify-center rounded-control border border-edge text-fg-secondary transition-colors hover:bg-hover disabled:opacity-40"
                    >
                      <Minus aria-hidden className="size-3.5" />
                    </button>
                    <span className="w-7 text-center font-numeric text-body tabular-nums">{count}</span>
                    <button
                      type="button"
                      aria-label={`More ${item.name}`}
                      onClick={() => bump(item.id, 1)}
                      className="flex size-8 items-center justify-center rounded-control border border-edge text-fg-secondary transition-colors hover:bg-hover"
                    >
                      <Plus aria-hidden className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-card border border-edge bg-canvas p-4">
            <p className="text-body-sm font-medium text-fg">Other — custom item</p>
            <p className="mt-0.5 text-caption text-fg-muted">
              Anything not on the allowed list; the manager sees it flagged for review.
            </p>
            <div className="mt-3 flex items-end gap-2">
              <Input
                placeholder="e.g. Graffiti wipes (specialty)"
                value={otherName}
                onChange={(e) => setOtherName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addOther())}
              />
              <Input
                type="number"
                min={1}
                max={99}
                value={otherQty}
                onChange={(e) => setOtherQty(Number(e.target.value) || 1)}
                className="w-20"
                aria-label="Custom item quantity"
              />
              <Button variant="secondary" onClick={addOther} className="shrink-0">
                Add
              </Button>
            </div>
            {others.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {others.map((o, i) => (
                  <Badge key={`${o.name}-${i}`} tone="warning" className="gap-1.5">
                    {o.name} × {o.qty}
                    <button
                      type="button"
                      aria-label={`Remove ${o.name}`}
                      onClick={() => setOthers((os) => os.filter((_, x) => x !== i))}
                      className="transition-opacity hover:opacity-70"
                    >
                      ✕
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-card border border-edge bg-canvas p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-body-sm font-medium text-fg">Repeats</p>
                <p className="mt-0.5 text-caption text-fg-muted">
                  Recurring orders can be submitted now, or saved as a draft that raises itself for
                  approval each cycle.
                </p>
              </div>
              <SegmentedControl
                label="Order frequency"
                value={repeat}
                onValueChange={(v) => setRepeat(v as "one-off" | OrderFrequency)}
                options={[
                  { value: "one-off", label: "One-off" },
                  { value: "weekly", label: "Weekly" },
                  { value: "fortnightly", label: "Fortnightly" },
                  { value: "monthly", label: "Monthly" },
                  { value: "quarterly", label: "Quarterly" },
                ]}
              />
            </div>
          </div>

          <div className="rounded-card border border-edge bg-canvas p-4">
            <p className="text-body-sm font-medium text-fg">Order emails</p>
            <p className="mt-0.5 text-caption text-fg-muted">
              Approved orders are emailed to the building&apos;s permanent recipients — add extra
              addresses for this order only. (Manage the permanent list under &quot;Allowed
              list&quot;.)
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {recipients.map((r) => (
                <Badge key={r} tone="neutral" className="font-mono">
                  {r}
                </Badge>
              ))}
              {extraEmails.map((e) => (
                <Badge key={e} tone="info" className="gap-1.5 font-mono">
                  {e}
                  <button
                    type="button"
                    aria-label={`Remove ${e}`}
                    onClick={() => setExtraEmails((xs) => xs.filter((x) => x !== e))}
                    className="transition-opacity hover:opacity-70"
                  >
                    ✕
                  </button>
                </Badge>
              ))}
            </div>
            <div className="mt-3 flex items-end gap-2">
              <Input
                type="email"
                aria-label="Additional order email"
                placeholder="Add another email for this order, e.g. supplier@…"
                value={extraEmail}
                onChange={(e) => setExtraEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmail())}
              />
              <Button
                variant="secondary"
                className="shrink-0"
                disabled={!EMAIL_RE.test(extraEmail.trim())}
                onClick={addEmail}
              >
                Add
              </Button>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <p className="mr-auto text-body-sm text-fg-secondary">
            {lines.length === 0
              ? "Nothing selected yet"
              : `${lines.reduce((n, l) => n + l.qty, 0)} units across ${lines.length} item${lines.length === 1 ? "" : "s"}${repeat !== "one-off" ? ` · repeats ${freqLabel[repeat as OrderFrequency].toLowerCase()}` : ""}`}
          </p>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          {repeat !== "one-off" && (
            <Button variant="secondary" disabled={lines.length === 0} onClick={() => submit(true)}>
              Save as recurring draft
            </Button>
          )}
          <Button disabled={lines.length === 0} onClick={() => submit(false)}>
            Submit order
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

/* ---------------------------------------------------------------- */
/* Allowed list manager (building admin)                             */
/* ---------------------------------------------------------------- */

function ManageListModal() {
  const catalogue = useConsumablesStore((s) => s.catalogue);
  const toggleAllowed = useConsumablesStore((s) => s.toggleAllowed);
  const setItemImage = useConsumablesStore((s) => s.setItemImage);
  const addCatalogueItem = useConsumablesStore((s) => s.addCatalogueItem);
  const recipients = useConsumablesStore((s) => s.recipients);
  const addRecipient = useConsumablesStore((s) => s.addRecipient);
  const removeRecipient = useConsumablesStore((s) => s.removeRecipient);
  const { toast } = useToast();
  const [name, setName] = React.useState("");
  const [unit, setUnit] = React.useState("");
  const [category, setCategory] = React.useState<ConsumableCategory>("Chemicals");
  const [recEmail, setRecEmail] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const openChange = (o: boolean) => {
    setOpen(o);
    if (o) setSearch("");
  };
  const fileRef = React.useRef<HTMLInputElement>(null);
  const uploadTarget = React.useRef<string | null>(null);

  const shown = catalogue.filter((c) =>
    c.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  const pickImage = (id: string) => {
    uploadTarget.current = id;
    fileRef.current?.click();
  };

  const onImageFile = async (files: FileList | null) => {
    const file = files?.[0];
    const id = uploadTarget.current;
    if (!file || !id) return;
    try {
      const dataUrl = await compressImage(file, 320, 0.75);
      setItemImage(id, dataUrl);
      toast({ tone: "success", title: "Product photo saved" });
    } catch {
      toast({ tone: "critical", title: "Couldn't read that image" });
    }
    if (fileRef.current) fileRef.current.value = "";
    uploadTarget.current = null;
  };

  return (
    <Modal open={open} onOpenChange={openChange}>
      <ModalTrigger asChild>
        <Button variant="secondary">
          <Settings2 aria-hidden /> Allowed list
        </Button>
      </ModalTrigger>
      <ModalContent size="lg">
        <ModalHeader>
          <ModalTitle>Allowed consumables — Aurora on Collins</ModalTitle>
          <ModalDescription>
            Cleaners can only order what&apos;s ticked here. Set per building by the admin.
          </ModalDescription>
        </ModalHeader>
        <ModalBody className="flex flex-col gap-5">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void onImageFile(e.target.files)} />
          <SearchInput
            className="w-72"
            placeholder="Search the catalogue…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            {shown.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-3 rounded-card border p-3 transition-colors",
                  item.allowed ? "border-edge bg-surface" : "border-edge bg-canvas opacity-60"
                )}
              >
                <input
                  type="checkbox"
                  aria-label={`${item.name} allowed`}
                  checked={item.allowed}
                  onChange={() => toggleAllowed(item.id)}
                  className="size-4 shrink-0 accent-[var(--accent)]"
                />
                <ItemTile item={item} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-sm font-medium text-fg">{item.name}</span>
                  <span className="block truncate text-caption text-fg-muted">
                    {item.category} · {item.unit}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={`${item.imageDataUrl ? "Replace" : "Add"} photo for ${item.name}`}
                  title={item.imageDataUrl ? "Replace product photo" : "Add product photo"}
                  onClick={() => pickImage(item.id)}
                  className="flex size-9 shrink-0 items-center justify-center rounded-control border border-edge text-fg-muted transition-colors hover:bg-hover hover:text-fg"
                >
                  <Camera aria-hidden className="size-4" />
                </button>
              </div>
            ))}
            {shown.length === 0 && (
              <p className="text-body-sm text-fg-muted sm:col-span-2">
                No catalogue items match “{search}” — add it below.
              </p>
            )}
          </div>

          <div className="rounded-card border border-edge bg-canvas p-4">
            <p className="text-body-sm font-medium text-fg">Add an item to the list</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_11rem_9rem_auto]">
              <Input placeholder="Item name" value={name} onChange={(e) => setName(e.target.value)} />
              <Select
                options={categories.filter((c) => c !== "All").map((c) => ({ value: c, label: c }))}
                value={category}
                onValueChange={(v) => setCategory(v as ConsumableCategory)}
              />
              <Input placeholder="Unit, e.g. box of 50" value={unit} onChange={(e) => setUnit(e.target.value)} />
              <Button
                variant="secondary"
                disabled={!name.trim()}
                onClick={() => {
                  addCatalogueItem({ name, category, unit });
                  setName("");
                  setUnit("");
                }}
              >
                Add
              </Button>
            </div>
          </div>

          <div className="rounded-card border border-edge bg-canvas p-4">
            <p className="text-body-sm font-medium text-fg">Permanent order recipients</p>
            <p className="mt-0.5 text-caption text-fg-muted">
              Every approved order for this building is emailed to these addresses.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {recipients.map((r) => (
                <Badge key={r} tone="neutral" className="gap-1.5 font-mono">
                  {r}
                  <button
                    type="button"
                    aria-label={`Remove recipient ${r}`}
                    onClick={() => removeRecipient(r)}
                    className="transition-opacity hover:opacity-70"
                  >
                    ✕
                  </button>
                </Badge>
              ))}
              {recipients.length === 0 && (
                <p className="text-body-sm text-fg-muted">
                  No recipients yet — orders can&apos;t be emailed until one is added.
                </p>
              )}
            </div>
            <div className="mt-3 flex items-end gap-2">
              <Input
                type="email"
                aria-label="New permanent recipient"
                placeholder="orders@supplier.com.au"
                value={recEmail}
                onChange={(e) => setRecEmail(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  (e.preventDefault(),
                  EMAIL_RE.test(recEmail.trim()) &&
                    (addRecipient(recEmail), setRecEmail(""), toast({ tone: "success", title: "Recipient added" })))
                }
              />
              <Button
                variant="secondary"
                className="shrink-0"
                disabled={!EMAIL_RE.test(recEmail.trim())}
                onClick={() => {
                  addRecipient(recEmail);
                  setRecEmail("");
                  toast({ tone: "success", title: "Recipient added" });
                }}
              >
                Add
              </Button>
            </div>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

/* ---------------------------------------------------------------- */
/* Page                                                              */
/* ---------------------------------------------------------------- */

export default function ConsumablesPage() {
  const ready = useConsumablesReady();
  const ordersLive = useConsumablesStore((s) => s.orders);
  const setOrderStatus = useConsumablesStore((s) => s.setOrderStatus);
  const submitDraft = useConsumablesStore((s) => s.submitDraft);
  const deleteOrder = useConsumablesStore((s) => s.deleteOrder);
  const [category, setCategory] = React.useState<(typeof categories)[number]>("All");
  const [stockSearch, setStockSearch] = React.useState("");
  const { toast } = useToast();

  if (!ready) return null;

  const lowStock = stock.filter((s) => s.level <= 0.25);
  const visibleStock = stock.filter(
    (s) =>
      (category === "All" || s.category === category) &&
      s.name.toLowerCase().includes(stockSearch.trim().toLowerCase())
  );
  const queue = ordersLive
    .filter((o) => o.status === "awaiting-approval")
    .sort((a, b) => (b.urgency === "urgent" ? 1 : 0) - (a.urgency === "urgent" ? 1 : 0));
  const drafts = ordersLive.filter((o) => o.status === "draft");
  const recent = ordersLive
    .filter((o) => o.status !== "awaiting-approval" && o.status !== "draft")
    .slice(0, 4);

  return (
    <>
      <PageHeader
        eyebrow="Cleaning operations"
        title="Consumables"
        description="Stock, requests and ordering for Aurora on Collins · level 20 store"
        actions={
          <>
            <ManageListModal />
            <NewOrderModal />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard
          label="Open requests"
          value={queue.length}
          context={queue.length ? `Oldest ${fmtWhen(queue[queue.length - 1]!.at)}` : "Queue is clear"}
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
            description="Cleaners raise orders with New order — items come from the building's allowed list and land here for approval."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {queue.map((order) => {
              const meta = orderStatusMeta[order.status];
              return (
                <Card key={order.id} className={order.urgency === "urgent" ? "border-edge-strong" : undefined}>
                  <CardHeader>
                    <div>
                      <CardTitle>
                        Request <span className="font-mono">{order.id}</span>
                      </CardTitle>
                      <p className="mt-1 text-body-sm text-fg-muted">
                        {order.requestedBy} · {fmtWhen(order.at)}
                      </p>
                    </div>
                    <span className="flex flex-wrap items-center justify-end gap-2">
                      {order.urgency === "urgent" && <StatusPill tone="critical">Urgent</StatusPill>}
                      {order.recurrence && (
                        <Badge tone="info">Repeats {freqLabel[order.recurrence].toLowerCase()}</Badge>
                      )}
                      <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                    </span>
                  </CardHeader>
                  <CardBody className="flex flex-col gap-2.5">
                    {order.items.map((item, i) => (
                      <div key={`${item.name}-${i}`} className="flex items-baseline justify-between gap-4">
                        <p className="text-body-sm text-fg">
                          {item.name}
                          {item.custom && (
                            <Badge tone="warning" className="ml-2">
                              Custom
                            </Badge>
                          )}
                        </p>
                        <p className="shrink-0 font-mono text-body-sm text-fg-secondary">
                          × {item.qty}
                          {item.unit ? ` ${item.unit}` : ""}
                        </p>
                      </div>
                    ))}
                    {order.sendTo && order.sendTo.length > 0 && (
                      <p className="mt-1 border-t border-edge pt-2.5 text-caption text-fg-muted">
                        On approval, emails to <span className="font-mono">{order.sendTo.join(", ")}</span>
                      </p>
                    )}
                    {order.note && <p className="text-caption text-fg-muted">{order.note}</p>}
                  </CardBody>
                  <CardFooter>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setOrderStatus(order.id, "declined");
                        toast({ tone: "neutral", title: `Request ${order.id} declined` });
                      }}
                    >
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setOrderStatus(order.id, "approved");
                        toast({
                          tone: "success",
                          title: `Request ${order.id} approved`,
                          description: `${order.items.length} line item${order.items.length === 1 ? "" : "s"} · order sent to supplier`,
                        });
                      }}
                    >
                      Approve order
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

        {recent.length > 0 && (
          <div className="mt-4 flex flex-col gap-1.5">
            {recent.map((o) => (
              <p key={o.id} className="text-body-sm text-fg-muted">
                <span className="font-mono">{o.id}</span> · {o.requestedBy} ·{" "}
                {orderStatusMeta[o.status].label.toLowerCase()} · {fmtWhen(o.at)}
              </p>
            ))}
          </div>
        )}
      </div>

      {drafts.length > 0 && (
        <div className="mt-10">
          <SectionHeader
            title="Recurring order drafts"
            description="Saved drafts raise a copy for approval on their frequency — or submit one now."
          />
          <div className="grid gap-4 lg:grid-cols-2">
            {drafts.map((d) => (
              <Card key={d.id}>
                <CardHeader>
                  <div>
                    <CardTitle>
                      Draft <span className="font-mono">{d.id}</span>
                    </CardTitle>
                    <p className="mt-1 text-body-sm text-fg-muted">
                      {d.requestedBy}
                      {d.nextRun &&
                        ` · next raises ${new Date(d.nextRun).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`}
                    </p>
                  </div>
                  <span className="flex flex-wrap items-center justify-end gap-2">
                    {d.urgency === "urgent" && <StatusPill tone="critical">Urgent</StatusPill>}
                    {d.recurrence && (
                      <Badge tone="info">Repeats {freqLabel[d.recurrence].toLowerCase()}</Badge>
                    )}
                  </span>
                </CardHeader>
                <CardBody className="flex flex-col gap-2.5">
                  {d.items.map((item, i) => (
                    <div key={`${item.name}-${i}`} className="flex items-baseline justify-between gap-4">
                      <p className="text-body-sm text-fg">{item.name}</p>
                      <p className="shrink-0 font-mono text-body-sm text-fg-secondary">
                        × {item.qty}
                        {item.unit ? ` ${item.unit}` : ""}
                      </p>
                    </div>
                  ))}
                  {d.sendTo && d.sendTo.length > 0 && (
                    <p className="mt-1 border-t border-edge pt-2.5 text-caption text-fg-muted">
                      On approval, emails to <span className="font-mono">{d.sendTo.join(", ")}</span>
                    </p>
                  )}
                </CardBody>
                <CardFooter>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      deleteOrder(d.id);
                      toast({ tone: "neutral", title: `Draft ${d.id} deleted` });
                    }}
                  >
                    Delete draft
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      submitDraft(d.id);
                      toast({
                        tone: "success",
                        title: `Draft ${d.id} submitted for approval`,
                        description: `Next automatic raise moves one ${d.recurrence ?? "cycle"} out`,
                      });
                    }}
                  >
                    Submit now
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10">
        <SectionHeader
          title="Stock levels"
          description="Counted at the level 20 store · reorder points set per item."
        />
        <FilterBar>
          <SearchInput
            className="w-64"
            placeholder="Search stock…"
            value={stockSearch}
            onChange={(e) => setStockSearch(e.target.value)}
          />
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
              {c} {c === "All" ? stock.length : stock.filter((s) => s.category === c).length}
            </button>
          ))}
        </FilterBar>
        <Table sticky>
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
