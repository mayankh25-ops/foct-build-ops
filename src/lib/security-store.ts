"use client";

/**
 * Building security panel (owner direction 2026-07-18): live camera feeds
 * + door soft-triggers on the dashboard.
 *
 * CAMERAS — browsers can't play RTSP natively. The supported path is a
 * LOCAL gateway on the concierge PC (go2rtc, a single free binary) that
 * pulls RTSP and re-serves it browser-friendly; the dashboard embeds
 * `<gateway>/stream.html?src=<name>`. Gateway URL + camera list are
 * config, not code (docs/SECURITY_CAMERAS_DOORS.md has the setup steps).
 *
 * DOORS — big Lock/Unlock toggles. Two modes per door:
 *  - "demo": state flips locally (default — safe everywhere).
 *  - "http": additionally fires the door controller's LAN trigger URL
 *    (Akuvox / Hikvision ISAPI / relay boards) via /api/security/door,
 *    which only acts when SECURITY_TRIGGERS_ENABLED=1 AND the target is
 *    a private-network host. Every action lands in the security log.
 * Stage 2 replaces the log with audit_logs rows and gates toggling
 * behind the standard can() permission model.
 */
import * as React from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface CameraFeed {
  id: string;
  name: string;
  location: string;
  /** go2rtc stream name (e.g. "lobby") or a full player URL */
  src: string;
}

export type DoorIcon = "door" | "garage" | "gate" | "dock";

export interface DoorControl {
  id: string;
  name: string;
  icon: DoorIcon;
  state: "locked" | "unlocked";
  mode: "demo" | "http";
  /** LAN trigger URLs for http mode — fired via /api/security/door */
  unlockUrl?: string;
  lockUrl?: string;
  /** auto-relock after N seconds of being unlocked (0/undefined = stay) */
  autoRelockSeconds?: number;
}

export interface SecurityEvent {
  id: string;
  at: string; // ISO
  who: string;
  action: string;
  target: string;
}

const SEED_CAMERAS: CameraFeed[] = [
  { id: "cam-lobby", name: "Lobby entrance", location: "Ground · main doors", src: "lobby" },
  { id: "cam-dock", name: "Loading dock", location: "B1 · roller door", src: "dock" },
  { id: "cam-carpark", name: "Carpark gate", location: "B2 · entry ramp", src: "carpark" },
];

const SEED_DOORS: DoorControl[] = [
  { id: "door-main", name: "Main entrance", icon: "door", state: "locked", mode: "demo", autoRelockSeconds: 15 },
  { id: "door-dock", name: "Loading dock roller", icon: "dock", state: "locked", mode: "demo" },
  { id: "door-carpark", name: "Carpark gate", icon: "gate", state: "locked", mode: "demo", autoRelockSeconds: 30 },
  { id: "door-bin", name: "Bin room", icon: "garage", state: "locked", mode: "demo" },
];

interface SecurityState {
  gatewayUrl: string;
  cameras: CameraFeed[];
  doors: DoorControl[];
  events: SecurityEvent[];
  seeded: boolean;
  ensureSeed: () => void;
  setGatewayUrl: (url: string) => void;
  addCamera: (input: Omit<CameraFeed, "id">) => void;
  removeCamera: (id: string) => void;
  addDoor: (input: Omit<DoorControl, "id" | "state">) => void;
  removeDoor: (id: string) => void;
  updateDoor: (id: string, patch: Partial<Omit<DoorControl, "id">>) => void;
  /** flips state, logs, and (http mode) fires the LAN trigger. */
  toggleDoor: (id: string, who: string) => void;
  resetDemo: () => void;
}

const safeStorage = {
  getItem: (k: string) => {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k: string, v: string) => {
    try {
      window.localStorage.setItem(k, v);
    } catch {
      /* best-effort */
    }
  },
  removeItem: (k: string) => {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

let seq = 0;
const relockTimers = new Map<string, ReturnType<typeof setTimeout>>();

function fireTrigger(url: string | undefined) {
  if (!url) return;
  void fetch("/api/security/door", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  }).catch(() => {
    /* logged server-side; the UI state is the source of intent */
  });
}

export const useSecurityStore = create<SecurityState>()(
  persist(
    (set, get) => ({
      gatewayUrl: "http://127.0.0.1:1984",
      cameras: [],
      doors: [],
      events: [],
      seeded: false,

      ensureSeed: () => {
        if (get().seeded && get().doors.length) return;
        set({ cameras: SEED_CAMERAS, doors: SEED_DOORS, seeded: true });
      },

      setGatewayUrl: (url) => set({ gatewayUrl: url.trim().replace(/\/$/, "") }),

      addCamera: (input) =>
        set((s) => ({
          cameras: [...s.cameras, { ...input, id: `cam-${Date.now()}-${seq++}` }],
        })),

      removeCamera: (id) => set((s) => ({ cameras: s.cameras.filter((c) => c.id !== id) })),

      addDoor: (input) =>
        set((s) => ({
          doors: [...s.doors, { ...input, id: `door-${Date.now()}-${seq++}`, state: "locked" as const }],
        })),

      removeDoor: (id) => set((s) => ({ doors: s.doors.filter((d) => d.id !== id) })),

      updateDoor: (id, patch) =>
        set((s) => ({ doors: s.doors.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),

      toggleDoor: (id, who) => {
        const door = get().doors.find((d) => d.id === id);
        if (!door) return;
        const next = door.state === "locked" ? ("unlocked" as const) : ("locked" as const);
        const event: SecurityEvent = {
          id: `ev-${Date.now()}-${seq++}`,
          at: new Date().toISOString(),
          who,
          action: next === "unlocked" ? "Unlocked" : "Locked",
          target: door.name,
        };
        set((s) => ({
          doors: s.doors.map((d) => (d.id === id ? { ...d, state: next } : d)),
          events: [event, ...s.events].slice(0, 50),
        }));
        if (door.mode === "http") fireTrigger(next === "unlocked" ? door.unlockUrl : door.lockUrl);

        const existing = relockTimers.get(id);
        if (existing) clearTimeout(existing);
        if (next === "unlocked" && door.autoRelockSeconds) {
          relockTimers.set(
            id,
            setTimeout(() => {
              relockTimers.delete(id);
              const still = get().doors.find((d) => d.id === id);
              if (still?.state !== "unlocked") return;
              set((s) => ({
                doors: s.doors.map((d) => (d.id === id ? { ...d, state: "locked" as const } : d)),
                events: [
                  {
                    id: `ev-${Date.now()}-${seq++}`,
                    at: new Date().toISOString(),
                    who: "System",
                    action: `Auto-relocked after ${door.autoRelockSeconds}s`,
                    target: door.name,
                  },
                  ...s.events,
                ].slice(0, 50),
              }));
              if (still.mode === "http") fireTrigger(still.lockUrl);
            }, door.autoRelockSeconds * 1000)
          );
        }
      },

      resetDemo: () => set({ cameras: SEED_CAMERAS, doors: SEED_DOORS, events: [], seeded: true }),
    }),
    {
      name: "foct-security-v1",
      storage: createJSONStorage(() => safeStorage),
      skipHydration: true,
      partialize: (s) => ({ ...s, events: s.events.slice(0, 50) }),
    }
  )
);

export function useSecurityReady(): boolean {
  const [ready, setReady] = React.useState(false);
  const done = React.useRef(false);
  React.useEffect(() => {
    if (!done.current) {
      done.current = true;
      void useSecurityStore.persist.rehydrate();
      useSecurityStore.getState().ensureSeed();
    }
    setReady(true);
  }, []);
  return ready;
}

/** Probe the go2rtc gateway once per mount — drives online/offline tiles. */
export function useGatewayOnline(gatewayUrl: string): boolean | null {
  const [online, setOnline] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    fetch(`${gatewayUrl}/api/streams`, { signal: ctrl.signal, mode: "no-cors" })
      .then(() => !cancelled && setOnline(true))
      .catch(() => !cancelled && setOnline(false))
      .finally(() => clearTimeout(t));
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [gatewayUrl]);
  return online;
}
