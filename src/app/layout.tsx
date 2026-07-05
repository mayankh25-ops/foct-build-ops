import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

/*
 * Owner-approved font library (see CLAUDE.md → Typography). Shipping trio:
 * - Mona Sans (variable): headings + BIG NUMBERS — big data gets big & thick.
 * - DM Sans (variable): body/UI — clean with character, 1.4–1.6 line height.
 * - Roboto Mono (variable): timestamps, IDs, table figures; "SF Mono" next
 *   in the stack for Apple devices (SF Mono is not redistributable).
 */
const monaSans = localFont({
  src: [
    {
      path: "../fonts/mona-sans/mona-sans-latin-wght-normal.woff2",
      weight: "200 900",
      style: "normal",
    },
  ],
  variable: "--font-mona",
  display: "swap",
});

const dmSans = localFont({
  src: [
    {
      path: "../fonts/dm-sans/dm-sans-latin-wght-normal.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "../fonts/dm-sans/dm-sans-latin-wght-italic.woff2",
      weight: "100 900",
      style: "italic",
    },
  ],
  variable: "--font-dm",
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
      data-theme="graphite"
      suppressHydrationWarning
      className={`${monaSans.variable} ${dmSans.variable} ${robotoMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
