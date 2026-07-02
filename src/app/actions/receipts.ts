"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizedGmail } from "@/lib/gmail/client";
import { forwardToDext } from "@/lib/gmail/sync";
import { formatMoney } from "@/lib/format";

/**
 * Upload a receipt screenshot for a case. It's filed and staged —
 * Chelsea approves the amount before anything goes to Dext.
 */
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

  await supabase.from("biscuit_receipts").insert({
    case_id: caseId,
    source: "upload",
    amount: amountRaw ? Number(amountRaw) : null,
    storage_path: path,
    filename: file.name,
    content_type: file.type || null,
  });

  await supabase.from("biscuit_activity_log").insert({
    case_id: caseId,
    event: "receipt_uploaded",
    detail: `${file.name} · staged for approval before Dext`,
  });

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/");
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
    detail: "Receipt assigned manually · staged for approval before Dext",
  });
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
  revalidatePath("/");
}

/**
 * Chelsea's approval: she confirms (or edits) the amount — e.g. a $1,000
 * bill of which the family pays $500 — and the receipt goes to Dext with
 * that approved amount. Also serves as the retry after a failed send.
 */
export async function approveReceipt(receiptId: string, formData: FormData) {
  const amountRaw = String(formData.get("amount") ?? "").replace(/[$,]/g, "").trim();
  const amount = Number(amountRaw);
  if (!amountRaw || !Number.isFinite(amount) || amount <= 0) return;

  const supabase = await createClient();
  const { data: r } = await supabase
    .from("biscuit_receipts")
    .select("*")
    .eq("id", receiptId)
    .maybeSingle();
  if (!r || r.forwarded_to_dext_at) return;

  const setError = async (msg: string) => {
    await supabase
      .from("biscuit_receipts")
      .update({ amount, forward_error: msg })
      .eq("id", receiptId);
    if (r.case_id) revalidatePath(`/cases/${r.case_id}`);
    revalidatePath("/");
  };

  const { data: settings } = await supabase
    .from("biscuit_app_settings")
    .select("dext_email")
    .eq("id", 1)
    .single();
  if (!settings?.dext_email) return setError("No Dext email configured — add it in Settings");

  const authed = await getAuthorizedGmail(supabase);
  if (!authed) return setError("Gmail not connected");

  let fileData: Buffer | null = null;
  if (r.storage_path) {
    const { data: blob } = await supabase.storage
      .from("biscuit-receipts")
      .download(r.storage_path);
    if (blob) fileData = Buffer.from(await blob.arrayBuffer());
  }
  if (!fileData) return setError("Receipt file is missing from storage");

  let animal: string | null = null;
  if (r.case_id) {
    const { data: c } = await supabase
      .from("biscuit_cases")
      .select("animal_name")
      .eq("id", r.case_id)
      .maybeSingle();
    animal = c?.animal_name ?? null;
  }

  const approved = formatMoney(amount);
  const detectedNote =
    r.amount != null && Number(r.amount) !== amount
      ? `\nReceipt document total: ${formatMoney(Number(r.amount))} (the trust is covering ${approved} of it).`
      : "";

  try {
    await forwardToDext(
      authed.gmail,
      authed.email,
      settings.dext_email,
      `Receipt — ${animal ?? r.filename ?? "rescue case"} — ${approved}`,
      [
        `Receipt approved in Biscuit by the Rowley Family Charitable Giving Trust.`,
        ``,
        `Approved amount: ${approved}${detectedNote}`,
        animal ? `Case: ${animal}` : null,
        r.email_from ? `Original sender: ${r.email_from}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      [
        {
          filename: r.filename ?? "receipt",
          contentType: r.content_type ?? "application/octet-stream",
          data: fileData,
        },
      ]
    );
  } catch (e) {
    return setError(e instanceof Error ? e.message : String(e));
  }

  await supabase
    .from("biscuit_receipts")
    .update({ amount, forwarded_to_dext_at: new Date().toISOString(), forward_error: null })
    .eq("id", receiptId);
  await supabase.from("biscuit_activity_log").insert({
    case_id: r.case_id,
    event: "receipt_approved",
    detail: `${approved} approved and sent to Dext${animal ? ` (${animal})` : ""}`,
  });

  if (r.case_id) revalidatePath(`/cases/${r.case_id}`);
  revalidatePath("/");
}
