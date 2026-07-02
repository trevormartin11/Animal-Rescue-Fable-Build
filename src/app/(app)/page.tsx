import Link from "next/link";
import { AlertTriangle, ArrowRight, Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, EmptyState, StatCard, StatusBadge, LinkButton } from "@/components/ui";
import { SyncNowButton } from "@/components/SyncNowButton";
import { computeGivingStats } from "@/lib/data/stats";
import { formatMoney, timeAgo } from "@/lib/format";
import { aiConfigured } from "@/lib/ai/client";
import { gmailConfigured } from "@/lib/gmail/client";
import { ACTIVE_STATUSES, NEXT_ACTION, type CaseStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [settingsRes, openCasesRes, unmatchedRes, activityRes, stats] = await Promise.all([
    supabase.from("biscuit_app_settings").select("*").eq("id", 1).single(),
    supabase
      .from("biscuit_cases")
      .select("id, animal_name, species, situation, amount, status, requested_at, owners:biscuit_owners(name)")
      .in("status", ACTIVE_STATUSES)
      .order("requested_at", { ascending: true }),
    supabase
      .from("biscuit_receipts")
      .select("id, case_id, amount, email_from, email_subject, filename, received_at, cases:biscuit_cases(animal_name)")
      .is("forwarded_to_dext_at", null)
      .order("received_at", { ascending: false }),
    supabase
      .from("biscuit_activity_log")
      .select("id, case_id, event, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    computeGivingStats(supabase),
  ]);

  const settings = settingsRes.data;
  const openCases = openCasesRes.data ?? [];
  const pendingReceipts = unmatchedRes.data ?? [];
  const unmatched = pendingReceipts.filter((r) => !r.case_id);
  const staged = pendingReceipts.filter((r) => r.case_id);
  const activity = activityRes.data ?? [];

  const warnings: { text: string; href: string }[] = [];
  if (!settings?.gmail_connected_email) {
    warnings.push({
      text: "The rescue inbox isn't connected yet — new requests won't come in automatically.",
      href: "/settings",
    });
  }
  if (!aiConfigured()) {
    warnings.push({
      text: "The AI key isn't configured — email parsing and draft writing are off.",
      href: "/settings",
    });
  }
  if (!settings?.dext_email) {
    warnings.push({
      text: "No Dext accounting email set — receipts can't be forwarded automatically.",
      href: "/settings",
    });
  }
  if (settings?.gmail_connected_email && !gmailConfigured()) {
    warnings.push({
      text: "Google OAuth credentials are missing from the server environment.",
      href: "/settings",
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Good {greeting()}, Chelsea</h1>
          <p className="mt-1 text-ink-soft">
            {openCases.length
              ? `${openCases.length} open ${openCases.length === 1 ? "case" : "cases"} · last inbox check ${timeAgo(settings?.last_synced_at)}`
              : `All caught up · last inbox check ${timeAgo(settings?.last_synced_at)}`}
          </p>
        </div>
        <div className="hidden md:block">
          <SyncNowButton />
        </div>
      </div>

      {warnings.length > 0 && (
        <Card className="border-biscuit bg-biscuit-soft/60">
          <div className="px-5 py-4 space-y-1.5">
            {warnings.map((w) => (
              <Link key={w.text} href={w.href} className="flex items-start gap-2 text-sm font-semibold text-[#7a5a1f] hover:underline">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                {w.text}
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label={`Given in ${new Date().getFullYear()}`}
          value={formatMoney(stats.yearTotal)}
          sub={`${stats.yearCases} ${stats.yearCases === 1 ? "animal" : "animals"} helped`}
        />
        <StatCard
          label="This month"
          value={formatMoney(stats.monthTotal)}
          sub={`${stats.monthCases} ${stats.monthCases === 1 ? "case" : "cases"}`}
        />
        <StatCard label="Open cases" value={String(openCases.length)} sub="in progress now" />
        <StatCard label="Average per case" value={formatMoney(stats.avgPerCase)} sub="this year" />
      </div>

      <Card>
        <CardHeader
          title="Needs attention"
          action={<LinkButton href="/cases" variant="secondary">All cases</LinkButton>}
        />
        {openCases.length === 0 && unmatched.length === 0 && staged.length === 0 ? (
          <EmptyState
            title="Nothing waiting on you"
            hint="New PACC 911 requests will appear here automatically."
            action={<LinkButton href="/cases/new" variant="secondary">Add a case manually</LinkButton>}
          />
        ) : (
          <ul className="divide-y divide-line">
            {openCases.map((c) => {
              const owner = Array.isArray(c.owners) ? c.owners[0] : c.owners;
              return (
                <li key={c.id}>
                  <Link
                    href={`/cases/${c.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-accent-soft/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold">
                          {c.animal_name ?? "Unnamed"}
                          {c.species ? <span className="font-normal text-ink-soft"> · {c.species}</span> : null}
                        </span>
                        <StatusBadge status={c.status as CaseStatus} />
                      </div>
                      <div className="mt-0.5 text-sm text-ink-soft truncate">
                        {NEXT_ACTION[c.status as CaseStatus]}
                        {owner?.name ? ` — ${owner.name}` : ""}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold">{formatMoney(c.amount != null ? Number(c.amount) : null)}</div>
                      <div className="text-xs text-muted">{timeAgo(c.requested_at)}</div>
                    </div>
                    <ArrowRight size={16} className="text-muted shrink-0" />
                  </Link>
                </li>
              );
            })}
            {staged.map((r) => {
              const rCase = Array.isArray(r.cases) ? r.cases[0] : r.cases;
              return (
                <li key={r.id}>
                  <Link
                    href={`/cases/${r.case_id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-accent-soft/30 transition-colors"
                  >
                    <Inbox size={18} className="text-biscuit shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold">
                        Receipt awaiting your approval
                        {rCase?.animal_name ? (
                          <span className="font-normal text-ink-soft"> · {rCase.animal_name}</span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-sm text-ink-soft truncate">
                        Confirm the amount to send it to Dext —{" "}
                        {r.email_subject || r.filename || "receipt"}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {r.amount != null && (
                        <div className="font-bold">{formatMoney(Number(r.amount))}</div>
                      )}
                      <div className="text-xs text-muted">{timeAgo(r.received_at)}</div>
                    </div>
                    <ArrowRight size={16} className="text-muted shrink-0" />
                  </Link>
                </li>
              );
            })}
            {unmatched.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/cases?assign=${r.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-accent-soft/30 transition-colors"
                >
                  <Inbox size={18} className="text-biscuit shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">Receipt needs a case</div>
                    <div className="mt-0.5 text-sm text-ink-soft truncate">
                      {r.email_subject || r.filename || r.email_from || "Receipt"}
                    </div>
                  </div>
                  <div className="text-xs text-muted shrink-0">{timeAgo(r.received_at)}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Recent activity" />
        {activity.length === 0 ? (
          <EmptyState title="No activity yet" hint="Connect the inbox in Settings to get started." />
        ) : (
          <ul className="divide-y divide-line">
            {activity.map((a) => (
              <li key={a.id} className="px-5 py-3 flex items-baseline gap-3">
                <span className="text-xs text-muted shrink-0 w-16">{timeAgo(a.created_at)}</span>
                <div className="min-w-0 text-sm">
                  {a.case_id ? (
                    <Link href={`/cases/${a.case_id}`} className="font-bold hover:text-accent-deep">
                      {eventLabel(a.event)}
                    </Link>
                  ) : (
                    <span className="font-bold">{eventLabel(a.event)}</span>
                  )}
                  {a.detail ? <span className="text-ink-soft"> — {a.detail}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function eventLabel(event: string): string {
  const labels: Record<string, string> = {
    case_created: "New case",
    draft_created: "Draft queued",
    draft_failed: "Draft failed",
    draft_deleted: "Draft deleted",
    intro_sent: "Intro sent",
    receipt_filed: "Receipt filed",
    receipt_uploaded: "Receipt uploaded",
    receipt_forwarded: "Receipt forwarded",
    receipt_unmatched: "Unmatched receipt",
    recap_sent: "Recap sent",
    needs_attention: "Needs attention",
    case_updated: "Case updated",
    status_accepted: "Accepted",
    status_owner_contacted: "Owner contacted",
    status_vet_account_set: "On vet account",
    status_paid: "Paid",
    status_closed: "Closed",
    status_denied: "Denied",
  };
  return labels[event] ?? event;
}
