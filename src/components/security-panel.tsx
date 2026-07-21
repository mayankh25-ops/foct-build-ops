"use client";

import * as React from "react";
import {
  Camera,
  Container,
  DoorClosed,
  Fence,
  Lock,
  LockOpen,
  Plus,
  Settings2,
  Trash2,
  Warehouse,
} from "lucide-react";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
} from "@/components/ui/modal";
import { SectionHeader } from "@/components/ui/section-header";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { building } from "@/lib/demo-data";
import {
  useGatewayOnline,
  useSecurityReady,
  useSecurityStore,
  type DoorIcon,
} from "@/lib/security-store";
import { cn } from "@/lib/cn";

const doorIconMap: Record<DoorIcon, React.ComponentType<{ className?: string }>> = {
  door: DoorClosed,
  garage: Warehouse,
  gate: Fence,
  dock: Container,
};

/* ---------------------------------------------------------------- */
/* Configure — gateway, cameras, doors                               */
/* ---------------------------------------------------------------- */

function ConfigureModal() {
  const gatewayUrl = useSecurityStore((s) => s.gatewayUrl);
  const cameras = useSecurityStore((s) => s.cameras);
  const doors = useSecurityStore((s) => s.doors);
  const setGatewayUrl = useSecurityStore((s) => s.setGatewayUrl);
  const addCamera = useSecurityStore((s) => s.addCamera);
  const removeCamera = useSecurityStore((s) => s.removeCamera);
  const addDoor = useSecurityStore((s) => s.addDoor);
  const removeDoor = useSecurityStore((s) => s.removeDoor);
  const updateDoor = useSecurityStore((s) => s.updateDoor);
  const { toast } = useToast();

  const [open, setOpen] = React.useState(false);
  const [gw, setGw] = React.useState(gatewayUrl);
  const [camName, setCamName] = React.useState("");
  const [camLoc, setCamLoc] = React.useState("");
  const [camSrc, setCamSrc] = React.useState("");
  const [doorName, setDoorName] = React.useState("");
  const [doorIcon, setDoorIcon] = React.useState<DoorIcon>("door");

  const openChange = (o: boolean) => {
    setOpen(o);
    if (o) setGw(gatewayUrl);
  };

  return (
    <Modal open={open} onOpenChange={openChange}>
      <ModalTrigger asChild>
        <Button variant="ghost" size="sm">
          <Settings2 aria-hidden /> Configure
        </Button>
      </ModalTrigger>
      <ModalContent size="xl">
        <ModalHeader>
          <ModalTitle>Cameras &amp; doors — configuration</ModalTitle>
          <ModalDescription>
            Streams come from the go2rtc gateway running on this PC; door triggers call your
            controller&apos;s LAN URL. Setup steps: docs/SECURITY_CAMERAS_DOORS.md.
          </ModalDescription>
        </ModalHeader>
        <ModalBody className="flex flex-col gap-6">
          <div className="rounded-card border border-edge bg-canvas p-4">
            <p className="text-body-sm font-medium text-fg">Stream gateway (go2rtc)</p>
            <p className="mt-0.5 text-caption text-fg-muted">
              The local address go2rtc listens on — default http://127.0.0.1:1984.
            </p>
            <div className="mt-3 flex items-end gap-2">
              <Input
                aria-label="Gateway URL"
                value={gw}
                onChange={(e) => setGw(e.target.value)}
                placeholder="http://127.0.0.1:1984"
              />
              <Button
                variant="secondary"
                className="shrink-0"
                onClick={() => {
                  setGatewayUrl(gw);
                  toast({ tone: "success", title: "Gateway saved" });
                }}
              >
                Save
              </Button>
            </div>
          </div>

          <div className="rounded-card border border-edge bg-canvas p-4">
            <p className="text-body-sm font-medium text-fg">Cameras</p>
            <div className="mt-3 flex flex-col gap-2">
              {cameras.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-card border border-edge bg-surface px-3.5 py-2.5">
                  <Camera aria-hidden className="size-4 shrink-0 text-fg-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-sm font-medium text-fg">{c.name}</span>
                    <span className="block truncate text-caption text-fg-muted">
                      {c.location} · stream <span className="font-mono">{c.src}</span>
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove camera ${c.name}`}
                    onClick={() => removeCamera(c.id)}
                    className="flex size-8 shrink-0 items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-hover hover:text-critical-text"
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_10rem_auto]">
              <Input aria-label="Camera name" placeholder="Name, e.g. Pool deck" value={camName} onChange={(e) => setCamName(e.target.value)} />
              <Input aria-label="Camera location" placeholder="Location, e.g. Level 6" value={camLoc} onChange={(e) => setCamLoc(e.target.value)} />
              <Input aria-label="Stream name" placeholder="go2rtc name" value={camSrc} onChange={(e) => setCamSrc(e.target.value)} />
              <Button
                variant="secondary"
                disabled={!camName.trim() || !camSrc.trim()}
                onClick={() => {
                  addCamera({ name: camName.trim(), location: camLoc.trim() || "—", src: camSrc.trim() });
                  setCamName(""); setCamLoc(""); setCamSrc("");
                  toast({ tone: "success", title: "Camera added" });
                }}
              >
                <Plus aria-hidden /> Add
              </Button>
            </div>
          </div>

          <div className="rounded-card border border-edge bg-canvas p-4">
            <p className="text-body-sm font-medium text-fg">Doors</p>
            <p className="mt-0.5 text-caption text-fg-muted">
              Demo mode flips state on screen only. HTTP mode also calls the controller&apos;s
              trigger URLs — enable with SECURITY_TRIGGERS_ENABLED=1 on this PC.
            </p>
            <div className="mt-3 flex flex-col gap-2.5">
              {doors.map((d) => (
                <div key={d.id} className="rounded-card border border-edge bg-surface p-3.5">
                  <div className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-body-sm font-medium text-fg">{d.name}</span>
                    <Select
                      aria-label={`Mode for ${d.name}`}
                      className="w-28"
                      options={[
                        { value: "demo", label: "Demo" },
                        { value: "http", label: "HTTP" },
                      ]}
                      value={d.mode}
                      onValueChange={(v) => updateDoor(d.id, { mode: v as "demo" | "http" })}
                    />
                    <Input
                      aria-label={`Auto-relock seconds for ${d.name}`}
                      className="w-24 text-center"
                      inputMode="numeric"
                      placeholder="Relock s"
                      defaultValue={d.autoRelockSeconds ? String(d.autoRelockSeconds) : ""}
                      onBlur={(e) => {
                        const n = Number.parseInt(e.target.value, 10);
                        updateDoor(d.id, { autoRelockSeconds: Number.isFinite(n) && n > 0 ? n : undefined });
                      }}
                    />
                    <button
                      type="button"
                      aria-label={`Remove door ${d.name}`}
                      onClick={() => removeDoor(d.id)}
                      className="flex size-8 shrink-0 items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-hover hover:text-critical-text"
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </button>
                  </div>
                  {d.mode === "http" && (
                    <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                      <Input
                        aria-label={`Unlock URL for ${d.name}`}
                        placeholder="Unlock URL, e.g. http://192.168.1.50/relay?on"
                        defaultValue={d.unlockUrl ?? ""}
                        onBlur={(e) => updateDoor(d.id, { unlockUrl: e.target.value.trim() || undefined })}
                      />
                      <Input
                        aria-label={`Lock URL for ${d.name}`}
                        placeholder="Lock URL"
                        defaultValue={d.lockUrl ?? ""}
                        onBlur={(e) => updateDoor(d.id, { lockUrl: e.target.value.trim() || undefined })}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_11rem_auto]">
              <Input aria-label="New door name" placeholder="Door name, e.g. Fire stair L1" value={doorName} onChange={(e) => setDoorName(e.target.value)} />
              <Select
                aria-label="New door type"
                options={[
                  { value: "door", label: "Door" },
                  { value: "garage", label: "Roller / garage" },
                  { value: "gate", label: "Gate" },
                  { value: "dock", label: "Dock" },
                ]}
                value={doorIcon}
                onValueChange={(v) => setDoorIcon(v as DoorIcon)}
              />
              <Button
                variant="secondary"
                disabled={!doorName.trim()}
                onClick={() => {
                  addDoor({ name: doorName.trim(), icon: doorIcon, mode: "demo" });
                  setDoorName("");
                  toast({ tone: "success", title: "Door added" });
                }}
              >
                <Plus aria-hidden /> Add
              </Button>
            </div>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

/* ---------------------------------------------------------------- */
/* The dashboard panel                                               */
/* ---------------------------------------------------------------- */

export function SecurityPanel() {
  const ready = useSecurityReady();
  const gatewayUrl = useSecurityStore((s) => s.gatewayUrl);
  const cameras = useSecurityStore((s) => s.cameras);
  const doors = useSecurityStore((s) => s.doors);
  const toggleDoor = useSecurityStore((s) => s.toggleDoor);
  const online = useGatewayOnline(gatewayUrl);
  const { toast } = useToast();

  if (!ready) return null;

  return (
    <div className="mt-8">
      <SectionHeader
        title="Cameras & doors"
        description="Live feeds from the local stream gateway, and soft-triggers for building doors — every action is logged."
        actions={<ConfigureModal />}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cameras.map((cam) => (
              <figure key={cam.id} className="m-0 overflow-hidden rounded-card border border-edge bg-surface shadow-card">
                <div className="relative aspect-video bg-canvas">
                  {online ? (
                    <iframe
                      src={`${gatewayUrl}/stream.html?src=${encodeURIComponent(cam.src)}&mode=webrtc,mse`}
                      title={`${cam.name} live stream`}
                      className="absolute inset-0 size-full border-0"
                      allow="autoplay"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                      <Camera aria-hidden className="size-5 text-fg-muted" />
                      <p className="text-caption text-fg-muted">
                        {online === null ? "Checking gateway…" : "Gateway offline"}
                      </p>
                    </div>
                  )}
                  <span className="absolute top-2 left-2">
                    <StatusPill tone={online ? "success" : "neutral"}>
                      {online ? "Live" : "Offline"}
                    </StatusPill>
                  </span>
                </div>
                <figcaption className="flex items-baseline justify-between gap-3 px-3.5 py-2.5">
                  <span className="truncate text-body-sm font-medium text-fg">{cam.name}</span>
                  <span className="shrink-0 text-caption text-fg-muted">{cam.location}</span>
                </figcaption>
              </figure>
            ))}
          </div>
          {online === false && (
            <p className="mt-3 text-caption text-fg-muted">
              Start the go2rtc gateway on this PC to bring feeds live — setup steps in{" "}
              <span className="font-mono">docs/SECURITY_CAMERAS_DOORS.md</span>.
            </p>
          )}
        </div>

        <div className="min-w-0">
          {/* access-control style: one row per door, lock toggle on the right */}
          <div className="overflow-hidden rounded-card border border-edge bg-surface shadow-card">
            {doors.map((d, i) => {
              const Icon = doorIconMap[d.icon];
              const unlocked = d.state === "unlocked";
              return (
                <div
                  key={d.id}
                  className={cn("flex items-center gap-3.5 px-4 py-3.5", i > 0 && "border-t border-edge")}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-control",
                      unlocked ? "bg-warning-subtle text-warning-text" : "bg-accent-subtle text-accent-text"
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-sm font-medium text-fg">{d.name}</p>
                    <p className={cn("flex items-center gap-1 text-caption", unlocked ? "text-warning-text" : "text-fg-muted")}>
                      {unlocked ? <LockOpen aria-hidden className="size-3" /> : <Lock aria-hidden className="size-3" />}
                      {unlocked
                        ? d.autoRelockSeconds
                          ? `Unlocked · auto-relocks in ${d.autoRelockSeconds}s`
                          : "Unlocked"
                        : "Locked · secure"}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={unlocked}
                    aria-label={`${unlocked ? "Lock" : "Unlock"} ${d.name}`}
                    onClick={() => {
                      toggleDoor(d.id, building.manager.name);
                      toast({
                        tone: unlocked ? "success" : "neutral",
                        title: `${d.name} ${unlocked ? "locked" : "unlocked"}`,
                        description:
                          !unlocked && d.autoRelockSeconds
                            ? `Auto-relocks in ${d.autoRelockSeconds}s`
                            : undefined,
                      });
                    }}
                    className={cn(
                      "relative h-7 w-12 shrink-0 rounded-pill transition-colors duration-150",
                      unlocked ? "bg-warning" : "bg-success"
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "absolute top-0.5 flex size-6 items-center justify-center rounded-pill bg-surface shadow-card transition-[left] duration-150",
                        unlocked ? "left-[1.375rem]" : "left-0.5"
                      )}
                    >
                      {unlocked ? (
                        <LockOpen className="size-3 text-warning-text" />
                      ) : (
                        <Lock className="size-3 text-success-text" />
                      )}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
          <p className="mt-2.5 text-caption text-fg-muted">
            Green = secured · amber = unlocked. Every action is recorded for the audit trail.
          </p>
        </div>
      </div>
    </div>
  );
}
