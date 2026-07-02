import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, StatusBadge, StatCard } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { updateOwner } from "@/app/actions/cases";
import { formatMoney, formatDate } from "@/lib/format";
import type { CaseStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OwnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: owner } = await supabase.from("biscuit_owners").select("*").eq("id", id).maybeSingle();
  if (!owner) notFound();

  const { data: cases } = await supabase
    .from("biscuit_cases")
    .select("id, animal_name, species, situation, amount, status, requested_at")
    .eq("owner_id", id)
    .order("requested_at", { ascending: false });

  const allCases = cases ?? [];
  const totalGiven = allCases
    .filter((c) => ["paid", "closed"].includes(c.status))
    .reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const animals = [...new Set(allCases.map((c) => c.animal_name).filter(Boolean))];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold">{owner.name}</h1>
        <div className="mt-1.5 flex flex-wrap gap-4 text-sm text-ink-soft">
          {owner.email && (
            <span className="flex items-center gap-1.5">
              <Mail size={14} className="text-muted" />
              <a href={`mailto:${owner.email}`} className="hover:underline">{owner.email}</a>
            </span>
          )}
          {owner.phone && (
            <span className="flex items-center gap-1.5">
              <Phone size={14} className="text-muted" />
              <a href={`tel:${owner.phone}`} className="hover:underline">{owner.phone}</a>
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total given" value={formatMoney(totalGiven)} />
        <StatCard label="Cases" value={String(allCases.length)} />
        <StatCard label="Animals" value={String(animals.length)} sub={animals.join(", ") || undefined} />
      </div>

      <Card>
        <CardHeader title="Cases" />
        <ul className="divide-y divide-line">
          {allCases.map((c) => (
            <li key={c.id}>
              <Link
                href={`/cases/${c.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-accent-soft/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold">{c.animal_name ?? "Unnamed"}</span>
                    {c.species ? <span className="text-sm text-ink-soft">{c.species}</span> : null}
                    <StatusBadge status={c.status as CaseStatus} />
                  </div>
                  <div className="mt-0.5 text-sm text-ink-soft truncate">{c.situation}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold">{formatMoney(c.amount != null ? Number(c.amount) : null)}</div>
                  <div className="text-xs text-muted">{formatDate(c.requested_at)}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader title="Edit owner" />
        <form action={updateOwner.bind(null, owner.id)} className="px-5 pb-5 grid grid-cols-2 gap-3 text-sm max-w-lg">
          <label className="col-span-2">
            <span className="block font-bold text-ink-soft mb-1">Name</span>
            <input name="name" defaultValue={owner.name} className="w-full rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-accent" />
          </label>
          <label className="col-span-1">
            <span className="block font-bold text-ink-soft mb-1">Email</span>
            <input name="email" type="email" defaultValue={owner.email ?? ""} className="w-full rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-accent" />
          </label>
          <label className="col-span-1">
            <span className="block font-bold text-ink-soft mb-1">Phone</span>
            <input name="phone" defaultValue={owner.phone ?? ""} className="w-full rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-accent" />
          </label>
          <label className="col-span-2">
            <span className="block font-bold text-ink-soft mb-1">Notes</span>
            <textarea name="notes" rows={2} defaultValue={owner.notes ?? ""} className="w-full rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-accent" />
          </label>
          <div className="col-span-2">
            <SubmitButton pendingText="Saving…">Save owner</SubmitButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
