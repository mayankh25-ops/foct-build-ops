/**
 * Theme Builder derivation + validation.
 * An admin authors 8 colours; everything else the token system needs is
 * derived here (subtles, hovers, borders, sidebar family, chart family),
 * then validated against the SAME pair list as the build gate
 * (src/lib/wcag-pairs.js). This file generates theme DATA — it is exempt
 * from the no-raw-colours component rule, like tokens.css itself.
 */
import { AA_NON_TEXT, AA_TEXT, contrast, luminance } from "@/lib/wcag";
import { PAIRS, type ContrastPair } from "@/lib/wcag-pairs";
import builtinTokens from "@/lib/theme-tokens.json";

/** The 8 tokens an admin edits directly (owner-approved scope). */
export const AUTHORED_TOKENS = [
  { key: "bg-canvas", label: "Canvas", hint: "Page background" },
  { key: "bg-surface", label: "Surface", hint: "Cards and panels" },
  { key: "text-primary", label: "Text · primary", hint: "Headings and body" },
  { key: "text-secondary", label: "Text · secondary", hint: "Supporting copy" },
  { key: "accent", label: "Accent", hint: "Buttons, links, active states" },
  { key: "success", label: "Success", hint: "Positive status" },
  { key: "warning", label: "Warning", hint: "Attention status" },
  { key: "critical", label: "Critical", hint: "Alerts and destructive" },
] as const;

export type AuthoredKey = (typeof AUTHORED_TOKENS)[number]["key"];
export type Authored = Record<AuthoredKey, string>;
export type TokenMap = Record<string, string>;

export const BUILTIN_TOKENS: Record<string, TokenMap> = builtinTokens;

// ---- colour helpers -------------------------------------------------------

function clamp255(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function toHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((c) => clamp255(c).toString(16).padStart(2, "0")).join("")}`;
}

function parse(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** Linear mix of two hexes: t=0 → a, t=1 → b. */
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  return toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

const WHITE = "#ffffff";
const BLACK = "#0a0a0a";

/**
 * Nudge `color` toward black or white (whichever increases contrast against
 * every bg) until it clears `min` against all of them. Preserves hue family.
 */
function ensureContrast(color: string, bgs: string[], min: number): string {
  const passes = (c: string) => bgs.every((bg) => contrast(c, bg) >= min);
  if (passes(color)) return color;
  const avgBgLum = bgs.reduce((s, b) => s + luminance(b), 0) / bgs.length;
  const toward = avgBgLum > 0.35 ? BLACK : WHITE;
  let c = color;
  for (let i = 0; i < 30 && !passes(c); i++) c = mixHex(c, toward, 0.06);
  return c;
}

/** White or near-black text on a solid fill — whichever contrasts harder. */
function onColor(fill: string): string {
  return contrast(WHITE, fill) >= contrast(BLACK, fill) ? WHITE : BLACK;
}

// ---- derivation -------------------------------------------------------------

/**
 * Full token map from 8 authored colours. The 8 AUTHORED values are respected
 * verbatim — the validator warns if they fail AA (owner spec: validate and
 * warn, never silently repaint the admin's choices). Only DERIVED tokens
 * (muted text, subtles, borders, link tints…) are contrast-nudged. Families
 * the admin doesn't author (info, overlay) inherit from the base theme.
 */
export function deriveTokens(authored: Authored, baseTheme: string): TokenMap {
  const base = BUILTIN_TOKENS[baseTheme] ?? BUILTIN_TOKENS.graphite ?? {};
  const canvas = authored["bg-canvas"];
  const surface = authored["bg-surface"];
  const dark = luminance(canvas) < 0.3;
  const textPrimary = authored["text-primary"];
  const textSecondary = authored["text-secondary"];

  const hover = mixHex(surface, dark ? WHITE : textPrimary, dark ? 0.08 : 0.05);
  const textMuted = ensureContrast(
    mixHex(textSecondary, canvas, 0.15),
    [canvas, surface, hover],
    AA_TEXT
  );

  const accent = authored.accent;
  const accentHover = mixHex(accent, dark ? WHITE : BLACK, 0.12);
  const accentSubtle = mixHex(accent, surface, dark ? 0.78 : 0.88);
  const accentText = ensureContrast(accent, [canvas, surface, accentSubtle], AA_TEXT);
  const onAccent = ensureContrast(onColor(accent), [accent, accentHover], AA_TEXT);

  const status = (color: string) => {
    const subtle = mixHex(color, surface, dark ? 0.8 : 0.88);
    const text = ensureContrast(color, [surface, subtle], AA_TEXT);
    return { color, subtle, text };
  };
  const success = status(authored.success);
  const warning = status(authored.warning);
  const critical = status(authored.critical);

  const borderSubtle = mixHex(canvas, textPrimary, dark ? 0.16 : 0.12);
  const borderStrong = ensureContrast(
    mixHex(canvas, textPrimary, 0.4),
    [canvas, surface],
    AA_NON_TEXT
  );
  const focusRing = ensureContrast(accent, [canvas, surface], AA_NON_TEXT);

  return {
    ...base, // info family, overlay, anything not re-derived
    "bg-canvas": canvas,
    "bg-surface": surface,
    "bg-raised": surface,
    "bg-hover": hover,
    "border-subtle": borderSubtle,
    "border-strong": borderStrong,
    "card-border": borderSubtle,
    "text-primary": textPrimary,
    "text-secondary": textSecondary,
    "text-muted": textMuted,
    "text-disabled": mixHex(textMuted, canvas, 0.45),
    "text-on-accent": onAccent,
    accent,
    "accent-hover": accentHover,
    "accent-subtle": accentSubtle,
    "accent-text": accentText,
    brand: accent,
    success: success.color,
    "success-subtle": success.subtle,
    "success-text": success.text,
    warning: warning.color,
    "warning-subtle": warning.subtle,
    "warning-text": warning.text,
    critical: authored.critical,
    "critical-hover": mixHex(authored.critical, dark ? WHITE : BLACK, 0.12),
    "critical-subtle": critical.subtle,
    "critical-text": critical.text,
    "focus-ring": focusRing,
    "sidebar-bg": dark ? mixHex(canvas, WHITE, 0.03) : surface,
    "sidebar-hover": hover,
    "sidebar-fg": textSecondary,
    "sidebar-muted": textMuted,
    "sidebar-active": accentText,
    "sidebar-active-bg": accentSubtle,
    "sidebar-active-fg": accentText,
    "sidebar-border": borderSubtle,
    "chart-1": accent,
    "chart-2": warning.color,
    "chart-3": hover,
  };
}

// ---- validation -------------------------------------------------------------

export interface PairResult extends ContrastPair {
  fgHex: string;
  bgHex: string;
  ratio: number;
  pass: boolean;
}

/** Validate a full token map against the build gate's own pair list. */
export function validateTokens(tokens: TokenMap): PairResult[] {
  return PAIRS.filter((p) => tokens[p.fg] && tokens[p.bg]).map((p) => {
    const fgHex = tokens[p.fg]!;
    const bgHex = tokens[p.bg]!;
    const ratio = contrast(fgHex, bgHex);
    return { ...p, fgHex, bgHex, ratio, pass: ratio >= p.min };
  });
}

/** Neutral placeholder shown while a hex field is invalid (UI-side fallback). */
export const FALLBACK_HEX = "#888888";

export function slugify(name: string): string {
  return (
    "custom-" +
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
  );
}
