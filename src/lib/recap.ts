import type { DbClient } from "@/lib/supabase/types";
import { computeRecapStats } from "@/lib/data/stats";
import { generateRecapNarrative } from "@/lib/ai/recap";
import { getAuthorizedGmail } from "@/lib/gmail/client";
import { buildRawMessage } from "@/lib/gmail/mime";
import { formatMoney } from "@/lib/format";
import type { RecapStats } from "@/lib/types";

export function monthLabel(month: string): string {
  return new Date(month + "-15").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function buildRecapEmailText(narrative: string, stats: RecapStats): string {
  const lines = [
    `Hi everyone,`,
    ``,
    narrative,
    ``,
    `— By the numbers for ${monthLabel(stats.month)} —`,
    `Animals helped: ${stats.casesHelped}`,
    `Given this month: ${formatMoney(stats.totalGiven)}`,
    `Given this year: ${formatMoney(stats.yearTotal)} across ${stats.yearCases} ${stats.yearCases === 1 ? "case" : "cases"}`,
  ];
  if (stats.animals.length) {
    lines.push(``, `— This month's animals —`);
    for (const a of stats.animals) {
      lines.push(
        `• ${a.name ?? "Unnamed"}${a.species ? ` (${a.species})` : ""}${a.amount != null ? ` — ${formatMoney(a.amount)}` : ""}${a.situation ? `: ${a.situation}` : ""}`
      );
    }
  }
  lines.push(
    ``,
    `With love,`,
    `Chelsea & Biscuit 🦴`,
    ``,
    `(Sent by Biscuit, the Rowley Family giving tracker.)`
  );
  return lines.join("\n");
}

export function recapSubject(month: string): string {
  return `Rowley Family Giving — ${monthLabel(month)} recap`;
}

export interface RecapSendResult {
  ok: boolean;
  reason?: string;
  month?: string;
  sentTo?: string[];
}

/**
 * Generate and send the recap for the month containing `monthDate`.
 * Skips if already sent for that month unless `force` is set.
 */
export async function sendMonthlyRecap(
  supabase: DbClient,
  monthDate: Date,
  opts: { force?: boolean } = {}
): Promise<RecapSendResult> {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const periodKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}-01`;

  const { data: settings } = await supabase.from("biscuit_app_settings").select("*").eq("id", 1).single();
  if (!settings) return { ok: false, reason: "Settings missing" };

  const recipients: string[] = settings.family_recipient_emails ?? [];
  if (!recipients.length) return { ok: false, reason: "No family recipients configured" };

  const { data: existing } = await supabase
    .from("biscuit_recaps")
    .select("id, sent_at")
    .eq("period_month", periodKey)
    .maybeSingle();
  if (existing?.sent_at && !opts.force) {
    return { ok: false, reason: "Recap already sent for this month" };
  }

  const authed = await getAuthorizedGmail(supabase);
  if (!authed) return { ok: false, reason: "Gmail not connected" };

  const stats = await computeRecapStats(supabase, monthStart);
  const narrative = await generateRecapNarrative(stats);
  const text = buildRecapEmailText(narrative, stats);

  const raw = buildRawMessage({
    from: authed.email,
    to: recipients.join(", "),
    subject: recapSubject(stats.month),
    text,
  });
  await authed.gmail.users.messages.send({ userId: "me", requestBody: { raw } });

  const now = new Date().toISOString();
  const recapRow = {
    period_month: periodKey,
    narrative,
    stats,
    sent_at: now,
    sent_to: recipients,
  };
  if (existing) {
    await supabase.from("biscuit_recaps").update(recapRow).eq("id", existing.id);
  } else {
    await supabase.from("biscuit_recaps").insert(recapRow);
  }
  await supabase.from("biscuit_activity_log").insert({
    case_id: null,
    event: "recap_sent",
    detail: `${monthLabel(stats.month)} recap sent to ${recipients.join(", ")}`,
  });

  return { ok: true, month: stats.month, sentTo: recipients };
}
