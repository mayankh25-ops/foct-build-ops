import type { Metadata } from "next";
import { DesignPreview } from "./preview";

export const metadata: Metadata = {
  title: "Design preview — FOCT BuildingOps",
};

export default function DesignPreviewPage() {
  return <DesignPreview />;
}
