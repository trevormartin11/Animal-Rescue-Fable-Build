"use client";

import { useActionState } from "react";
import { addAppUser } from "@/app/actions/settings";

export function AddUserForm() {
  const [state, formAction, pending] = useActionState(addAppUser, null);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 text-sm">
      <label>
        <span className="block font-bold text-ink-soft mb-1">Email</span>
        <input
          name="email"
          type="email"
          required
          placeholder="family@example.com"
          className="rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-accent w-56"
        />
      </label>
      <label>
        <span className="block font-bold text-ink-soft mb-1">Name</span>
        <input
          name="name"
          type="text"
          placeholder="Optional"
          className="rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-accent w-36"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-surface border border-line px-4 py-2 font-bold hover:bg-accent-soft/50 transition-colors disabled:opacity-60"
      >
        {pending ? "Adding…" : "Allow access"}
      </button>
      {state?.error ? <span className="text-xs font-semibold text-denied">{state.error}</span> : null}
      {state?.ok ? <span className="text-xs font-semibold text-leaf">Added ✓</span> : null}
    </form>
  );
}
