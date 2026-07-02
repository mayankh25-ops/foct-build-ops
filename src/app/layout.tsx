import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import localFont from "next/font/local";
import "./globals.css";

/*
 * Body/UI: Hanken Grotesk (variable, self-hosted).
 * Display: General Sans via @font-face in globals.css (drop-in files),
 *          with self-hosted Inter as the loaded fallback.
 * Numerics/tabular: Geist Mono (Vercel's package bundles the woff2 locally).
 */
const hanken = localFont({
  src: [
    {
      path: "../fonts/hanken-grotesk/hanken-grotesk-latin-wght-normal.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "../fonts/hanken-grotesk/hanken-grotesk-latin-wght-italic.woff2",
      weight: "100 900",
      style: "italic",
    },
  ],
  variable: "--font-hanken",
  display: "swap",
});

const inter = localFont({
  src: [
    {
      path: "../fonts/inter/inter-latin-opsz-normal.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  variable: "--font-inter",
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
      className={`${hanken.variable} ${inter.variable} ${GeistMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
