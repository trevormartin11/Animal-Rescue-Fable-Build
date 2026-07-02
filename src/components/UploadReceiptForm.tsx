"use client";

import { useActionState, useRef, useEffect } from "react";
import { Upload } from "lucide-react";

type UploadState = { error?: string; ok?: boolean } | null;

export function UploadReceiptForm({
  caseId,
  action,
}: {
  caseId: string;
  action: (prev: UploadState, formData: FormData) => Promise<UploadState>;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="rounded-xl border border-dashed border-line p-4 space-y-3">
      <input type="hidden" name="case_id" value={caseId} />
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="file"
          required
          accept="image/*,application/pdf"
          className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-accent-soft file:px-4 file:py-1.5 file:text-sm file:font-bold file:text-accent-deep hover:file:bg-accent-soft/70"
        />
        <input
          type="text"
          name="amount"
          placeholder="Amount (optional)"
          className="w-36 rounded-xl border border-line bg-white px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-sm font-bold text-white hover:bg-accent-deep transition-colors disabled:opacity-60"
        >
          <Upload size={14} />
          {pending ? "Uploading…" : "Upload receipt"}
        </button>
      </div>
      <p className="text-xs text-muted">
        Screenshots and PDFs are filed with this case and staged — you approve the amount before anything goes to Dext.
      </p>
      {state?.error ? <p className="text-xs font-semibold text-denied">{state.error}</p> : null}
      {state?.ok ? <p className="text-xs font-semibold text-leaf">Receipt filed — approve it below to send to Dext ✓</p> : null}
    </form>
  );
}
