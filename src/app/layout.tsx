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
      data-theme="option-sunset"
      suppressHydrationWarning
      className={`${bricolage.variable} ${onest.variable} ${robotoMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
