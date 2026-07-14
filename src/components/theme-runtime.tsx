"use client";

import * as React from "react";
import { FONT_OPTIONS } from "@/lib/theme-registry";
import { useThemeStore, type FontSlots, type UploadedFont } from "@/lib/theme-store";

/**
 * Runtime CSS for the Theme Builder:
 * - each custom theme becomes a `[data-custom-theme="<slug>"]` rule overriding
 *   colour vars. The shell keeps `data-theme={baseTheme}` alongside it, so a
 *   custom theme inherits its base's radius, font voice, and scoped
 *   decorations (glass mesh, cyber aurora) while recolouring everything.
 * - each uploaded woff2 becomes an @font-face usable in the font slots.
 * Values are store-validated (hex tokens, slugified names) before they land here.
 */
export function ThemeRuntimeStyles() {
  const customThemes = useThemeStore((s) => s.customThemes);
  const uploadedFonts = useThemeStore((s) => s.uploadedFonts);

  const css = React.useMemo(() => {
    const themeBlocks = customThemes
      .map((t) => {
        const vars = Object.entries(t.tokens)
          .map(([k, v]) => `--${k}: ${v};`)
          .join(" ");
        return `[data-custom-theme="${t.slug}"] { ${vars} }`;
      })
      .join("\n");
    const fontFaces = uploadedFonts
      .map(
        (f) =>
          `@font-face { font-family: "${uploadFamily(f.id)}"; src: url(${f.dataUrl}) format("woff2"); font-display: swap; }`
      )
      .join("\n");
    return `${fontFaces}\n${themeBlocks}`;
  }, [customThemes, uploadedFonts]);

  return <style data-theme-runtime dangerouslySetInnerHTML={{ __html: css }} />;
}

export function uploadFamily(fontId: string) {
  return `FOCT Upload ${fontId}`;
}

/** CSS stack for a slot value (built-in font id or uploaded font id). */
export function resolveFontStack(id: string | undefined, uploads: UploadedFont[]): string | undefined {
  if (!id) return undefined;
  const builtin = FONT_OPTIONS.find((f) => f.id === id);
  if (builtin) return builtin.stack;
  const upload = uploads.find((u) => u.id === id);
  if (upload) return `"${uploadFamily(upload.id)}", ui-sans-serif, system-ui, sans-serif`;
  return undefined;
}

/** Inline style overriding the per-theme font stacks from slot selections. */
export function fontSlotStyle(slots: FontSlots, uploads: UploadedFont[]): React.CSSProperties {
  const style: Record<string, string> = {};
  const display = resolveFontStack(slots.display, uploads);
  const body = resolveFontStack(slots.body, uploads);
  const mono = resolveFontStack(slots.mono, uploads);
  if (display) style["--font-stack-display"] = display;
  if (body) style["--font-stack-body"] = body;
  if (mono) style["--font-stack-mono"] = mono;
  return style as React.CSSProperties;
}
