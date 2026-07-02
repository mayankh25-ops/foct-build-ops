import Link from "next/link";
import { ArrowRight } from "lucide-react";

const links = [
  { href: "/dashboard", label: "CleaningOps dashboard", note: "Operational overview for Aurora on Collins" },
  { href: "/roster", label: "Roster", note: "Day, week and timeline views with live status" },
  { href: "/timesheets", label: "Timesheets", note: "Variance, approvals and supervisor notes" },
  { href: "/consumables", label: "Consumables", note: "Approval queue and stock levels" },
  { href: "/modules", label: "Module access", note: "Enabled, locked and coming-soon modules" },
  { href: "/kiosk", label: "Check-in kiosk", note: "Full-screen cleaner check-in (Ink theme)" },
  { href: "/design-preview", label: "Design system preview", note: "Every component in every theme" },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <p className="text-body-sm font-medium text-accent-text">FOCT BuildingOps</p>
      <h1 className="mt-2 text-display text-fg">Premium Operations UI</h1>
      <p className="mt-3 text-body text-fg-secondary">
        Stage 1.5 design review build. Everything below renders from the Aurora on Collins demo
        dataset — no backend yet.
      </p>
      <ul className="mt-10 flex flex-col gap-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="group flex items-center gap-4 rounded-card border border-edge bg-surface px-6 py-5 shadow-card transition-shadow hover:shadow-raised"
            >
              <span className="flex-1">
                <span className="block text-title-3 text-fg">{l.label}</span>
                <span className="mt-0.5 block text-body-sm text-fg-muted">{l.note}</span>
              </span>
              <ArrowRight
                aria-hidden
                className="size-4 text-fg-muted transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
