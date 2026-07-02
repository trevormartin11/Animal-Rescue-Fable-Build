"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizedGmail } from "@/lib/gmail/client";
import { forwardToDext } from "@/lib/gmail/sync";

/** Upload a receipt screenshot for a case; auto-forwards to Dext when possible. */
export async function uploadReceipt(
  _prev: { error?: string; ok?: boolean } | null,
  formData: FormData
) {
  const caseId = String(formData.get("case_id") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").replace(/[$,]/g, "").trim();
  const file = formData.get("file") as File | null;

  if (!caseId) return { error: "Missing case." };
  if (!file || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > 15 * 1024 * 1024) return { error: "File is too large (15 MB max)." };

  const supabase = await createClient();
  const buf = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${caseId}/${Date.now()}-${safeName}`;

  const { error: upErr } = await supabase.storage
    .from("biscuit-receipts")
    .upload(path, buf, { contentType: file.type || "application/octet-stream" });
  if (upErr) return { error: `Upload failed: ${upErr.message}` };

  // Forward to Dext
  const { data: settings } = await supabase.from("biscuit_app_settings").select("*").eq("id", 1).single();
  const { data: c } = await supabase
    .from("biscuit_cases")
    .select("animal_name")
    .eq("id", caseId)
    .maybeSingle();

  let forwardedAt: string | null = null;
  let forwardError: string | null = null;
  if (settings?.dext_email) {
    const authed = await getAuthorizedGmail(supabase);
    if (authed) {
      try {
        await forwardToDext(
          authed.gmail,
          authed.email,
          settings.dext_email,
          `Receipt — ${c?.animal_name ?? "rescue case"}`,
          "Receipt uploaded manually in Biscuit and forwarded for accounting.",
          [{ filename: safeName, contentType: file.type || "application/octet-stream", data: buf }]
        );
        forwardedAt = new Date().toISOString();
      } catch (e) {
        forwardError = e instanceof Error ? e.message : String(e);
      }
    } else {
      forwardError = "Gmail not connected";
    }
  } else {
    forwardError = "No Dext email configured";
  }

  await supabase.from("biscuit_receipts").insert({
    case_id: caseId,
    source: "upload",
    amount: amountRaw ? Number(amountRaw) : null,
    storage_path: path,
    filename: file.name,
    content_type: file.type || null,
    forwarded_to_dext_at: forwardedAt,
    forward_error: forwardError,
  });

  await supabase.from("biscuit_activity_log").insert({
    case_id: caseId,
    event: "receipt_uploaded",
    detail: `${file.name}${forwardedAt ? " · forwarded to Dext" : forwardError ? ` · Dext: ${forwardError}` : ""}`,
  });

  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}

/** Attach an unmatched emailed receipt to a case. */
export async function assignReceiptToCase(receiptId: string, formData: FormData) {
  const caseId = String(formData.get("case_id") ?? "");
  if (!caseId) return;
  const supabase = await createClient();
  await supabase.from("biscuit_receipts").update({ case_id: caseId }).eq("id", receiptId);
  await supabase.from("biscuit_activity_log").insert({
    case_id: caseId,
    event: "receipt_filed",
    detail: "Receipt assigned manually",
  });
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
  revalidatePath("/");
}

/** Retry a failed Dext forward. */
export async function retryDextForward(receiptId: string) {
  const supabase = await createClient();
  const { data: r } = await supabase.from("biscuit_receipts").select("*").eq("id", receiptId).single();
  if (!r || r.forwarded_to_dext_at) return;

  const { data: settings } = await supabase.from("biscuit_app_settings").select("*").eq("id", 1).single();
  const authed = await getAuthorizedGmail(supabase);
  if (!settings?.dext_email || !authed) return;

  let data: Buffer | null = null;
  if (r.storage_path) {
    const { data: blob } = await supabase.storage.from("biscuit-receipts").download(r.storage_path);
    if (blob) data = Buffer.from(await blob.arrayBuffer());
  }
  if (!data) return;

  try {
    await forwardToDext(
      authed.gmail,
      authed.email,
      settings.dext_email,
      r.email_subject ?? `Receipt — ${r.filename ?? "rescue case"}`,
      "Receipt forwarded by Biscuit for accounting.",
      [
        {
          filename: r.filename ?? "receipt",
          contentType: r.content_type ?? "application/octet-stream",
          data,
        },
      ]
    );
    await supabase
      .from("biscuit_receipts")
      .update({ forwarded_to_dext_at: new Date().toISOString(), forward_error: null })
      .eq("id", receiptId);
    await supabase.from("biscuit_activity_log").insert({
      case_id: r.case_id,
      event: "receipt_forwarded",
      detail: "Forwarded to Dext (retry)",
    });
  } catch (e) {
    await supabase
      .from("biscuit_receipts")
      .update({ forward_error: e instanceof Error ? e.message : String(e) })
      .eq("id", receiptId);
  }
  if (r.case_id) revalidatePath(`/cases/${r.case_id}`);
  revalidatePath("/");
}
