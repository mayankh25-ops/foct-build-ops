import type { Metadata } from "next";
import { ToastProvider } from "@/components/ui/toast";
import { SupportThemeShell } from "./support-theme";

export const metadata: Metadata = { title: "Support — FOCT BuildingOps" };

/**
 * Service Desk MOBILE surface — same module + ticket store as /service-desk,
 * phone-first presentation. Colours follow the PORTAL's active theme (owner
 * direction 2026-07-15; previously pinned to the red `support` theme).
 */
export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return (
    <SupportThemeShell>
      <ToastProvider>{children}</ToastProvider>
    </SupportThemeShell>
  );
}
