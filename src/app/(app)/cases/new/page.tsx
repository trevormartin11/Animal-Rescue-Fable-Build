"use client";

import { useActionState } from "react";
import { createCaseFromText } from "@/app/actions/cases";
import { PageHeader } from "@/components/ui";

export default function NewCasePage() {
  const [state, formAction, pending] = useActionState(createCaseFromText, null);

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="New case"
        sub="Paste the request email (or your notes from a call) and Biscuit will pull out the details."
      />

      <form action={formAction} className="space-y-4">
        <div className="bg-surface border border-line rounded-2xl shadow-card p-5 space-y-4">
          <div>
            <label htmlFor="from" className="block text-sm font-bold text-ink-soft mb-1">
              Who sent it? <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="from"
              name="from"
              type="text"
              placeholder="e.g. Bari — bari@pacc911.org"
              className="w-full rounded-xl border border-line bg-white px-4 py-2.5 outline-none focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="text" className="block text-sm font-bold text-ink-soft mb-1">
              Request text
            </label>
            <textarea
              id="text"
              name="text"
              required
              rows={12}
              placeholder={`Paste the full email here…\n\ne.g. "Hi Chelsea, we have a sweet 8-year-old terrier named Peanut who needs dental surgery. The estimate from Desert Paws Vet is about $1,400. The owner is Maria Lopez (maria@email.com, 602-555-0134)…"`}
              className="w-full rounded-xl border border-line bg-white px-4 py-3 outline-none focus:border-accent text-sm leading-relaxed"
            />
          </div>
          {state?.error ? (
            <p className="text-sm font-semibold text-denied bg-denied-soft rounded-xl px-4 py-2.5">
              {state.error}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-accent px-5 py-2.5 font-bold text-white transition-colors hover:bg-accent-deep disabled:opacity-60"
          >
            {pending ? "Reading the request…" : "Create case"}
          </button>
          <p className="text-sm text-muted">
            The owner reply draft is queued automatically, just like an emailed request.
          </p>
        </div>
      </form>
    </div>
  );
}
