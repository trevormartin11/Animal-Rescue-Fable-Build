"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizedGmail } from "@/lib/gmail/client";
import { createOwnerGmailDraft } from "@/lib/gmail/sync";
import { analyzeInboundEmail } from "@/lib/ai/analyze";
import { aiConfigured } from "@/lib/ai/client";
import type { CaseStatus } from "@/lib/types";

async function log(caseId: string | null, event: string, detail?: string) {
  const supabase = await createClient();
  await supabase.from("biscuit_activity_log").insert({ case_id: caseId, event, detail: detail ?? null });
}

const STATUS_TIMESTAMPS: Partial<Record<CaseStatus, string>> = {
  accepted: "accepted_at",
  owner_contacted: "owner_contacted_at",
  vet_account_set: "vet_account_set_at",
  paid: "paid_at",
  closed: "closed_at",
};

export async function updateCaseStatus(caseId: string, status: CaseStatus) {
  const supabase = await createClient();
  const update: Record<string, unknown> = { status };
  const tsField = STATUS_TIMESTAMPS[status];
  if (tsField) update[tsField] = new Date().toISOString();

  const { error } = await supabase.from("biscuit_cases").update(update).eq("id", caseId);
  if (!error) {
    await log(caseId, `status_${status}`, `Status set to ${status}`);
  }
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
  revalidatePath("/");
}

export async function denyCase(caseId: string, formData: FormData) {
  const reason = String(formData.get("reason") ?? "").trim();
  const supabase = await createClient();

  const { error } = await supabase
    .from("biscuit_cases")
    .update({
      status: "denied",
      denial_reason: reason || null,
      denied_at: new Date().toISOString(),
    })
    .eq("id", caseId);

  if (!error) {
    await log(caseId, "status_denied", reason || "No reason recorded");
    // Clean up the queued Gmail draft if it's still sitting there
    const { data: c } = await supabase
      .from("biscuit_cases")
      .select("draft_gmail_id")
      .eq("id", caseId)
      .single();
    if (c?.draft_gmail_id) {
      const authed = await getAuthorizedGmail(supabase);
      if (authed) {
        await authed.gmail.users.drafts
          .delete({ userId: "me", id: c.draft_gmail_id })
          .catch(() => {});
      }
      await supabase.from("biscuit_cases").update({ draft_gmail_id: null }).eq("id", caseId);
    }
  }
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
  revalidatePath("/");
}

export async function updateCaseDetails(caseId: string, formData: FormData) {
  const supabase = await createClient();
  const num = (v: FormDataEntryValue | null) => {
    const s = String(v ?? "").replace(/[$,]/g, "").trim();
    return s ? Number(s) : null;
  };
  const str = (v: FormDataEntryValue | null) => {
    const s = String(v ?? "").trim();
    return s || null;
  };

  await supabase
    .from("biscuit_cases")
    .update({
      animal_name: str(formData.get("animal_name")),
      species: str(formData.get("species")),
      breed: str(formData.get("breed")),
      situation: str(formData.get("situation")),
      amount: num(formData.get("amount")),
      vet_name: str(formData.get("vet_name")),
      vet_phone: str(formData.get("vet_phone")),
    })
    .eq("id", caseId);

  await log(caseId, "case_updated", "Case details edited");
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
}

export async function regenerateDraft(caseId: string) {
  const supabase = await createClient();

  const { data: c } = await supabase
    .from("biscuit_cases")
    .select("*, owners:biscuit_owners(name, email)")
    .eq("id", caseId)
    .single();
  if (!c) return;
  const owner = Array.isArray(c.owners) ? c.owners[0] : c.owners;
  if (!owner?.email) {
    await log(caseId, "draft_failed", "Owner has no email address");
    revalidatePath(`/cases/${caseId}`);
    return;
  }

  const { data: settings } = await supabase.from("biscuit_app_settings").select("*").eq("id", 1).single();
  const authed = await getAuthorizedGmail(supabase);
  if (!authed || !settings) {
    await log(caseId, "draft_failed", "Gmail is not connected");
    revalidatePath(`/cases/${caseId}`);
    return;
  }

  // Remove the previous draft if it still exists
  if (c.draft_gmail_id) {
    await authed.gmail.users.drafts
      .delete({ userId: "me", id: c.draft_gmail_id })
      .catch(() => {});
  }

  await createOwnerGmailDraft(authed.gmail, supabase, authed.email, settings, caseId, {
    ownerEmail: owner.email,
    animalName: c.animal_name,
    species: c.species,
    breed: c.breed,
    situation: c.situation,
    amount: c.amount != null ? Number(c.amount) : null,
    ownerName: owner.name,
    vetName: c.vet_name,
  });

  revalidatePath(`/cases/${caseId}`);
}

/**
 * Manual intake: paste the text of a request email (or notes from a call)
 * and Biscuit extracts the case exactly like the inbox sync would.
 */
export async function createCaseFromText(
  _prev: { error?: string } | null,
  formData: FormData
) {
  const text = String(formData.get("text") ?? "").trim();
  const from = String(formData.get("from") ?? "").trim() || "(pasted manually)";
  if (text.length < 20) {
    return { error: "Paste the full request text — that looks too short to parse." };
  }
  if (!aiConfigured()) {
    return { error: "AI is not configured (ANTHROPIC_API_KEY missing), so parsing is unavailable." };
  }

  const supabase = await createClient();
  const { data: settings } = await supabase.from("biscuit_app_settings").select("*").eq("id", 1).single();

  let analysis;
  try {
    analysis = await analyzeInboundEmail(
      { from, to: "", subject: "(manually entered request)", bodyText: text },
      { paccSenders: settings?.pacc_sender_emails ?? [], openCases: [] }
    );
  } catch (e) {
    return { error: `Couldn't analyze the text: ${e instanceof Error ? e.message : e}` };
  }

  const req = analysis.caseRequest;
  if (!req) {
    return {
      error:
        "That doesn't look like a case request. If it really is one, add a bit more context and try again.",
    };
  }

  let ownerId: string | null = null;
  if (req.ownerName || req.ownerEmail) {
    const email = req.ownerEmail?.toLowerCase() ?? null;
    if (email) {
      const { data: existing } = await supabase
        .from("biscuit_owners")
        .select("id")
        .ilike("email", email)
        .maybeSingle();
      if (existing) ownerId = existing.id;
    }
    if (!ownerId) {
      const { data: created } = await supabase
        .from("biscuit_owners")
        .insert({ name: req.ownerName || req.ownerEmail || "Unknown owner", email, phone: req.ownerPhone })
        .select("id")
        .single();
      ownerId = created?.id ?? null;
    }
  }

  const { data: newCase, error } = await supabase
    .from("biscuit_cases")
    .insert({
      owner_id: ownerId,
      animal_name: req.animalName,
      species: req.species,
      breed: req.breed,
      situation: req.situation,
      amount: req.amount,
      vet_name: req.vetName,
      vet_phone: req.vetPhone,
      status: "new",
      source: "manual",
    })
    .select("id")
    .single();
  if (error || !newCase) return { error: `Couldn't save the case: ${error?.message}` };

  await log(newCase.id, "case_created", "Created from pasted text");

  // Queue the Gmail draft too, if everything's connected
  if (req.ownerEmail && settings) {
    const authed = await getAuthorizedGmail(supabase);
    if (authed) {
      try {
        await createOwnerGmailDraft(authed.gmail, supabase, authed.email, settings, newCase.id, {
          ownerEmail: req.ownerEmail,
          animalName: req.animalName,
          species: req.species,
          breed: req.breed,
          situation: req.situation,
          amount: req.amount,
          ownerName: req.ownerName,
          vetName: req.vetName,
        });
      } catch {
        await log(newCase.id, "draft_failed", "Draft generation failed — retry from the case page");
      }
    }
  }

  revalidatePath("/cases");
  revalidatePath("/");
  redirect(`/cases/${newCase.id}`);
}

export async function updateOwner(ownerId: string, formData: FormData) {
  const supabase = await createClient();
  const str = (v: FormDataEntryValue | null) => {
    const s = String(v ?? "").trim();
    return s || null;
  };
  await supabase
    .from("biscuit_owners")
    .update({
      name: str(formData.get("name")) ?? "Unknown owner",
      email: str(formData.get("email"))?.toLowerCase() ?? null,
      phone: str(formData.get("phone")),
      notes: str(formData.get("notes")),
    })
    .eq("id", ownerId);
  revalidatePath(`/owners/${ownerId}`);
  revalidatePath("/owners");
}
