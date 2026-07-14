"use client";

/**
 * Integrations admin state. Two modes, mirroring the Service Desk pattern:
 *  - DEMO (default): credentials live in localStorage — but exactly like the
 *    backend, only masked values and non-secret config are ever stored;
 *    secrets are used transiently for the simulated test then dropped.
 *  - LIVE (NEXT_PUBLIC_INTEGRATIONS_LIVE=1 + Supabase env): reads via RLS,
 *    writes via the 0005 SECURITY DEFINER RPCs, tests/sends via the
 *    /api/integrations routes. Secrets go straight to Vault; the client
 *    never sees them again.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  maskValue,
  providerBySlug,
  splitSecretValues,
  validateSchemaValues,
  type IntegrationCategory,
} from "@/lib/integrations/catalogue";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export const INTEGRATIONS_LIVE_FLAG =
  process.env.NEXT_PUBLIC_INTEGRATIONS_LIVE === "1" && isSupabaseConfigured;

/** Demo org context — Meridian Strata owns Aurora on Collins (seed.sql). */
export const DEMO_ORG_ID = "11111111-0000-0000-0000-000000000001";

export interface SavedCredential {
  id: string;
  providerSlug: string;
  brand: string;
  category: IntegrationCategory;
  label: string;
  masked: string;
  /** Non-secret schema fields only (fromEmail, region, sender id, …). */
  config: Record<string, string>;
  active: boolean;
  lastTestAt?: string;
  lastTestOk?: boolean;
  lastTestNote?: string;
  activatedAt?: string;
  replaces?: string;
  createdAt: string;
}

export interface IntegrationAuditEvent {
  id: string;
  at: string;
  action: string;
  detail: string;
}

export interface SendLogEntry {
  id: string;
  at: string;
  channel: IntegrationCategory;
  brand: string;
  recipient: string; // masked
  subject?: string;
  status: "sent" | "failed";
  isTest: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface TestOutcome {
  ok: boolean;
  detail: string;
}

export interface SendOutcome {
  ok: boolean;
  provider?: string;
  providerMessageId?: string;
  error?: string;
}

interface IntegrationsState {
  credentials: SavedCredential[];
  audit: IntegrationAuditEvent[];
  sendLog: SendLogEntry[];
  /** Test a credential form BEFORE save (values include secrets, transiently). */
  testConnection: (slug: string, values: Record<string, string>) => Promise<TestOutcome>;
  /** Persist a credential set (starts inactive). Returns the new id. */
  saveCredential: (
    slug: string,
    values: Record<string, string>,
    label: string,
    test: TestOutcome | null,
    replaces?: string
  ) => Promise<string>;
  activate: (id: string) => Promise<TestOutcome>;
  deactivate: (id: string) => Promise<void>;
  sendTest: (channel: IntegrationCategory, to: string) => Promise<SendOutcome>;
  resetDemo: () => void;
}

const now = () => new Date().toISOString();
const uid = () => Math.random().toString(36).slice(2, 10);

const maskRecipient = (recipient: string): string => {
  const at = recipient.indexOf("@");
  if (at > -1) {
    const domain = recipient.slice(at + 1);
    return `${recipient.slice(0, 1)}•••@${domain.slice(0, 1)}•••${domain.slice(domain.lastIndexOf("."))}`;
  }
  return `${recipient.slice(0, 3)}${"•".repeat(Math.max(recipient.length - 6, 1))}${recipient.slice(-3)}`;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
      /* private mode */
    }
  },
  removeItem: (k: string) => {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* private mode */
    }
  },
};

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useIntegrationsStore = create<IntegrationsState>()(
  persist(
    (set, get) => ({
      credentials: [],
      audit: [],
      sendLog: [],

      async testConnection(slug, values) {
        const provider = providerBySlug(slug);
        if (!provider) return { ok: false, detail: "Unknown provider" };

        if (INTEGRATIONS_LIVE_FLAG) {
          const res = await fetch("/api/integrations/test", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(await authHeader()) },
            body: JSON.stringify({ orgId: DEMO_ORG_ID, slug, config: values }),
          });
          return (await res.json()) as TestOutcome;
        }

        // demo: validate against the JSON Schema, simulate the round trip
        const errors = validateSchemaValues(provider.configSchema, values);
        await wait(900);
        const firstError = Object.values(errors)[0];
        if (firstError) return { ok: false, detail: firstError };
        return {
          ok: true,
          detail: `Verified — ${provider.brand} accepted the credentials (demo simulation)`,
        };
      },

      async saveCredential(slug, values, label, test, replaces) {
        const provider = providerBySlug(slug);
        if (!provider) throw new Error("unknown provider");
        const { config, secrets } = splitSecretValues(provider.configSchema, values);
        const maskSource = values[provider.configSchema["x-mask"]] ?? "";

        if (INTEGRATIONS_LIVE_FLAG) {
          const supabase = getSupabase();
          const { data: providerRow } = await supabase
            .from("integration_providers")
            .select("id")
            .eq("slug", slug)
            .single();
          const { data, error } = await supabase.rpc("integration_credential_save", {
            p_provider: providerRow?.id,
            p_org: DEMO_ORG_ID,
            p_building: null,
            p_label: label,
            p_config: config,
            p_secrets: secrets,
            p_masked: maskValue(maskSource),
            p_test_ok: test?.ok ?? null,
            p_test_note: test?.detail ?? null,
            p_replaces: replaces ?? null,
          });
          if (error) throw new Error(error.message);
          return data as string;
        }

        const id = uid();
        const credential: SavedCredential = {
          id,
          providerSlug: slug,
          brand: provider.brand,
          category: provider.category,
          label: label || provider.brand,
          masked: maskValue(maskSource),
          config, // secrets are intentionally DROPPED here — demo mirrors Vault
          active: false,
          lastTestAt: test ? now() : undefined,
          lastTestOk: test?.ok,
          lastTestNote: test?.detail,
          replaces,
          createdAt: now(),
        };
        set((state) => ({
          credentials: [credential, ...state.credentials],
          audit: [
            {
              id: uid(),
              at: now(),
              action: "integration.credential.saved",
              detail: `${provider.brand} (${provider.category}) — ${credential.masked}`,
            },
            ...state.audit,
          ],
        }));
        return id;
      },

      async activate(id) {
        const credential = get().credentials.find((c) => c.id === id);
        if (!credential) return { ok: false, detail: "Credential not found" };
        if (credential.lastTestOk !== true) {
          return { ok: false, detail: "Test the connection before activating" };
        }

        if (INTEGRATIONS_LIVE_FLAG) {
          const { error } = await getSupabase().rpc("integration_credential_activate", { p_id: id });
          if (error) return { ok: false, detail: error.message };
          return { ok: true, detail: "Activated" };
        }

        set((state) => {
          const previous = state.credentials.find(
            (c) => c.active && c.category === credential.category && c.id !== id
          );
          return {
            credentials: state.credentials.map((c) => {
              if (c.id === id) return { ...c, active: true, activatedAt: now() };
              if (c.active && c.category === credential.category) return { ...c, active: false };
              return c;
            }),
            audit: [
              {
                id: uid(),
                at: now(),
                action: "integration.credential.activated",
                detail: `${credential.brand} is now the active ${credential.category} provider`,
              },
              ...(previous
                ? [
                    {
                      id: uid(),
                      at: now(),
                      action: "integration.credential.deactivated",
                      detail: `${previous.brand} deactivated (kept for rollback)`,
                    },
                  ]
                : []),
              ...state.audit,
            ],
          };
        });
        return { ok: true, detail: "Activated" };
      },

      async deactivate(id) {
        const credential = get().credentials.find((c) => c.id === id);
        if (!credential) return;
        if (INTEGRATIONS_LIVE_FLAG) {
          await getSupabase().rpc("integration_credential_deactivate", { p_id: id });
          return;
        }
        set((state) => ({
          credentials: state.credentials.map((c) => (c.id === id ? { ...c, active: false } : c)),
          audit: [
            {
              id: uid(),
              at: now(),
              action: "integration.credential.deactivated",
              detail: `${credential.brand} (${credential.category}) deactivated`,
            },
            ...state.audit,
          ],
        }));
      },

      async sendTest(channel, to) {
        if (INTEGRATIONS_LIVE_FLAG) {
          const res = await fetch("/api/integrations/send-test", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(await authHeader()) },
            body: JSON.stringify({ orgId: DEMO_ORG_ID, channel, to }),
          });
          return (await res.json()) as SendOutcome;
        }

        const active = get().credentials.find((c) => c.active && c.category === channel);
        await wait(1100);
        const outcome: SendOutcome = active
          ? { ok: true, provider: active.brand, providerMessageId: `demo-${uid()}` }
          : { ok: false, error: `No active ${channel} provider configured` };
        set((state) => ({
          sendLog: [
            {
              id: uid(),
              at: now(),
              channel,
              brand: active?.brand ?? "none",
              recipient: maskRecipient(to),
              subject: channel === "email" ? "FOCT BuildingOps — test email" : undefined,
              status: outcome.ok ? "sent" : "failed",
              isTest: true,
              providerMessageId: outcome.providerMessageId,
              error: outcome.error,
            },
            ...state.sendLog.slice(0, 49),
          ],
        }));
        return outcome;
      },

      resetDemo() {
        set({ credentials: [], audit: [], sendLog: [] });
      },
    }),
    {
      name: "foct-integrations-v1",
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        credentials: state.credentials,
        audit: state.audit,
        sendLog: state.sendLog,
      }),
    }
  )
);
