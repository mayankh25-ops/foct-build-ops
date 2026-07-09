"use client";

/**
 * Service Desk demo store — the module's working brain until Stage 2.
 * Full ticket lifecycle (create → attend → close-with-proof → reopen → CSAT),
 * followers, internal notes and photo attachments, persisted to localStorage.
 * Zustand per CLAUDE.md (client state only); Supabase replaces this store in
 * the Service Desk backend stages without touching the screens.
 */
import * as React from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  sdPriorityMeta,
  sdTickets,
  type SdEvent,
  type SdPriority,
  type SdTicket,
} from "@/lib/service-desk-data";
import { fetchLiveTickets, lodgeViaIntake, SD_LIVE_FLAG, sdLive } from "@/lib/sd-supabase";

export interface SdTicketLive extends SdTicket {
  /** Downscaled data-URL thumbnails for tickets created/closed in this browser. */
  photoUrlsBefore?: string[];
  photoUrlsAfter?: string[];
}

export interface NewTicketInput {
  lodgedBy: string;
  category: SdTicket["category"];
  locations: { level: string; area?: string }[];
  description: string;
  priority: SdPriority;
  followers: string[];
  photoUrls: string[];
}

/** SLA attend targets per priority — drives the chip on freshly created tickets. */
const attendTarget: Record<SdPriority, string> = {
  urgent: "15m",
  high: "45m",
  normal: "2h",
  low: "4h",
};

function nowLabel(): string {
  const t = new Date().toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `Today ${t}`;
}

function nextRef(tickets: SdTicketLive[]): string {
  const max = tickets.reduce((m, t) => {
    const seq = Number(t.ref.split("-").at(-1));
    return Number.isFinite(seq) && seq > m ? seq : m;
  }, 0);
  return `SD-AUR-2607-${String(max + 1).padStart(4, "0")}`;
}

interface SdState {
  tickets: SdTicketLive[];
  /** "off" = local demo store; "on" = rows loaded from Supabase (NEXT_PUBLIC_SD_LIVE=1). */
  liveState: "off" | "loading" | "on" | "error";
  initLive: () => Promise<void>;
  createTicket: (input: NewTicketInput) => string;
  assign: (ref: string, cleaner: string) => void;
  attend: (ref: string, by: string) => void;
  close: (ref: string, args: { by: string; note?: string; photoUrls: string[] }) => void;
  reopen: (ref: string, by: string) => void;
  addInternalNote: (ref: string, by: string, text: string) => void;
  addFollower: (ref: string, email: string) => void;
  removeFollower: (ref: string, email: string) => void;
  setCsat: (ref: string, rating: "up" | "down") => void;
  resetDemo: () => void;
}

const update = (
  tickets: SdTicketLive[],
  ref: string,
  fn: (t: SdTicketLive) => SdTicketLive
): SdTicketLive[] => tickets.map((t) => (t.ref === ref ? fn(t) : t));

const withEvent = (t: SdTicketLive, e: Omit<SdEvent, "at">): SdTicketLive => ({
  ...t,
  events: [...t.events, { ...e, at: nowLabel() }],
});

/** localStorage that never throws (private mode, quota from photo thumbnails). */
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
      /* demo persistence is best-effort */
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

export const useSdStore = create<SdState>()(
  persist(
    (set) => ({
      tickets: sdTickets as SdTicketLive[],
      liveState: "off",

      initLive: async () => {
        if (!SD_LIVE_FLAG) return;
        set({ liveState: "loading" });
        try {
          const tickets = await fetchLiveTickets();
          set({ tickets, liveState: "on" });
        } catch (e) {
          console.warn("sd live load failed — staying on local demo data", e);
          set({ liveState: "error" });
        }
      },

      createTicket: (input) => {
        let ref = "";
        set((s) => {
          ref = nextRef(s.tickets);
          const ticket: SdTicketLive = {
            ref,
            category: input.category,
            locations: input.locations,
            description: input.description,
            priority: input.priority,
            status: "new",
            lodgedBy: input.lodgedBy,
            followers: input.followers,
            createdAt: nowLabel(),
            sla: { state: "running", remaining: `${attendTarget[input.priority]} to attend` },
            photosBefore: input.photoUrls.length,
            photosAfter: 0,
            photoUrlsBefore: input.photoUrls,
            events: [
              {
                at: nowLabel(),
                who: input.lodgedBy,
                what: `Ticket lodged · ${input.photoUrls.length} photo${input.photoUrls.length === 1 ? "" : "s"} · ${sdPriorityMeta[input.priority].label}`,
                kind: "created",
              },
              {
                at: nowLabel(),
                who: "System",
                what: `WhatsApp + push sent to on-duty cleaner${input.followers.length ? ` · ${input.followers.length} follower${input.followers.length === 1 ? "" : "s"} subscribed` : ""} (simulated in preview)`,
                kind: "notify",
              },
            ],
          };
          return { tickets: [ticket, ...s.tickets] };
        });
        if (SD_LIVE_FLAG) {
          void lodgeViaIntake(input)
            .then(() => useSdStore.getState().initLive()) // server ref becomes truth
            .catch((e) => console.warn("sd live lodge failed", e));
        }
        return ref;
      },

      assign: (ref, cleaner) => {
        if (SD_LIVE_FLAG) void sdLive.assign(ref, cleaner).catch((e) => console.warn(e));
        set((s) => ({
          tickets: update(s.tickets, ref, (t) =>
            withEvent(
              { ...t, assignee: cleaner, status: t.status === "new" ? "open" : t.status },
              { who: "Priya Sharma", what: `Assigned ${cleaner}`, kind: "status" }
            )
          ),
        }));
      },

      attend: (ref, by) => {
        if (SD_LIVE_FLAG) void sdLive.attend(ref, by).catch((e) => console.warn(e));
        set((s) => ({
          tickets: update(s.tickets, ref, (t) =>
            withEvent(
              {
                ...t,
                status: "in-progress",
                assignee: t.assignee ?? by,
                sla: { state: "running", remaining: "on site — resolve timer running" },
              },
              { who: by, what: "Attending — status In progress", kind: "status" }
            )
          ),
        }));
      },

      close: (ref, { by, note, photoUrls }) => {
        if (SD_LIVE_FLAG) void sdLive.close(ref, { by, note, photoUrls }).catch((e) => console.warn(e));
        set((s) => ({
          tickets: update(s.tickets, ref, (t) => {
            let next: SdTicketLive = {
              ...t,
              status: "resolved",
              assignee: by,
              photosAfter: photoUrls.length,
              photoUrlsAfter: photoUrls,
              sla: { state: "met", toAttend: "—", toResolve: "met" },
              pdf: `${t.ref}.pdf`,
            };
            next = withEvent(next, {
              who: by,
              what: `After photos uploaded · ${photoUrls.length}${note ? ` — ${note}` : ""}`,
              kind: "photo",
            });
            next = withEvent(next, {
              who: by,
              what: `Resolved — closure notification sent to ${t.lodgedBy}${t.followers.length ? ` + ${t.followers.length} follower${t.followers.length === 1 ? "" : "s"}` : ""} (simulated) · proof PDF queued`,
              kind: "status",
            });
            return next;
          }),
        }));
      },

      reopen: (ref, by) => {
        if (SD_LIVE_FLAG) void sdLive.reopen(ref, by).catch((e) => console.warn(e));
        set((s) => ({
          tickets: update(s.tickets, ref, (t) =>
            withEvent(
              { ...t, status: "reopened", csat: undefined, sla: { state: "breached", over: "reopened — clock restarted" } },
              { who: by, what: "Reopened — issue not fixed. Manager alerted (simulated)", kind: "status" }
            )
          ),
        }));
      },

      addInternalNote: (ref, by, text) => {
        if (SD_LIVE_FLAG) void sdLive.addInternalNote(ref, by, text).catch((e) => console.warn(e));
        set((s) => ({
          tickets: update(s.tickets, ref, (t) =>
            withEvent(t, { who: by, what: text, internal: true, kind: "note" })
          ),
        }));
      },

      addFollower: (ref, email) => {
        if (SD_LIVE_FLAG) void sdLive.addFollower(ref, email).catch((e) => console.warn(e));
        set((s) => ({
          tickets: update(s.tickets, ref, (t) =>
            t.followers.includes(email)
              ? t
              : withEvent(
                  { ...t, followers: [...t.followers, email] },
                  { who: "Priya Sharma", what: `Added follower ${email}`, kind: "notify" }
                )
          ),
        }));
      },

      removeFollower: (ref, email) => {
        if (SD_LIVE_FLAG) void sdLive.removeFollower(ref, email).catch((e) => console.warn(e));
        set((s) => ({
          tickets: update(s.tickets, ref, (t) => ({
            ...t,
            followers: t.followers.filter((f) => f !== email),
          })),
        }));
      },

      setCsat: (ref, rating) => {
        if (SD_LIVE_FLAG) void sdLive.setCsat(ref, rating).catch((e) => console.warn(e));
        set((s) => ({
          tickets: update(s.tickets, ref, (t) =>
            withEvent({ ...t, csat: rating }, {
              who: t.lodgedBy,
              what: `Rated the fix ${rating === "up" ? "👍" : "👎"}`,
              kind: "csat",
            })
          ),
        }));
      },

      resetDemo: () => set({ tickets: sdTickets as SdTicketLive[] }),
    }),
    {
      name: "foct-sd-demo-v1",
      storage: createJSONStorage(() => safeStorage),
      // SSR-safe: server and first client render both show the seed data;
      // pages call rehydrate() in an effect so persisted state applies post-mount.
      skipHydration: true,
    }
  )
);

/** Rehydrate persisted tickets after mount (hydration-safe). */
export function useSdRehydrate() {
  const done = React.useRef(false);
  React.useEffect(() => {
    if (!done.current) {
      done.current = true;
      void useSdStore.persist.rehydrate();
      void useSdStore.getState().initLive(); // no-op unless NEXT_PUBLIC_SD_LIVE=1
    }
  }, []);
}
