import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-display text-fg">FOCT BuildingOps</h1>
      <p className="text-body text-fg-secondary">
        Stage 1 — design system. Review the components at{" "}
        <Link href="/design-preview" className="text-accent-text underline underline-offset-4">
          /design-preview
        </Link>
        .
      </p>
    </main>
  );
}
