import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

/*
 * Roboto family throughout (owner direction 2026-07-03):
 * - Roboto variable (100–900): display AND body — weight carries hierarchy
 *   (light display numerals, regular body, medium labels/buttons).
 * - Roboto Mono variable: numerics, timestamps, IDs; "SF Mono" sits in the
 *   fallback stack for Apple devices (SF Mono itself is not redistributable).
 */
const roboto = localFont({
  src: [
    {
      path: "../fonts/roboto/roboto-latin-wght-normal.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "../fonts/roboto/roboto-latin-wght-italic.woff2",
      weight: "100 900",
      style: "italic",
    },
  ],
  variable: "--font-roboto",
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
      className={`${roboto.variable} ${robotoMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
