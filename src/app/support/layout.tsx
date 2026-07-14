import type { Metadata } from "next";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = { title: "Support — FOCT BuildingOps" };

/**
 * Service Desk MOBILE surface (owner's "Building Support Tickets" design,
 * docs/DECISIONS.md 2026-07-07). Same module + same ticket store as
 * /service-desk — this is the phone-first presentation with its own theme,
 * like the kiosk. Renders as a phone column centred on desktop.
 */
export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="support" className="flex min-h-screen justify-center bg-canvas text-fg">
      <div className="flex min-h-screen w-full max-w-[430px] flex-col bg-surface shadow-raised">
        <ToastProvider>{children}</ToastProvider>
      </div>
    </div>
  );
}
