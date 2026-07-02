"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createSystemClient } from "@/lib/supabase/system";
import { syncInbox, type SyncResult } from "@/lib/gmail/sync";
import { sendMonthlyRecap, type RecapSendResult } from "@/lib/recap";

function parseEmailList(raw: string): string[] {
  return raw
    .split(/[,;\n]/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
}

export async function saveSettings(formData: FormData) {
  const supabase = await createClient();
  await supabase
    .from("biscuit_app_settings")
    .update({
      pacc_sender_emails: parseEmailList(String(formData.get("pacc_senders") ?? "")),
      barry_bcc_email: String(formData.get("barry_bcc") ?? "").trim().toLowerCase() || null,
      dext_email: String(formData.get("dext_email") ?? "").trim().toLowerCase() || null,
      family_recipient_emails: parseEmailList(String(formData.get("family_recipients") ?? "")),
      monthly_recap_enabled: formData.get("recap_enabled") === "on",
      reply_signature: String(formData.get("signature") ?? "").trim() || null,
    })
    .eq("id", 1);
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function addAppUser(_prev: { error?: string; ok?: boolean } | null, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email address." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("biscuit_app_users")
    .insert({ email, display_name: name || null });
  if (error) return { error: error.message.includes("duplicate") ? "That email already has access." : error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function removeAppUser(email: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Don't let someone lock themselves out or break the cron account
  if (!user?.email || email === user.email.toLowerCase() || email === process.env.SYSTEM_USER_EMAIL) {
    return;
  }
  await supabase.from("biscuit_app_users").delete().eq("email", email);
  revalidatePath("/settings");
}

export async function disconnectGmail() {
  const supabase = await createClient();
  await supabase.from("biscuit_gmail_tokens").delete().eq("id", 1);
  await supabase.from("biscuit_app_settings").update({ gmail_connected_email: null }).eq("id", 1);
  revalidatePath("/settings");
  revalidatePath("/");
}

/** "Sync now" button — runs the same engine as the cron job. */
export async function syncNow(): Promise<SyncResult> {
  const supabase = await createClient();
  const result = await syncInbox(supabase);
  revalidatePath("/");
  revalidatePath("/cases");
  revalidatePath("/settings");
  return result;
}

/** Send (or resend) the recap for the previous month right now. */
export async function sendRecapNow(): Promise<RecapSendResult> {
  // Use the system client so this matches exactly what the cron will do
  const supabase = await createSystemClient();
  const lastMonth = new Date();
  lastMonth.setDate(0);
  const result = await sendMonthlyRecap(supabase, lastMonth, { force: true });
  revalidatePath("/reports");
  return result;
}
