"use client";

import { useActionState } from "react";
import { changePassword } from "@/app/actions/auth";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, null);

  return (
    <form action={formAction} className="grid grid-cols-2 gap-3 text-sm max-w-lg">
      <label className="col-span-1">
        <span className="block font-bold text-ink-soft mb-1">New password</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-accent"
        />
      </label>
      <label className="col-span-1">
        <span className="block font-bold text-ink-soft mb-1">Confirm</span>
        <input
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-accent"
        />
      </label>
      <div className="col-span-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-surface border border-line px-4 py-2 text-sm font-bold hover:bg-accent-soft/50 transition-colors disabled:opacity-60"
        >
          {pending ? "Updating…" : "Update password"}
        </button>
        {state?.ok ? <span className="text-xs font-semibold text-leaf">Password updated ✓</span> : null}
        {state?.error ? <span className="text-xs font-semibold text-denied">{state.error}</span> : null}
      </div>
    </form>
  );
}
