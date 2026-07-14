/**
 * WCAG 2.1 contrast math — THE single source of truth.
 * Consumed by BOTH scripts/check-contrast.mjs (build gate) and the Theme
 * Builder's live validator (src/app/(app)/settings/appearance), so the two
 * can never disagree. Plain ESM JS so node scripts and Next/TS share it
 * (types in wcag.d.ts).
 */

export function hexToRgb(hex) {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

export function isValidHex(hex) {
  return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex.trim());
}

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Normal text (WCAG 1.4.3). */
export const AA_TEXT = 4.5;
/** UI component boundaries / focus indicators (WCAG 1.4.11). */
export const AA_NON_TEXT = 3.0;
