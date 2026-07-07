/**
 * Built-in theme + font registries for the Theme Builder UI.
 * Slugs/names mirror src/styles/tokens.css exactly — values live there
 * (and in theme-tokens.json for duplication baselines), never here.
 */

export interface BuiltinTheme {
  slug: string;
  name: string;
  tagline: string;
  kind: "permanent" | "finalist" | "review";
  dark?: boolean;
}

export const BUILTIN_THEMES: BuiltinTheme[] = [
  { slug: "graphite", name: "Graphite", tagline: "Cool neutrals, ink buttons, teal signals", kind: "permanent" },
  { slug: "harbour", name: "Harbour", tagline: "Ink-navy text, deep FOCT teal", kind: "permanent" },
  { slug: "eucalypt", name: "Eucalypt", tagline: "Warm neutrals, muted green — ESG clients", kind: "permanent" },
  { slug: "sandstone", name: "Sandstone", tagline: "Warm stone, restrained bronze — heritage strata", kind: "permanent" },
  { slug: "ink", name: "Ink", tagline: "The dark theme — night concierge and kiosks", kind: "permanent", dark: true },
  { slug: "option-nature", name: "Nature", tagline: "Finalist — cream, sage, borderless soft tiles", kind: "finalist" },
  { slug: "option-glass", name: "Glass", tagline: "Finalist — violet mesh, real frosted layers", kind: "finalist", dark: true },
  { slug: "option-sunset", name: "Sunset", tagline: "Review default — cream, plum ink, burnt orange", kind: "review" },
  { slug: "option-analytics", name: "Analytics", tagline: "Blue-grey neutrals, data green", kind: "review" },
  { slug: "option-blush", name: "Blush", tagline: "Ivory, green ink, soft pink wells", kind: "review" },
  { slug: "option-slate", name: "Slate", tagline: "Professional blue-grey, brick accents", kind: "review" },
  { slug: "option-violet", name: "Violet", tagline: "Lilac canvas, deep violet", kind: "review" },
  { slug: "option-nightfall", name: "Nightfall", tagline: "Navy ink, sky wells", kind: "review" },
  { slug: "option-garden", name: "Garden", tagline: "Warm paper, leaf green", kind: "review" },
  { slug: "option-cyber", name: "Cyber", tagline: "Near-black, neon cyan, mono display voice", kind: "review", dark: true },
];

export const themeKindLabel: Record<BuiltinTheme["kind"], { label: string; tone: "accent" | "success" | "neutral" }> = {
  permanent: { label: "Built-in", tone: "neutral" },
  finalist: { label: "Finalist", tone: "success" },
  review: { label: "Review variant", tone: "neutral" },
};

/**
 * Font slots — every option is from the owner-approved library (CLAUDE.md →
 * Typography) AND vendored in src/fonts (loaded in layout.tsx; the alternates
 * load with preload:false so they only download when a theme uses them).
 * Stacks reference the next/font CSS variables.
 */
export interface FontOption {
  id: string;
  name: string;
  stack: string;
  slots: Array<"display" | "body" | "mono">;
}

export const FONT_OPTIONS: FontOption[] = [
  {
    id: "bricolage",
    name: "Bricolage Grotesque",
    stack: 'var(--font-bricolage), "Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif',
    slots: ["display"],
  },
  {
    id: "onest",
    name: "Onest",
    stack: "var(--font-onest), Onest, ui-sans-serif, system-ui, sans-serif",
    slots: ["display", "body"],
  },
  {
    id: "mona-sans",
    name: "Mona Sans",
    stack: 'var(--font-mona-sans), "Mona Sans", ui-sans-serif, system-ui, sans-serif',
    slots: ["display", "body"],
  },
  {
    id: "dm-sans",
    name: "DM Sans",
    stack: 'var(--font-dm-sans), "DM Sans", ui-sans-serif, system-ui, sans-serif',
    slots: ["display", "body"],
  },
  {
    id: "inter",
    name: "Inter",
    stack: "var(--font-inter), Inter, ui-sans-serif, system-ui, sans-serif",
    slots: ["display", "body"],
  },
  {
    id: "roboto",
    name: "Roboto",
    stack: "var(--font-roboto), Roboto, ui-sans-serif, system-ui, sans-serif",
    slots: ["display", "body"],
  },
  {
    id: "roboto-mono",
    name: "Roboto Mono",
    stack: 'var(--font-roboto-mono), "SF Mono", ui-monospace, "Roboto Mono", monospace',
    slots: ["mono", "display"],
  },
];

export const DEFAULT_SLOTS = { display: "bricolage", body: "onest", mono: "roboto-mono" } as const;
