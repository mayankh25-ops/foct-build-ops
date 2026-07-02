import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FOCT BuildingOps",
  description: "Building operations platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // data-theme selects a token set (see app/globals.css and design/tokens.md).
  // Per-building theme assignment replaces this hardcoded default in a later stage.
  return (
    <html lang="en" data-theme="graphite" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
