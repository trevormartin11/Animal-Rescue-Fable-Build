import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader, StatCard } from "@/components/ui";
import { MonthlyGivingChart } from "@/components/MonthlyGivingChart";
import { SendRecapButton } from "@/components/SendRecapButton";
import { computeGivingStats } from "@/lib/data/stats";
import { formatMoney, formatDate } from "@/lib/format";
import { monthLabel } from "@/lib/recap";
import type { Recap } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = await createClient();
  const year = new Date().getFullYear();

  const [stats, recapRes, settingsRes] = await Promise.all([
    computeGivingStats(supabase),
    supabase
      .from("biscuit_recaps")
      .select("*")
      .order("period_month", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("biscuit_app_settings")
      .select("monthly_recap_enabled, family_recipient_emails")
      .eq("id", 1)
      .single(),
  ]);
  const lastRecap = recapRes.data as Recap | null;
  const settings = settingsRes.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        sub={`Giving through ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}`}
        action={
          <a
            href={`/api/pdf/giving-report?year=${year}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-surface border border-line px-4 py-2 text-sm font-bold text-ink hover:bg-accent-soft/50 transition-colors"
          >
            <Download size={15} /> Download {year} PDF
          </a>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={`${year} total`} value={formatMoney(stats.yearTotal)} sub={`${stats.yearCases} cases`} />
        <StatCard label="Average per case" value={formatMoney(stats.avgPerCase)} sub="this year" />
        <StatCard label="This month" value={formatMoney(stats.monthTotal)} sub={`${stats.monthCases} cases`} />
        <StatCard label="All time" value={formatMoney(stats.allTimeTotal)} sub={`${stats.allTimeCases} cases`} />
      </div>

      <Card>
        <CardHeader title={`Monthly giving, ${year}`} />
        <div className="px-5 pb-5">
          <MonthlyGivingChart data={stats.monthlyTotals} />
          {/* table view of the same data */}
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-bold text-accent-deep hover:underline">
              View as table
            </summary>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-line">
                  <th className="py-2 font-bold">Month</th>
                  <th className="py-2 font-bold text-right">Cases</th>
                  <th className="py-2 font-bold text-right">Given</th>
                </tr>
              </thead>
              <tbody>
                {stats.monthlyTotals.map((m) => (
                  <tr key={m.month} className="border-b border-line/60">
                    <td className="py-2">{new Date(m.month + "-15").toLocaleDateString("en-US", { month: "long" })}</td>
                    <td className="py-2 text-right">{m.count}</td>
                    <td className="py-2 text-right font-semibold">{formatMoney(m.total)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2 font-bold">Total</td>
                  <td className="py-2 text-right font-bold">{stats.yearCases}</td>
                  <td className="py-2 text-right font-bold">{formatMoney(stats.yearTotal)}</td>
                </tr>
              </tbody>
            </table>
          </details>
        </div>
      </Card>

      <Card>
        <CardHeader title="Family recap email" />
        <div className="px-5 pb-5 space-y-4">
          <p className="text-sm text-ink-soft">
            {settings?.monthly_recap_enabled
              ? `Auto-send is on — the recap goes out on the 1st of each month to ${
                  settings.family_recipient_emails?.length ?? 0
                } ${settings?.family_recipient_emails?.length === 1 ? "person" : "people"}.`
              : "Auto-send is off — recaps only go out when you send one manually. Turn it on in Settings."}
          </p>
          <SendRecapButton />
          {lastRecap && (
            <div className="rounded-xl border border-line bg-cream p-4">
              <div className="text-sm font-bold mb-1">
                Last recap: {monthLabel(lastRecap.period_month.slice(0, 7))}
                {lastRecap.sent_at ? ` · sent ${formatDate(lastRecap.sent_at)}` : " · not sent"}
              </div>
              {lastRecap.narrative ? (
                <pre className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft font-body">
                  {lastRecap.narrative}
                </pre>
              ) : null}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
