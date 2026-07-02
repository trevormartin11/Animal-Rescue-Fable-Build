import type { gmail_v1 } from "googleapis";
import type { DbClient } from "@/lib/supabase/types";
import { getAuthorizedGmail } from "./client";
import { parseMessage, extractEmailAddress, type ParsedMessage } from "./parse";
import { buildRawMessage, type MimeAttachment } from "./mime";
import { analyzeInboundEmail, type OpenCaseSummary } from "@/lib/ai/analyze";
import { generateOwnerDraft } from "@/lib/ai/draft";
import { aiConfigured } from "@/lib/ai/client";
import type { AppSettings } from "@/lib/types";

export interface SyncResult {
  ok: boolean;
  skipped?: string;
  scanned: number;
  newCases: number;
  receipts: number;
  other: number;
  advanced: number;
  errors: string[];
}

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

async function fetchAttachment(
  gmail: gmail_v1.Gmail,
  messageId: string,
  attachmentId: string
): Promise<Buffer | null> {
  const { data } = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId,
    id: attachmentId,
  });
  if (!data.data) return null;
  return Buffer.from(data.data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

async function loadOpenCases(supabase: DbClient): Promise<OpenCaseSummary[]> {
  const { data } = await supabase
    .from("biscuit_cases")
    .select("id, animal_name, situation, amount, vet_name, owners:biscuit_owners(name, email)")
    .in("status", ["new", "accepted", "owner_contacted", "vet_account_set", "paid"])
    .order("requested_at", { ascending: false })
    .limit(50);

  return (data ?? []).map((c) => {
    const owner = Array.isArray(c.owners) ? c.owners[0] : c.owners;
    return {
      id: c.id,
      animalName: c.animal_name,
      ownerName: owner?.name ?? null,
      ownerEmail: owner?.email ?? null,
      vetName: c.vet_name,
      amount: c.amount,
      situation: c.situation,
    };
  });
}

async function findOrCreateOwner(
  supabase: DbClient,
  owner: { name: string | null; email: string | null; phone: string | null }
): Promise<string | null> {
  if (owner.email) {
    const { data: existing } = await supabase
      .from("biscuit_owners")
      .select("id, phone")
      .ilike("email", owner.email)
      .maybeSingle();
    if (existing) {
      if (owner.phone && !existing.phone) {
        await supabase.from("biscuit_owners").update({ phone: owner.phone }).eq("id", existing.id);
      }
      return existing.id;
    }
  }
  if (!owner.name && !owner.email) return null;

  const { data: created, error } = await supabase
    .from("biscuit_owners")
    .insert({
      name: owner.name || owner.email || "Unknown owner",
      email: owner.email,
      phone: owner.phone,
    })
    .select("id")
    .single();
  if (error) throw new Error(`owner insert failed: ${error.message}`);
  return created.id;
}

async function log(
  supabase: DbClient,
  caseId: string | null,
  event: string,
  detail?: string
) {
  await supabase.from("biscuit_activity_log").insert({ case_id: caseId, event, detail: detail ?? null });
}

/**
 * Create the Gmail draft reply to the owner (BCC Bari) and record it on the case.
 */
export async function createOwnerGmailDraft(
  gmail: gmail_v1.Gmail,
  supabase: DbClient,
  connectedEmail: string,
  settings: AppSettings,
  caseId: string,
  input: {
    ownerEmail: string;
    animalName: string | null;
    species: string | null;
    breed: string | null;
    situation: string | null;
    amount: number | null;
    ownerName: string | null;
    vetName: string | null;
  }
): Promise<void> {
  const draft = await generateOwnerDraft({
    animalName: input.animalName,
    species: input.species,
    breed: input.breed,
    situation: input.situation,
    amount: input.amount,
    ownerName: input.ownerName,
    vetName: input.vetName,
    signature: settings.reply_signature,
  });

  const raw = buildRawMessage({
    from: connectedEmail,
    to: input.ownerEmail,
    bcc: settings.barry_bcc_email ?? undefined,
    subject: draft.subject,
    text: draft.body,
  });

  const { data: gmailDraft } = await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message: { raw } },
  });

  await supabase
    .from("biscuit_cases")
    .update({
      draft_gmail_id: gmailDraft.id ?? null,
      draft_subject: draft.subject,
      draft_body: draft.body,
    })
    .eq("id", caseId);

  await log(
    supabase,
    caseId,
    "draft_created",
    `Gmail draft queued to ${input.ownerEmail}${settings.barry_bcc_email ? ` (BCC ${settings.barry_bcc_email})` : ""}`
  );
}

/**
 * Send an approved receipt to the Dext accounting address.
 */
export async function forwardToDext(
  gmail: gmail_v1.Gmail,
  connectedEmail: string,
  dextEmail: string,
  subject: string,
  bodyText: string,
  attachments: MimeAttachment[]
): Promise<void> {
  const raw = buildRawMessage({
    from: connectedEmail,
    to: dextEmail,
    subject,
    text: bodyText,
    attachments,
  });
  await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
}

async function ensureProcessedLabel(gmail: gmail_v1.Gmail): Promise<string | null> {
  try {
    const { data } = await gmail.users.labels.list({ userId: "me" });
    const existing = data.labels?.find((l) => l.name === "Biscuit");
    if (existing?.id) return existing.id;
    const { data: created } = await gmail.users.labels.create({
      userId: "me",
      requestBody: {
        name: "Biscuit",
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
      },
    });
    return created.id ?? null;
  } catch {
    return null; // label is a nicety, never fail the sync over it
  }
}

async function handleCaseRequest(
  gmail: gmail_v1.Gmail,
  supabase: DbClient,
  connectedEmail: string,
  settings: AppSettings,
  msg: ParsedMessage,
  analysis: NonNullable<Awaited<ReturnType<typeof analyzeInboundEmail>>["caseRequest"]>,
  result: SyncResult
) {
  const ownerId = await findOrCreateOwner(supabase, {
    name: analysis.ownerName,
    email: analysis.ownerEmail?.toLowerCase() ?? null,
    phone: analysis.ownerPhone,
  });

  const { data: created, error } = await supabase
    .from("biscuit_cases")
    .insert({
      owner_id: ownerId,
      animal_name: analysis.animalName,
      species: analysis.species,
      breed: analysis.breed,
      situation: analysis.situation,
      amount: analysis.amount,
      vet_name: analysis.vetName,
      vet_phone: analysis.vetPhone,
      status: "new",
      source: "email",
      gmail_thread_id: msg.threadId,
      gmail_message_id: msg.id,
      requested_at: msg.date ?? new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(`case insert failed: ${error.message}`);
  const caseId = created.id;
  result.newCases++;

  await log(
    supabase,
    caseId,
    "case_created",
    `From ${msg.from}: ${analysis.animalName ?? "animal"} — ${analysis.situation ?? ""}`.slice(0, 500)
  );

  // Save any photos included in the request email
  for (const att of msg.attachments) {
    if (!att.contentType.startsWith("image/") || att.size > MAX_ATTACHMENT_BYTES) continue;
    try {
      const buf = await fetchAttachment(gmail, msg.id, att.attachmentId);
      if (!buf) continue;
      const path = `${caseId}/${Date.now()}-${att.filename.replace(/[^\w.\-]+/g, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("biscuit-photos")
        .upload(path, buf, { contentType: att.contentType });
      if (!upErr) {
        await supabase.from("biscuit_case_photos").insert({
          case_id: caseId,
          storage_path: path,
          filename: att.filename,
          content_type: att.contentType,
        });
      }
    } catch {
      // photos are best-effort
    }
  }

  // Queue the warm intro draft (assume acceptance — Chelsea deletes it to deny)
  if (analysis.ownerEmail) {
    try {
      await createOwnerGmailDraft(gmail, supabase, connectedEmail, settings, caseId, {
        ownerEmail: analysis.ownerEmail,
        animalName: analysis.animalName,
        species: analysis.species,
        breed: analysis.breed,
        situation: analysis.situation,
        amount: analysis.amount,
        ownerName: analysis.ownerName,
        vetName: analysis.vetName,
      });
    } catch (e) {
      result.errors.push(`draft for case ${caseId}: ${e instanceof Error ? e.message : e}`);
      await log(supabase, caseId, "draft_failed", String(e).slice(0, 500));
    }
  } else {
    await log(
      supabase,
      caseId,
      "needs_attention",
      "No owner email found in the request — draft not created"
    );
  }

  return caseId;
}

async function handleReceipt(
  gmail: gmail_v1.Gmail,
  supabase: DbClient,
  connectedEmail: string,
  settings: AppSettings,
  msg: ParsedMessage,
  receipt: { matchedCaseId: string | null; amount: number | null; merchant: string | null },
  result: SyncResult
) {
  // Validate the AI-suggested case id against the DB before trusting it
  let caseId: string | null = null;
  if (receipt.matchedCaseId) {
    const { data } = await supabase
      .from("biscuit_cases")
      .select("id, status")
      .eq("id", receipt.matchedCaseId)
      .maybeSingle();
    if (data) caseId = data.id;
  }

  // Pull attachments (receipt PDFs/images); fall back to the email text itself
  const files: MimeAttachment[] = [];
  for (const att of msg.attachments) {
    if (att.size > MAX_ATTACHMENT_BYTES) continue;
    const buf = await fetchAttachment(gmail, msg.id, att.attachmentId).catch(() => null);
    if (buf) files.push({ filename: att.filename, contentType: att.contentType, data: buf });
  }
  if (!files.length) {
    files.push({
      filename: "receipt-email.txt",
      contentType: "text/plain",
      data: Buffer.from(
        `From: ${msg.from}\nSubject: ${msg.subject}\nDate: ${msg.date}\n\n${msg.bodyText}`,
        "utf-8"
      ),
    });
  }

  // File the first document with the case
  let storagePath: string | null = null;
  const primary = files[0];
  try {
    storagePath = `${caseId ?? "unmatched"}/${Date.now()}-${primary.filename.replace(/[^\w.\-]+/g, "_")}`;
    const { error: upErr } = await supabase.storage
      .from("biscuit-receipts")
      .upload(storagePath, primary.data, { contentType: primary.contentType });
    if (upErr) storagePath = null;
  } catch {
    storagePath = null;
  }

  // Staged for Chelsea's approval — nothing goes to Dext until she confirms the amount
  await supabase.from("biscuit_receipts").insert({
    case_id: caseId,
    source: "email",
    amount: receipt.amount,
    storage_path: storagePath,
    filename: primary.filename,
    content_type: primary.contentType,
    gmail_message_id: msg.id,
    email_subject: msg.subject,
    email_from: msg.from,
    forwarded_to_dext_at: null,
    forward_error: null,
    received_at: msg.date ?? new Date().toISOString(),
  });
  result.receipts++;

  if (caseId) {
    await log(
      supabase,
      caseId,
      "receipt_filed",
      `${receipt.merchant ?? msg.from}${receipt.amount != null ? ` — $${receipt.amount} detected` : ""} · staged for approval before Dext`
    );
    // A receipt usually means the bill was paid — advance the case if it was waiting on payment
    const { data: c } = await supabase.from("biscuit_cases").select("status").eq("id", caseId).single();
    if (c && ["owner_contacted", "vet_account_set"].includes(c.status)) {
      await supabase
        .from("biscuit_cases")
        .update({ status: "paid", paid_at: msg.date ?? new Date().toISOString() })
        .eq("id", caseId);
      await log(supabase, caseId, "status_paid", "Marked paid automatically (receipt received)");
      result.advanced++;
    }
  } else {
    await log(supabase, null, "receipt_unmatched", `Receipt from ${msg.from} needs a case assignment`);
  }
}

/** Detect intro drafts that Chelsea has sent, and advance those cases. */
async function detectSentIntros(
  gmail: gmail_v1.Gmail,
  supabase: DbClient,
  result: SyncResult
) {
  const { data: pending } = await supabase
    .from("biscuit_cases")
    .select("id, draft_gmail_id, created_at, owners:biscuit_owners(email)")
    .eq("status", "new")
    .not("draft_gmail_id", "is", null);

  for (const c of pending ?? []) {
    try {
      await gmail.users.drafts.get({ userId: "me", id: c.draft_gmail_id!, format: "minimal" });
      // Draft still exists — not sent yet
    } catch {
      // Draft is gone: either sent or deleted. Look for a sent message to the owner.
      const owner = Array.isArray(c.owners) ? c.owners[0] : c.owners;
      const ownerEmail = owner?.email;
      let sent = false;
      if (ownerEmail) {
        const { data } = await gmail.users.messages.list({
          userId: "me",
          q: `in:sent to:${ownerEmail}`,
          maxResults: 3,
        });
        sent = Boolean(data.messages?.length);
      }
      if (sent) {
        const now = new Date().toISOString();
        await supabase
          .from("biscuit_cases")
          .update({
            status: "owner_contacted",
            accepted_at: now,
            owner_contacted_at: now,
            draft_gmail_id: null,
          })
          .eq("id", c.id);
        await log(supabase, c.id, "intro_sent", "Intro email sent — case accepted & owner contacted");
        result.advanced++;
      } else {
        // Draft deleted without sending; leave status as new but clear the stale pointer
        await supabase.from("biscuit_cases").update({ draft_gmail_id: null }).eq("id", c.id);
        await log(supabase, c.id, "draft_deleted", "Gmail draft was deleted without sending");
      }
    }
  }
}

/**
 * The main inbox sync. Idempotent: every processed message is recorded in
 * `emails` and skipped on later runs. Called by cron and by the Sync Now button.
 */
export async function syncInbox(supabase: DbClient): Promise<SyncResult> {
  const result: SyncResult = {
    ok: true,
    scanned: 0,
    newCases: 0,
    receipts: 0,
    other: 0,
    advanced: 0,
    errors: [],
  };

  const { data: settings } = await supabase
    .from("biscuit_app_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (!settings) return { ...result, ok: false, skipped: "Settings row missing" };

  const authed = await getAuthorizedGmail(supabase);
  if (!authed) return { ...result, skipped: "Gmail not connected" };
  if (!aiConfigured()) return { ...result, skipped: "ANTHROPIC_API_KEY not configured" };

  const { gmail, email: connectedEmail } = authed;

  // List recent inbox messages
  const { data: list } = await gmail.users.messages.list({
    userId: "me",
    q: "in:inbox newer_than:60d",
    maxResults: 50,
  });
  const ids = (list.messages ?? []).map((m) => m.id!).filter(Boolean);

  // Skip anything we've already processed
  let newIds = ids;
  if (ids.length) {
    const { data: seen } = await supabase
      .from("biscuit_emails")
      .select("gmail_message_id")
      .in("gmail_message_id", ids);
    const seenSet = new Set((seen ?? []).map((e) => e.gmail_message_id));
    newIds = ids.filter((id) => !seenSet.has(id));
  }

  const labelId = newIds.length ? await ensureProcessedLabel(gmail) : null;
  const openCases = newIds.length ? await loadOpenCases(supabase) : [];

  for (const id of newIds) {
    result.scanned++;
    try {
      const { data: full } = await gmail.users.messages.get({ userId: "me", id, format: "full" });
      const msg = parseMessage(full);

      // Ignore our own outbound mail that lands back in the inbox
      if (extractEmailAddress(msg.from) === connectedEmail.toLowerCase()) {
        await supabase.from("biscuit_emails").insert({
          gmail_message_id: msg.id,
          gmail_thread_id: msg.threadId,
          kind: "other",
          from_address: msg.from,
          to_addresses: msg.to,
          subject: msg.subject,
          snippet: msg.bodyText.slice(0, 200),
          received_at: msg.date,
        });
        continue;
      }

      const analysis = await analyzeInboundEmail(
        {
          from: msg.from,
          to: msg.to,
          subject: msg.subject,
          bodyText: msg.bodyText,
          hasAttachments: msg.attachments.length > 0,
          attachmentNames: msg.attachments.map((a) => a.filename),
        },
        { paccSenders: settings.pacc_sender_emails ?? [], openCases }
      );

      let caseId: string | null = null;
      if (analysis.kind === "case_request" && analysis.caseRequest) {
        caseId = await handleCaseRequest(
          gmail,
          supabase,
          connectedEmail,
          settings,
          msg,
          analysis.caseRequest,
          result
        );
      } else if (analysis.kind === "receipt" && analysis.receipt) {
        await handleReceipt(gmail, supabase, connectedEmail, settings, msg, analysis.receipt, result);
        caseId = analysis.receipt.matchedCaseId;
      } else {
        result.other++;
      }

      await supabase.from("biscuit_emails").insert({
        case_id: caseId,
        gmail_message_id: msg.id,
        gmail_thread_id: msg.threadId,
        kind: analysis.kind,
        from_address: msg.from,
        to_addresses: msg.to,
        subject: msg.subject,
        snippet: msg.bodyText.slice(0, 200),
        body_text: msg.bodyText.slice(0, 20000),
        received_at: msg.date,
      });

      if (labelId) {
        await gmail.users.messages
          .modify({ userId: "me", id, requestBody: { addLabelIds: [labelId] } })
          .catch(() => {});
      }
    } catch (e) {
      result.errors.push(`message ${id}: ${e instanceof Error ? e.message : e}`);
    }
  }

  // Watch for drafts Chelsea has sent since last sync
  try {
    await detectSentIntros(gmail, supabase, result);
  } catch (e) {
    result.errors.push(`sent detection: ${e instanceof Error ? e.message : e}`);
  }

  await supabase
    .from("biscuit_app_settings")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", 1);

  return result;
}
