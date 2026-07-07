"use client";

import * as React from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Palette,
  Pencil,
  Trash2,
  Type,
  Upload,
} from "lucide-react";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { fontSlotStyle, resolveFontStack } from "@/components/theme-runtime";
import {
  AUTHORED_TOKENS,
  BUILTIN_TOKENS,
  deriveTokens,
  FALLBACK_HEX,
  slugify,
  validateTokens,
  type Authored,
  type PairResult,
} from "@/lib/theme-builder";
import { BUILTIN_THEMES, DEFAULT_SLOTS, FONT_OPTIONS, themeKindLabel } from "@/lib/theme-registry";
import { useThemeRehydrate, useThemeStore, type CustomTheme } from "@/lib/theme-store";
import { isValidHex } from "@/lib/wcag";
import { building } from "@/lib/demo-data";
import { cn } from "@/lib/cn";

/* ---------------------------------------------------------------- */
/* Mini theme preview — a real themed subtree, not a mock image      */
/* ---------------------------------------------------------------- */

function ThemeMini({
  dataTheme,
  customSlug,
  styleVars,
}: {
  dataTheme: string;
  customSlug?: string;
  styleVars?: React.CSSProperties;
}) {
  return (
    <div
      data-theme={dataTheme}
      data-custom-theme={customSlug}
      style={styleVars}
      aria-hidden
      className="pointer-events-none rounded-sm bg-canvas p-3 text-fg"
    >
      <div className="rounded-card border border-cardline bg-surface p-3 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <p className="font-display text-body-sm font-bold">Aurora on Collins</p>
          <span className="rounded-pill bg-accent px-2 py-0.5 text-caption font-medium text-on-accent">
            Action
          </span>
        </div>
        <p className="mt-1 text-caption text-fg-secondary">Shifts today · 6 rostered</p>
        <p className="text-caption text-accent-text">Open roster →</p>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="size-2 rounded-pill bg-success" />
          <span className="size-2 rounded-pill bg-warning" />
          <span className="size-2 rounded-pill bg-critical" />
          <span className="ml-auto rounded-pill bg-accent-subtle px-1.5 py-0.5 text-[10px] font-medium text-accent-text">
            Pill
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Creator / editor                                                  */
/* ---------------------------------------------------------------- */

interface Draft {
  id?: string;
  name: string;
  baseTheme: string;
  authored: Authored;
}

function draftFrom(baseSlug: string, existing?: CustomTheme): Draft {
  if (existing) {
    return {
      id: existing.id,
      name: existing.name,
      baseTheme: existing.baseTheme,
      authored: { ...existing.authored },
    };
  }
  const base = BUILTIN_TOKENS[baseSlug] ?? {};
  const baseName = BUILTIN_THEMES.find((t) => t.slug === baseSlug)?.name ?? baseSlug;
  const authored = Object.fromEntries(
    AUTHORED_TOKENS.map(({ key }) => [key, base[key] ?? FALLBACK_HEX])
  ) as Authored;
  return { name: `${baseName} copy`, baseTheme: baseSlug, authored };
}

function ColorField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const valid = isValidHex(value);
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        aria-label={`${label} colour picker`}
        value={valid ? (value.startsWith("#") ? value : `#${value}`) : FALLBACK_HEX}
        onChange={(e) => onChange(e.target.value)}
        className="size-9 shrink-0 cursor-pointer rounded-sm border border-edge bg-surface p-0.5"
      />
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-medium text-fg">{label}</p>
        <p className="truncate text-caption text-fg-muted">{hint}</p>
      </div>
      <div className="w-28 shrink-0">
        <Input
          aria-label={`${label} hex value`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          error={valid ? undefined : "Invalid hex"}
          className="h-9 font-mono text-body-sm"
        />
      </div>
    </div>
  );
}

function ThemeEditor({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const { toast } = useToast();
  const saveCustomTheme = useThemeStore((s) => s.saveCustomTheme);
  const [name, setName] = React.useState(draft.name);
  const [authored, setAuthored] = React.useState<Authored>(draft.authored);
  const [warnOpen, setWarnOpen] = React.useState(false);

  const allValid = Object.values(authored).every((v) => isValidHex(v));
  const tokens = React.useMemo(
    () => (allValid ? deriveTokens(authored, draft.baseTheme) : null),
    [authored, draft.baseTheme, allValid]
  );
  const results: PairResult[] = React.useMemo(
    () => (tokens ? validateTokens(tokens) : []),
    [tokens]
  );
  const failures = results.filter((r) => !r.pass);

  const previewVars = React.useMemo(() => {
    if (!tokens) return undefined;
    return Object.fromEntries(
      Object.entries(tokens).map(([k, v]) => [`--${k}`, v])
    ) as React.CSSProperties;
  }, [tokens]);

  const doSave = () => {
    if (!tokens) return;
    saveCustomTheme({
      id: draft.id,
      name: name.trim() || "Untitled theme",
      slug: slugify(name.trim() || "untitled"),
      baseTheme: draft.baseTheme,
      tokens,
      authored,
    });
    toast({
      tone: failures.length ? "warning" : "success",
      title: `Theme "${name.trim() || "Untitled theme"}" saved`,
      description: failures.length
        ? `Saved with ${failures.length} contrast warning${failures.length === 1 ? "" : "s"}`
        : "All contrast pairs meet WCAG AA",
    });
    setWarnOpen(false);
    onClose();
  };

  return (
    <Card className="mt-6">
      <CardBody className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 max-w-md flex-1">
            <Input label="Theme name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <p className="text-body-sm text-fg-muted">
            Based on{" "}
            <span className="font-medium text-fg">
              {BUILTIN_THEMES.find((t) => t.slug === draft.baseTheme)?.name ?? draft.baseTheme}
            </span>{" "}
            — inherits its shape, type voice and decorations; you recolour it.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            {AUTHORED_TOKENS.map(({ key, label, hint }) => (
              <ColorField
                key={key}
                label={label}
                hint={hint}
                value={authored[key]}
                onChange={(v) => setAuthored((a) => ({ ...a, [key]: v }))}
              />
            ))}
            <p className="text-caption text-fg-muted">
              Hover states, tints, borders, sidebar and chart colours are derived automatically and
              nudged to meet contrast where possible.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <p className="pb-2 text-caption font-medium tracking-[0.06em] text-fg-muted uppercase">
                Live preview
              </p>
              {tokens ? (
                <ThemeMini dataTheme={draft.baseTheme} styleVars={previewVars} />
              ) : (
                <p className="text-body-sm text-critical-text">Fix the invalid hex values to preview.</p>
              )}
            </div>

            <div>
              <p className="pb-2 text-caption font-medium tracking-[0.06em] text-fg-muted uppercase">
                WCAG AA check · {results.length} pairs
              </p>
              {failures.length === 0 ? (
                <div className="flex items-center gap-2 rounded-card bg-success-subtle px-3.5 py-2.5">
                  <CheckCircle2 aria-hidden className="size-4 shrink-0 text-success-text" />
                  <p className="text-body-sm text-success-text">
                    All {results.length} contrast pairs pass — same standard as the built-ins.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 rounded-card bg-warning-subtle px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle aria-hidden className="size-4 shrink-0 text-warning-text" />
                    <p className="text-body-sm font-medium text-warning-text">
                      {failures.length} pair{failures.length === 1 ? "" : "s"} below AA
                    </p>
                  </div>
                  <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                    {failures.map((f, i) => (
                      <li key={i} className="text-caption text-warning-text">
                        {f.use}: <span className="font-mono">{f.fgHex}</span> on{" "}
                        <span className="font-mono">{f.bgHex}</span> ={" "}
                        <span className="font-mono">{f.ratio.toFixed(2)}:1</span> (needs {f.min}:1)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-edge pt-5">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!tokens}
            onClick={() => (failures.length > 0 ? setWarnOpen(true) : doSave())}
          >
            Save theme
          </Button>
        </div>
      </CardBody>

      <Modal open={warnOpen} onOpenChange={setWarnOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Save with contrast warnings?</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <p className="text-body-sm text-fg-secondary">
              {failures.length} pair{failures.length === 1 ? "" : "s"} sit below WCAG AA. Some text
              may be hard to read for some users. You can save anyway and fix later — the warnings
              stay listed on the theme.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setWarnOpen(false)}>
              Keep editing
            </Button>
            <Button variant="destructive" onClick={doSave}>
              Save anyway
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  );
}

/* ---------------------------------------------------------------- */
/* Themes tab                                                        */
/* ---------------------------------------------------------------- */

function ThemesTab() {
  const { toast } = useToast();
  const assigned = useThemeStore((s) => s.assignedTheme);
  const assignTheme = useThemeStore((s) => s.assignTheme);
  const customThemes = useThemeStore((s) => s.customThemes);
  const deleteCustomTheme = useThemeStore((s) => s.deleteCustomTheme);
  const [draft, setDraft] = React.useState<Draft | null>(null);

  const apply = (slug: string, name: string) => {
    assignTheme(slug);
    toast({ tone: "success", title: `${name} applied`, description: `${building.name} now renders this theme` });
  };

  return (
    <>
      {draft && <ThemeEditor key={draft.id ?? draft.baseTheme + draft.name} draft={draft} onClose={() => setDraft(null)} />}

      <SectionHeader
        className="mt-8"
        title="Built-in themes"
        description="Every theme in the design system, live. Apply one to this building, or duplicate it as the starting point for your own."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {BUILTIN_THEMES.map((t) => {
          const kind = themeKindLabel[t.kind];
          const isApplied = assigned === t.slug;
          return (
            <Card key={t.slug}>
              <CardBody className="flex h-full flex-col gap-3 p-4">
                <ThemeMini dataTheme={t.slug} />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-body font-medium text-fg">{t.name}</p>
                    <p className="text-caption text-fg-muted">{t.tagline}</p>
                  </div>
                  <Badge tone={kind.tone}>{kind.label}</Badge>
                </div>
                <div className="mt-auto flex items-center gap-2">
                  {isApplied ? (
                    <StatusPill tone="success">
                      <Check aria-hidden className="size-3" /> Applied
                    </StatusPill>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-label={`Apply ${t.name}`}
                      onClick={() => apply(t.slug, t.name)}
                    >
                      Apply
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Duplicate ${t.name}`}
                    onClick={() => setDraft(draftFrom(t.slug))}
                  >
                    <Copy aria-hidden /> Duplicate
                  </Button>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <SectionHeader
        className="mt-10"
        title="Custom themes"
        description={`Saved for FOCT Cleaning · ${building.name} — stored alongside the built-ins (themes table at Stage 2).`}
      />
      {customThemes.length === 0 ? (
        <EmptyState
          icon={Palette}
          title="No custom themes yet"
          description="Duplicate any built-in theme above, adjust its colours with live preview, and it will appear here for this building."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {customThemes.map((t) => {
            const isApplied = assigned === t.slug;
            const failures = validateTokens(t.tokens).filter((r) => !r.pass);
            return (
              <Card key={t.id}>
                <CardBody className="flex h-full flex-col gap-3 p-4">
                  <ThemeMini dataTheme={t.baseTheme} customSlug={t.slug} />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-body font-medium text-fg">{t.name}</p>
                      <p className="text-caption text-fg-muted">
                        Based on {BUILTIN_THEMES.find((b) => b.slug === t.baseTheme)?.name ?? t.baseTheme} ·{" "}
                        {t.createdAt}
                      </p>
                    </div>
                    {failures.length > 0 ? (
                      <Badge tone="warning">{failures.length} AA warning{failures.length === 1 ? "" : "s"}</Badge>
                    ) : (
                      <Badge tone="success">AA</Badge>
                    )}
                  </div>
                  <div className="mt-auto flex items-center gap-2">
                    {isApplied ? (
                      <StatusPill tone="success">
                        <Check aria-hidden className="size-3" /> Applied
                      </StatusPill>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label={`Apply ${t.name}`}
                        onClick={() => apply(t.slug, t.name)}
                      >
                        Apply
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Edit ${t.name}`}
                      onClick={() => setDraft(draftFrom(t.baseTheme, t))}
                    >
                      <Pencil aria-hidden /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Delete ${t.name}`}
                      onClick={() => {
                        deleteCustomTheme(t.id);
                        toast({ tone: "neutral", title: `${t.name} deleted` });
                      }}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- */
/* Typography tab                                                    */
/* ---------------------------------------------------------------- */

const SLOT_META = [
  { slot: "display" as const, label: "Display", hint: "Headings and big numbers" },
  { slot: "body" as const, label: "Body", hint: "UI and paragraph text" },
  { slot: "mono" as const, label: "Mono · numeric", hint: "Timestamps, IDs, table figures" },
];

function TypographyTab() {
  const { toast } = useToast();
  const fontSlots = useThemeStore((s) => s.fontSlots);
  const setFontSlots = useThemeStore((s) => s.setFontSlots);
  const uploadedFonts = useThemeStore((s) => s.uploadedFonts);
  const addUploadedFont = useThemeStore((s) => s.addUploadedFont);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const optionsFor = (slot: "display" | "body" | "mono") => [
    ...FONT_OPTIONS.filter((f) => f.slots.includes(slot)).map((f) => ({ value: f.id, label: f.name })),
    ...uploadedFonts.map((u) => ({ value: u.id, label: `${u.name} · uploaded` })),
  ];

  const onUpload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".woff2")) {
      toast({ tone: "critical", title: "Only .woff2 files", description: "Convert the font to woff2 first" });
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(new Error("read failed"));
      r.readAsDataURL(file);
    });
    const font = addUploadedFont(file.name.replace(/\.woff2$/i, ""), dataUrl);
    toast({
      tone: "success",
      title: `${font.name} uploaded`,
      description: `Available in every slot · will store at ${font.storagePath} (Stage 2)`,
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  const previewStyle = fontSlotStyle(fontSlots, uploadedFonts);

  return (
    <>
      <SectionHeader
        className="mt-8"
        title="Font slots"
        description="Owner-approved library only. Changes apply live to this building and save with its theme assignment."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <Card>
          <CardBody className="flex flex-col gap-5">
            {SLOT_META.map(({ slot, label, hint }) => (
              <div key={slot} className="flex flex-col gap-1.5">
                <Select
                  label={label}
                  placeholder={`Default (${FONT_OPTIONS.find((f) => f.id === DEFAULT_SLOTS[slot])?.name})`}
                  options={optionsFor(slot)}
                  value={fontSlots[slot]}
                  onValueChange={(v) => {
                    setFontSlots({ ...fontSlots, [slot]: v });
                    toast({ tone: "success", title: `${label} font updated`, description: "Applied live" });
                  }}
                />
                <p className="text-caption text-fg-muted">{hint}</p>
              </div>
            ))}
            <div className="border-t border-edge pt-4">
              <input
                ref={fileRef}
                type="file"
                accept=".woff2"
                hidden
                onChange={(e) => onUpload(e.target.files)}
              />
              <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload aria-hidden /> Upload custom font (.woff2)
              </Button>
              <p className="mt-2 text-caption text-fg-muted">
                Org-scoped: uploads belong to FOCT Cleaning and store in Supabase Storage at Stage 2.
                Licensing is your responsibility for uploaded fonts.
              </p>
            </div>
            {(fontSlots.display || fontSlots.body || fontSlots.mono) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFontSlots({});
                  toast({ tone: "neutral", title: "Font slots reset to the theme defaults" });
                }}
              >
                Reset to defaults
              </Button>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex flex-col gap-4" style={previewStyle}>
            <p className="text-caption font-medium tracking-[0.06em] text-fg-muted uppercase">
              Live specimen
            </p>
            <p className="font-display text-display text-fg">Aurora on Collins</p>
            <p className="font-display text-title-2 text-fg">
              Cleaning progress <span className="tabular-nums">33%</span> · 6 shifts today
            </p>
            <p className="max-w-xl text-body text-fg-secondary">
              The quick brown fox jumps over the lazy dog — concierge lodged a spillage ticket on
              level 14 and the on-duty cleaner attended within nine minutes.
            </p>
            <p className="font-mono text-body-sm text-fg-secondary">
              SD-AUR-2607-0042 · 07:48 → 08:05 · 17m to resolve
            </p>
            <p className="text-caption text-fg-muted">
              Display · body · mono slots shown with your current selections.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- */

export default function AppearancePage() {
  useThemeRehydrate();
  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Appearance"
        description={`Theme and typography for ${building.name} — every change applies live, no code involved.`}
      />
      <Tabs defaultValue="themes">
        <TabsList>
          <TabsTrigger value="themes">
            <span className="flex items-center gap-2">
              <Palette aria-hidden className="size-4" /> Themes
            </span>
          </TabsTrigger>
          <TabsTrigger value="typography">
            <span className="flex items-center gap-2">
              <Type aria-hidden className="size-4" /> Typography
            </span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="themes">
          <ThemesTab />
        </TabsContent>
        <TabsContent value="typography">
          <TypographyTab />
        </TabsContent>
      </Tabs>
    </>
  );
}
