import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

/*
 * Owner-approved font library (see CLAUDE.md → Typography). Shipping trio:
 * - Bricolage Grotesque (variable, to 800): headings + BIG BOLD NUMBERS —
 *   characterful humanist grotesk, the display voice.
 * - Onest (variable): body/UI — clean and clear (from the owner's Datify
 *   reference), 1.4–1.6 line height.
 * - Roboto Mono: table timestamps/IDs only; "SF Mono" next in the stack
 *   for Apple devices (SF Mono is not redistributable).
 */
const bricolage = localFont({
  src: [
    {
      path: "../fonts/bricolage/bricolage-grotesque-latin-wght-normal.woff2",
      weight: "200 800",
      style: "normal",
    },
  ],
  variable: "--font-bricolage",
  display: "swap",
});

const onest = localFont({
  src: [
    {
      path: "../fonts/onest/onest-latin-wght-normal.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  variable: "--font-onest",
  display: "swap",
});

const robotoMono = localFont({
  src: [
    {
      path: "../fonts/roboto-mono/roboto-mono-latin-wght-normal.woff2",
      weight: "100 700",
      style: "normal",
    },
  ],
  variable: "--font-roboto-mono",
  display: "swap",
});

/* Barlow — DIN-style numerals (Power BI reference, owner direction
   2026-07-07). Big numbers only; UI text is the native system stack. */
const barlow = localFont({
  src: [
    { path: "../fonts/barlow/barlow-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/barlow/barlow-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "../fonts/barlow/barlow-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-barlow",
  display: "swap",
});

/* Approved-library alternates for the Theme Builder's font slots.
   preload:false — they download only when a theme actually selects them. */
const monaSans = localFont({
  src: [{ path: "../fonts/mona-sans/mona-sans-latin-wght-normal.woff2", weight: "200 900", style: "normal" }],
  variable: "--font-mona-sans",
  display: "swap",
  preload: false,
});

const dmSans = localFont({
  src: [{ path: "../fonts/dm-sans/dm-sans-latin-wght-normal.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-dm-sans",
  display: "swap",
  preload: false,
});

const inter = localFont({
  src: [{ path: "../fonts/inter/inter-latin-opsz-normal.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-inter",
  display: "swap",
  preload: false,
});

const roboto = localFont({
  src: [{ path: "../fonts/roboto/roboto-latin-wght-normal.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-roboto",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "FOCT BuildingOps",
  description: "Building operations for premium high-rise buildings.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-AU"
      data-theme="option-nature"
      suppressHydrationWarning
      className={`${barlow.variable} ${bricolage.variable} ${onest.variable} ${robotoMono.variable} ${monaSans.variable} ${dmSans.variable} ${inter.variable} ${roboto.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
