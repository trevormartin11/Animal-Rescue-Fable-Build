import Link from "next/link";
import type { CaseStatus } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/types";

const STATUS_STYLES: Record<CaseStatus, string> = {
  new: "bg-accent-soft text-accent-deep",
  accepted: "bg-biscuit-soft text-[#8a6a2f]",
  owner_contacted: "bg-sky-soft text-sky",
  vet_account_set: "bg-sky-soft text-sky",
  paid: "bg-leaf-soft text-leaf",
  closed: "bg-line/60 text-ink-soft",
  denied: "bg-denied-soft text-denied",
};

export function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-surface border border-line rounded-2xl shadow-card ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  action,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
      <h2 className="text-base font-semibold">{title}</h2>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="px-5 py-4">
      <div className="text-[13px] font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-3xl font-bold font-display">{value}</div>
      {sub ? <div className="mt-0.5 text-sm text-ink-soft">{sub}</div> : null}
    </Card>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-6 py-10 text-center">
      <p className="font-semibold text-ink-soft">{title}</p>
      {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  sub,
  action,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-3xl font-semibold">{title}</h1>
        {sub ? <p className="mt-1 text-ink-soft">{sub}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const styles =
    variant === "primary"
      ? "bg-accent text-white hover:bg-accent-deep"
      : "bg-surface border border-line text-ink hover:bg-accent-soft/50";
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors ${styles}`}
    >
      {children}
    </Link>
  );
}
