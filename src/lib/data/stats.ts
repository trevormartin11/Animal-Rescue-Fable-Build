import type { DbClient } from "@/lib/supabase/types";
import type { Case, RecapStats } from "@/lib/types";

/** The date a case's giving "counts" — when it was paid, else closed, else requested. */
export function givingDate(c: Pick<Case, "paid_at" | "closed_at" | "requested_at">): Date {
  return new Date(c.paid_at ?? c.closed_at ?? c.requested_at);
}

export interface GivingStats {
  yearTotal: number;
  yearCases: number;
  monthTotal: number;
  monthCases: number;
  avgPerCase: number;
  allTimeTotal: number;
  allTimeCases: number;
  monthlyTotals: { month: string; label: string; total: number; count: number }[];
}

/** Cases that count as giving: paid or closed, with a dollar amount. */
export async function fetchGivenCases(supabase: DbClient) {
  const { data } = await supabase
    .from("biscuit_cases")
    .select("id, animal_name, species, situation, amount, paid_at, closed_at, requested_at, status")
    .in("status", ["paid", "closed"]);
  return data ?? [];
}

export async function computeGivingStats(
  supabase: DbClient,
  now: Date = new Date()
): Promise<GivingStats> {
  const given = await fetchGivenCases(supabase);
  const year = now.getFullYear();
  const month = now.getMonth();

  let yearTotal = 0,
    yearCases = 0,
    monthTotal = 0,
    monthCases = 0,
    allTimeTotal = 0,
    allTimeCases = 0;

  const monthly = new Map<string, { total: number; count: number }>();
  for (let m = 0; m <= month; m++) {
    monthly.set(`${year}-${String(m + 1).padStart(2, "0")}`, { total: 0, count: 0 });
  }

  for (const c of given) {
    const amt = Number(c.amount ?? 0);
    const d = givingDate(c);
    allTimeTotal += amt;
    allTimeCases++;
    if (d.getFullYear() === year) {
      yearTotal += amt;
      yearCases++;
      const key = `${year}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = monthly.get(key) ?? { total: 0, count: 0 };
      bucket.total += amt;
      bucket.count++;
      monthly.set(key, bucket);
      if (d.getMonth() === month) {
        monthTotal += amt;
        monthCases++;
      }
    }
  }

  const monthlyTotals = [...monthly.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({
      month: key,
      label: new Date(key + "-15").toLocaleDateString("en-US", { month: "short" }),
      total: v.total,
      count: v.count,
    }));

  return {
    yearTotal,
    yearCases,
    monthTotal,
    monthCases,
    avgPerCase: yearCases ? yearTotal / yearCases : 0,
    allTimeTotal,
    allTimeCases,
    monthlyTotals,
  };
}

/** Stats for a specific month's recap (month = first day of that month). */
export async function computeRecapStats(
  supabase: DbClient,
  monthStart: Date
): Promise<RecapStats> {
  const given = await fetchGivenCases(supabase);
  const y = monthStart.getFullYear();
  const m = monthStart.getMonth();

  const inMonth = given.filter((c) => {
    const d = givingDate(c);
    return d.getFullYear() === y && d.getMonth() === m;
  });
  const inYear = given.filter((c) => givingDate(c).getFullYear() === y);

  return {
    month: `${y}-${String(m + 1).padStart(2, "0")}`,
    casesHelped: inMonth.length,
    totalGiven: inMonth.reduce((s, c) => s + Number(c.amount ?? 0), 0),
    yearTotal: inYear.reduce((s, c) => s + Number(c.amount ?? 0), 0),
    yearCases: inYear.length,
    animals: inMonth.map((c) => ({
      name: c.animal_name,
      species: c.species,
      situation: c.situation,
      amount: c.amount != null ? Number(c.amount) : null,
    })),
  };
}
