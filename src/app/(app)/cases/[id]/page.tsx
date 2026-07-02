import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ExternalLink,
  Mail,
  Phone,
  RefreshCw,
  Stethoscope,
  User,
  FileText,
  Camera,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { formatMoney, formatDate, formatDateTime } from "@/lib/format";
import { denyCase, regenerateDraft, updateCaseDetails, updateCaseStatus } from "@/app/actions/cases";
import { uploadReceipt } from "@/app/actions/receipts";
import { UploadReceiptForm } from "@/components/UploadReceiptForm";
import { STATUS_FLOW, STATUS_LABELS, NEXT_ACTION, type CaseStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: c } = await supabase
    .from("biscuit_cases")
    .select("*, owners:biscuit_owners(*)")
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();
  const owner = Array.isArray(c.owners) ? c.owners[0] : c.owners;

  const [receiptsRes, photosRes, activityRes, emailRes] = await Promise.all([
    supabase.from("biscuit_receipts").select("*").eq("case_id", id).order("received_at", { ascending: false }),
    supabase.from("biscuit_case_photos").select("*").eq("case_id", id),
    supabase
      .from("biscuit_activity_log")
      .select("*")
      .eq("case_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("biscuit_emails").select("*").eq("case_id", id).eq("kind", "case_request").maybeSingle(),
  ]);
  const receipts = receiptsRes.data ?? [];
  const photos = photosRes.data ?? [];
  const activity = activityRes.data ?? [];
  const sourceEmail = emailRes.data;

  const status = c.status as CaseStatus;
  const isOpen = status !== "closed" && status !== "denied";
  const flowIndex = STATUS_FLOW.indexOf(status);
  const nextStatus = isOpen && flowIndex >= 0 && flowIndex < STATUS_FLOW.length - 1
    ? STATUS_FLOW[flowIndex + 1]
    : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-semibold">{c.animal_name ?? "Unnamed animal"}</h1>
            <StatusBadge status={status} />
          </div>
          <p className="mt-1 text-ink-soft">
            {[c.breed, c.species].filter(Boolean).join(" ") || "animal"} · requested{" "}
            {formatDate(c.requested_at)}
            {c.source === "manual" ? " · entered manually" : ""}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold font-display">
            {formatMoney(c.amount != null ? Number(c.amount) : null)}
          </div>
          <div className="text-xs text-muted">approx. cost</div>
        </div>
      </div>

      {/* What's next + status controls */}
      {isOpen && (
        <Card className="border-accent/40">
          <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-bold uppercase tracking-wide text-muted">
                Next step
              </div>
              <div className="mt-0.5 font-semibold">{NEXT_ACTION[status]}</div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {status === "new" && (
                <a
                  href="https://mail.google.com/mail/u/0/#drafts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-deep transition-colors"
                >
                  <Mail size={15} /> Open Gmail drafts <ExternalLink size={13} />
                </a>
              )}
              {nextStatus && (
                <form action={updateCaseStatus.bind(null, c.id, nextStatus)}>
                  <SubmitButton variant={status === "new" ? "secondary" : "primary"}>
                    Mark {STATUS_LABELS[nextStatus].toLowerCase()}
                  </SubmitButton>
                </form>
              )}
              <details className="relative">
                <summary className="list-none cursor-pointer inline-flex items-center rounded-full border border-line bg-surface px-4 py-2 text-sm font-bold text-denied hover:bg-denied-soft/50 transition-colors">
                  Deny…
                </summary>
                <form
                  action={denyCase.bind(null, c.id)}
                  className="absolute right-0 z-10 mt-2 w-72 rounded-2xl border border-line bg-surface p-4 shadow-card space-y-3"
                >
                  <label className="block text-sm font-bold text-ink-soft">
                    Why are we passing on this one?
                  </label>
                  <textarea
                    name="reason"
                    rows={3}
                    className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent"
                    placeholder="Reason (kept for the record)"
                  />
                  <p className="text-xs text-muted">
                    This deletes the queued Gmail draft. Chelsea handles the denial reply herself.
                  </p>
                  <SubmitButton variant="danger" pendingText="Denying…">
                    Deny case
                  </SubmitButton>
                </form>
              </details>
            </div>
          </div>
        </Card>
      )}

      {status === "denied" && (
        <Card className="border-denied/40 bg-denied-soft/40">
          <div className="px-5 py-4 text-sm">
            <span className="font-bold text-denied">Denied {formatDate(c.denied_at)}.</span>{" "}
            <span className="text-ink-soft">{c.denial_reason || "No reason recorded."}</span>
            <form action={updateCaseStatus.bind(null, c.id, "new")} className="mt-2">
              <SubmitButton variant="secondary" pendingText="Reopening…">
                Reopen case
              </SubmitButton>
            </form>
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-5 items-start">
        {/* Left column */}
        <div className="space-y-5">
          {/* Owner */}
          <Card>
            <CardHeader
              title="Owner"
              action={
                owner ? (
                  <Link href={`/owners/${owner.id}`} className="text-sm font-bold text-accent-deep hover:underline">
                    History
                  </Link>
                ) : null
              }
            />
            <div className="px-5 pb-4 text-sm space-y-1.5">
              {owner ? (
                <>
                  <div className="flex items-center gap-2 font-semibold">
                    <User size={15} className="text-muted" /> {owner.name}
                  </div>
                  {owner.email && (
                    <div className="flex items-center gap-2 text-ink-soft">
                      <Mail size={15} className="text-muted" />
                      <a href={`mailto:${owner.email}`} className="hover:underline">{owner.email}</a>
                    </div>
                  )}
                  {owner.phone && (
                    <div className="flex items-center gap-2 text-ink-soft">
                      <Phone size={15} className="text-muted" />
                      <a href={`tel:${owner.phone}`} className="hover:underline">{owner.phone}</a>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted">No owner recorded — edit the case to add one later.</p>
              )}
              {(c.vet_name || c.vet_phone) && (
                <div className="flex items-center gap-2 text-ink-soft pt-1.5 border-t border-line mt-2">
                  <Stethoscope size={15} className="text-muted" />
                  {c.vet_name}
                  {c.vet_phone ? <a href={`tel:${c.vet_phone}`} className="hover:underline">· {c.vet_phone}</a> : null}
                </div>
              )}
            </div>
          </Card>

          {/* Situation + edit */}
          <Card>
            <CardHeader title="The situation" />
            <div className="px-5 pb-4 space-y-3">
              <p className="text-sm leading-relaxed text-ink-soft">
                {c.situation ?? "No summary yet."}
              </p>
              <details>
                <summary className="cursor-pointer text-sm font-bold text-accent-deep hover:underline">
                  Edit details
                </summary>
                <form action={updateCaseDetails.bind(null, c.id)} className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <label className="col-span-1">
                    <span className="block font-bold text-ink-soft mb-1">Animal name</span>
                    <input name="animal_name" defaultValue={c.animal_name ?? ""} className="w-full rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-accent" />
                  </label>
                  <label className="col-span-1">
                    <span className="block font-bold text-ink-soft mb-1">Amount ($)</span>
                    <input name="amount" defaultValue={c.amount ?? ""} className="w-full rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-accent" />
                  </label>
                  <label className="col-span-1">
                    <span className="block font-bold text-ink-soft mb-1">Species</span>
                    <input name="species" defaultValue={c.species ?? ""} className="w-full rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-accent" />
                  </label>
                  <label className="col-span-1">
                    <span className="block font-bold text-ink-soft mb-1">Breed</span>
                    <input name="breed" defaultValue={c.breed ?? ""} className="w-full rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-accent" />
                  </label>
                  <label className="col-span-2">
                    <span className="block font-bold text-ink-soft mb-1">Situation</span>
                    <textarea name="situation" rows={3} defaultValue={c.situation ?? ""} className="w-full rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-accent" />
                  </label>
                  <label className="col-span-1">
                    <span className="block font-bold text-ink-soft mb-1">Vet clinic</span>
                    <input name="vet_name" defaultValue={c.vet_name ?? ""} className="w-full rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-accent" />
                  </label>
                  <label className="col-span-1">
                    <span className="block font-bold text-ink-soft mb-1">Vet phone</span>
                    <input name="vet_phone" defaultValue={c.vet_phone ?? ""} className="w-full rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-accent" />
                  </label>
                  <div className="col-span-2">
                    <SubmitButton pendingText="Saving…">Save details</SubmitButton>
                  </div>
                </form>
              </details>
            </div>
          </Card>

          {/* Photos */}
          {photos.length > 0 && (
            <Card>
              <CardHeader title={<span className="flex items-center gap-2"><Camera size={16} /> Photos</span>} />
              <div className="px-5 pb-4 flex flex-wrap gap-3">
                {photos.map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a key={p.id} href={`/api/files/biscuit-photos/${p.storage_path}`} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/files/biscuit-photos/${p.storage_path}`}
                      alt={p.filename ?? "case photo"}
                      className="h-28 w-28 rounded-xl object-cover border border-line"
                    />
                  </a>
                ))}
              </div>
            </Card>
          )}

          {/* Original email */}
          {sourceEmail?.body_text && (
            <Card>
              <CardHeader title="Original request email" />
              <div className="px-5 pb-4">
                <p className="text-xs text-muted mb-2">
                  From {sourceEmail.from_address} · {formatDateTime(sourceEmail.received_at)}
                </p>
                <pre className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft font-body max-h-72 overflow-y-auto bg-cream rounded-xl p-4 border border-line">
                  {sourceEmail.body_text}
                </pre>
              </div>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Draft */}
          <Card>
            <CardHeader
              title="Reply to the owner"
              action={
                isOpen && owner?.email ? (
                  <form action={regenerateDraft.bind(null, c.id)}>
                    <button className="inline-flex items-center gap-1.5 text-sm font-bold text-accent-deep hover:underline">
                      <RefreshCw size={14} /> Regenerate
                    </button>
                  </form>
                ) : null
              }
            />
            <div className="px-5 pb-4">
              {c.draft_body ? (
                <>
                  <p className="text-xs text-muted mb-2">
                    {c.draft_gmail_id
                      ? "Waiting in the Gmail drafts folder — review and send from there."
                      : c.owner_contacted_at
                        ? `Sent ${formatDate(c.owner_contacted_at)}.`
                        : "The Gmail draft is no longer queued."}
                  </p>
                  <div className="bg-cream rounded-xl border border-line p-4">
                    <div className="text-sm font-bold mb-2">{c.draft_subject}</div>
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft font-body">
                      {c.draft_body}
                    </pre>
                  </div>
                </>
              ) : owner?.email ? (
                <p className="text-sm text-muted">
                  No draft yet. {isOpen ? "Use Regenerate to queue one in Gmail." : ""}
                </p>
              ) : (
                <p className="text-sm text-muted">
                  Add the owner's email address to queue an intro draft.
                </p>
              )}
            </div>
          </Card>

          {/* Receipts */}
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><FileText size={16} /> Receipts</span>} />
            <div className="px-5 pb-4 space-y-3">
              {receipts.length === 0 ? (
                <p className="text-sm text-muted">
                  None yet. Emailed receipts are filed here automatically; screenshots can be uploaded below.
                </p>
              ) : (
                <ul className="space-y-2">
                  {receipts.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 rounded-xl border border-line bg-cream px-4 py-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        {r.storage_path ? (
                          <a
                            href={`/api/files/biscuit-receipts/${r.storage_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold hover:underline truncate block"
                          >
                            {r.filename ?? r.email_subject ?? "Receipt"}
                          </a>
                        ) : (
                          <span className="font-bold truncate block">{r.filename ?? r.email_subject ?? "Receipt"}</span>
                        )}
                        <div className="text-xs text-muted">
                          {formatDate(r.received_at)} · {r.source === "email" ? "emailed in" : "uploaded"}
                          {r.forwarded_to_dext_at
                            ? " · ✓ sent to Dext"
                            : r.forward_error
                              ? ` · Dext: ${r.forward_error}`
                              : ""}
                        </div>
                      </div>
                      {r.amount != null && <div className="font-bold shrink-0">{formatMoney(Number(r.amount))}</div>}
                    </li>
                  ))}
                </ul>
              )}
              <UploadReceiptForm caseId={c.id} action={uploadReceipt} />
            </div>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader title="Timeline" />
            {activity.length === 0 ? (
              <div className="px-5 pb-4 text-sm text-muted">Nothing logged yet.</div>
            ) : (
              <ul className="px-5 pb-4 space-y-2.5">
                {activity.map((a) => (
                  <li key={a.id} className="flex gap-3 text-sm">
                    <span className="text-xs text-muted shrink-0 w-24 pt-0.5">{formatDateTime(a.created_at)}</span>
                    <span className="text-ink-soft">{a.detail ?? a.event}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
