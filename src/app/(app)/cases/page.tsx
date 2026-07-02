import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { formatMoney, formatDate } from "@/lib/format";
import { assignReceiptToCase } from "@/app/actions/receipts";
import { SubmitButton } from "@/components/SubmitButton";
import { ACTIVE_STATUSES, type CaseStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const FILTERS: { key: string; label: string; statuses: CaseStatus[] | null }[] = [
  { key: "open", label: "Open", statuses: ACTIVE_STATUSES },
  { key: "all", label: "All", statuses: null },
  { key: "closed", label: "Closed", statuses: ["closed"] },
  { key: "denied", label: "Denied", statuses: ["denied"] },
];

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; assign?: string }>;
}) {
  const { filter = "open", assign } = await searchParams;
  const activeFilter = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];

  const supabase = await createClient();
  let query = supabase
    .from("biscuit_cases")
    .select("id, animal_name, species, breed, situation, amount, status, requested_at, owners:biscuit_owners(name)")
    .order("requested_at", { ascending: false });
  if (activeFilter.statuses) query = query.in("status", activeFilter.statuses);
  const { data: cases } = await query;

  // When arriving via "receipt needs a case", show the assignment banner
  let assigningReceipt: { id: string; label: string } | null = null;
  if (assign) {
    const { data: r } = await supabase
      .from("biscuit_receipts")
      .select("id, email_subject, filename, email_from")
      .eq("id", assign)
      .is("case_id", null)
      .maybeSingle();
    if (r) {
      assigningReceipt = {
        id: r.id,
        label: r.email_subject || r.filename || r.email_from || "Receipt",
      };
    }
  }

  return (
    <div>
      <PageHeader
        title="Cases"
        sub="Every request PACC 911 has sent our way"
        action={
          <Link
            href="/cases/new"
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-deep transition-colors"
          >
            <Plus size={16} /> New case
          </Link>
        }
      />

      {assigningReceipt && (
        <Card className="mb-4 border-biscuit bg-biscuit-soft/60">
          <div className="px-5 py-3.5 text-sm font-semibold text-[#7a5a1f]">
            Assigning receipt “{assigningReceipt.label}” — pick its case below.
          </div>
        </Card>
      )}

      <div className="flex gap-1.5 mb-4 overflow-x-auto">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/cases?filter=${f.key}${assign ? `&assign=${assign}` : ""}`}
            className={`rounded-full px-4 py-1.5 text-sm font-bold whitespace-nowrap transition-colors ${
              f.key === activeFilter.key
                ? "bg-ink text-cream"
                : "bg-surface border border-line text-ink-soft hover:bg-accent-soft/50"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <Card>
        {!cases?.length ? (
          <EmptyState
            title={activeFilter.key === "open" ? "No open cases" : "No cases here"}
            hint="New PACC 911 emails become cases automatically once the inbox is connected."
          />
        ) : (
          <ul className="divide-y divide-line">
            {cases.map((c) => {
              const owner = Array.isArray(c.owners) ? c.owners[0] : c.owners;
              return (
                <li key={c.id} className="relative">
                  <Link
                    href={`/cases/${c.id}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-accent-soft/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold">{c.animal_name ?? "Unnamed"}</span>
                        {c.species ? (
                          <span className="text-sm text-ink-soft">
                            {[c.breed, c.species].filter(Boolean).join(" ")}
                          </span>
                        ) : null}
                        <StatusBadge status={c.status as CaseStatus} />
                      </div>
                      <div className="mt-0.5 text-sm text-ink-soft truncate">
                        {owner?.name ? `${owner.name} · ` : ""}
                        {c.situation ?? ""}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold">
                        {formatMoney(c.amount != null ? Number(c.amount) : null)}
                      </div>
                      <div className="text-xs text-muted">{formatDate(c.requested_at)}</div>
                    </div>
                  </Link>
                  {assigningReceipt && (
                    <form
                      action={assignReceiptToCase.bind(null, assigningReceipt.id)}
                      className="absolute right-4 top-1/2 -translate-y-1/2"
                    >
                      <input type="hidden" name="case_id" value={c.id} />
                      <SubmitButton variant="secondary" pendingText="Assigning…">
                        Assign here
                      </SubmitButton>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
