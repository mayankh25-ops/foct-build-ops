"use client";

/**
 * Theme Builder store — row shapes mirror supabase/migrations/0001_theme_engine.sql
 * exactly (themes / building_theme_assignments), persisted locally until
 * Stage 2 provisions Supabase. Same swap pattern as the Service Desk store.
 */
import * as React from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Authored, TokenMap } from "@/lib/theme-builder";

/** Demo tenancy scope (Stage 2 replaces with real org/building ids). */
export const DEMO_ORG = "foct-cleaning";
export const DEMO_BUILDING = "aurora-on-collins";
export const DEFAULT_THEME = "option-nature"; // owner decision 2026-07-07

export interface CustomTheme {
  id: string;
  orgId: string;
  buildingId: string | null;
  name: string;
  slug: string;
  baseTheme: string;
  /** Full derived token map (what [data-theme] CSS is generated from). */
  tokens: TokenMap;
  /** The 8 admin-authored values (editing re-opens from these). */
  authored: Authored;
  isBuiltin: false;
  createdAt: string;
}

export interface FontSlots {
  display?: string; // FontOption id or uploaded font id
  body?: string;
  mono?: string;
}

export interface UploadedFont {
  id: string; // "upload-<n>"
  name: string;
  /** woff2 as data URL (FontFace source now; Storage upload at Stage 2). */
  dataUrl: string;
  /** Org-scoped Supabase Storage path recorded for Stage 2. */
  storagePath: string;
}

interface ThemeState {
  /** building_theme_assignments.theme slug for the demo building. */
  assignedTheme: string;
  /** building_theme_assignments.fonts jsonb — per-building slot overrides. */
  fontSlots: FontSlots;
  customThemes: CustomTheme[];
  uploadedFonts: UploadedFont[];
  assignTheme: (slug: string) => void;
  saveCustomTheme: (theme: Omit<CustomTheme, "id" | "orgId" | "buildingId" | "isBuiltin" | "createdAt"> & { id?: string }) => void;
  deleteCustomTheme: (id: string) => void;
  setFontSlots: (slots: FontSlots) => void;
  addUploadedFont: (name: string, dataUrl: string) => UploadedFont;
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
      /* best-effort demo persistence */
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

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      assignedTheme: DEFAULT_THEME,
      fontSlots: {},
      customThemes: [],
      uploadedFonts: [],

      assignTheme: (slug) => set({ assignedTheme: slug }),

      saveCustomTheme: (input) =>
        set((s) => {
          const existing = input.id ? s.customThemes.find((t) => t.id === input.id) : undefined;
          if (existing) {
            return {
              customThemes: s.customThemes.map((t) =>
                t.id === input.id ? { ...t, ...input, slug: t.slug } : t
              ),
            };
          }
          // keep slugs unique per org (matches the DB unique constraint)
          let slug = input.slug;
          let n = 2;
          while (s.customThemes.some((t) => t.slug === slug)) slug = `${input.slug}-${n++}`;
          const theme: CustomTheme = {
            ...input,
            slug,
            id: `theme-${Date.now()}`,
            orgId: DEMO_ORG,
            buildingId: DEMO_BUILDING,
            isBuiltin: false,
            createdAt: new Date().toLocaleDateString("en-AU"),
          };
          return { customThemes: [...s.customThemes, theme] };
        }),

      deleteCustomTheme: (id) =>
        set((s) => {
          const theme = s.customThemes.find((t) => t.id === id);
          const stillAssigned = theme && s.assignedTheme === theme.slug;
          return {
            customThemes: s.customThemes.filter((t) => t.id !== id),
            assignedTheme: stillAssigned ? DEFAULT_THEME : s.assignedTheme,
          };
        }),

      setFontSlots: (slots) => set({ fontSlots: slots }),

      addUploadedFont: (name, dataUrl) => {
        const font: UploadedFont = {
          id: `upload-${Date.now()}`,
          name,
          dataUrl,
          storagePath: `org/${DEMO_ORG}/fonts/${name.toLowerCase().replace(/[^a-z0-9.]+/g, "-")}`,
        };
        set((s) => ({ uploadedFonts: [...s.uploadedFonts, font] }));
        return font;
      },
    }),
    {
      name: "foct-theme-builder-v1",
      storage: createJSONStorage(() => safeStorage),
      skipHydration: true, // SSR-safe: rehydrate post-mount via useThemeRehydrate
    }
  )
);

export function useThemeRehydrate() {
  const done = React.useRef(false);
  React.useEffect(() => {
    if (!done.current) {
      done.current = true;
      void useThemeStore.persist.rehydrate();
    }
  }, []);
}
