"use client";

import * as React from "react";
import { fontSlotStyle, ThemeRuntimeStyles } from "@/components/theme-runtime";
import { BUILTIN_THEMES } from "@/lib/theme-registry";
import { DEFAULT_THEME, useThemeRehydrate, useThemeStore } from "@/lib/theme-store";

/**
 * The phone surface follows the PORTAL's active theme (owner direction
 * 2026-07-15: web and app must share one colour language — the standalone
 * red `support` theme is no longer the surface default; it remains in
 * tokens.css as a Theme Builder choice). Same resolution logic as AppShell:
 * data-theme = built-in slug or a custom theme's base, plus font slots.
 */
export function SupportThemeShell({ children }: { children: React.ReactNode }) {
  useThemeRehydrate();
  const assigned = useThemeStore((s) => s.assignedTheme);
  const customThemes = useThemeStore((s) => s.customThemes);
  const fontSlots = useThemeStore((s) => s.fontSlots);
  const uploadedFonts = useThemeStore((s) => s.uploadedFonts);

  const custom = customThemes.find((t) => t.slug === assigned);
  const isKnown = custom || BUILTIN_THEMES.some((t) => t.slug === assigned);
  const dataTheme = custom ? custom.baseTheme : isKnown ? assigned : DEFAULT_THEME;

  return (
    <div
      data-theme={dataTheme}
      data-custom-theme={custom?.slug}
      style={fontSlotStyle(fontSlots, uploadedFonts)}
      className="flex min-h-screen justify-center bg-canvas text-fg"
    >
      <ThemeRuntimeStyles />
      <div className="flex min-h-screen w-full max-w-[430px] flex-col bg-surface shadow-raised">
        {children}
      </div>
    </div>
  );
}
