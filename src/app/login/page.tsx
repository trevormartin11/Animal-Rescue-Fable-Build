"use client";

import { useActionState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { login } from "@/app/actions/auth";
import { BiscuitLogo } from "@/components/BiscuitLogo";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className="block text-sm font-bold text-ink-soft mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-xl border border-line bg-white px-4 py-2.5 outline-none focus:border-accent"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-bold text-ink-soft mb-1">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-xl border border-line bg-white px-4 py-2.5 outline-none focus:border-accent"
          placeholder="••••••••"
        />
      </div>
      {state?.error ? (
        <p className="text-sm font-semibold text-denied bg-denied-soft rounded-xl px-4 py-2.5">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-accent px-4 py-3 font-bold text-white transition-colors hover:bg-accent-deep disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <BiscuitLogo size={64} />
          <h1 className="mt-3 text-4xl font-semibold">Biscuit</h1>
          <p className="mt-1 text-sm text-ink-soft text-center">
            Rescue giving, handled — for the Rowley Family Charitable Giving Trust
          </p>
        </div>
        <div className="bg-surface border border-line rounded-2xl shadow-card p-6">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-4 text-center text-xs text-muted">
          Access is by invitation — ask Chelsea to add you in Settings.
        </p>
      </div>
    </main>
  );
}
