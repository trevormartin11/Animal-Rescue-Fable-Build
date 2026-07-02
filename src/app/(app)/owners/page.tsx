import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OwnersPage() {
  const supabase = await createClient();
  const { data: owners } = await supabase
    .from("biscuit_owners")
    .select("id, name, email, phone, cases:biscuit_cases(id, animal_name, amount, status)")
    .order("created_at", { ascending: false });

  const rows = (owners ?? []).map((o) => {
    const cases = o.cases ?? [];
    const given = cases
      .filter((c) => ["paid", "closed"].includes(c.status))
      .reduce((s, c) => s + Number(c.amount ?? 0), 0);
    const animals = [...new Set(cases.map((c) => c.animal_name).filter(Boolean))];
    return { ...o, caseCount: cases.length, given, animals };
  });

  return (
    <div>
      <PageHeader title="Owners" sub="The people (and pets) we've helped" />
      <Card>
        {rows.length === 0 ? (
          <EmptyState title="No owners yet" hint="Owners are created automatically from PACC 911 requests." />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/owners/${o.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-accent-soft/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">{o.name}</div>
                    <div className="mt-0.5 text-sm text-ink-soft truncate">
                      {o.animals.length ? o.animals.join(", ") : "No animals recorded"}
                      {o.email ? ` · ${o.email}` : ""}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold">{formatMoney(o.given)}</div>
                    <div className="text-xs text-muted">
                      {o.caseCount} {o.caseCount === 1 ? "case" : "cases"}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
