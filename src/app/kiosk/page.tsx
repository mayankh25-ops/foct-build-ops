import type { Metadata } from "next";
import { KioskScreen } from "./kiosk-screen";

export const metadata: Metadata = { title: "Check-in kiosk — Aurora on Collins" };

export default function KioskPage() {
  return <KioskScreen />;
}
