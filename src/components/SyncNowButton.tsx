"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { syncNow } from "@/app/actions/settings";

export function SyncNowButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const run = () => {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await syncNow();
        if (result.skipped) {
          setMessage(result.skipped);
        } else {
          const bits: string[] = [];
          if (result.newCases) bits.push(`${result.newCases} new case${result.newCases > 1 ? "s" : ""}`);
          if (result.receipts) bits.push(`${result.receipts} receipt${result.receipts > 1 ? "s" : ""}`);
          if (result.advanced) bits.push(`${result.advanced} updated`);
          if (result.errors.length) bits.push(`${result.errors.length} error${result.errors.length > 1 ? "s" : ""}`);
          setMessage(bits.length ? bits.join(", ") : "Inbox checked — nothing new");
        }
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Sync failed");
      }
      setTimeout(() => setMessage(null), 8000);
    });
  };

  return (
    <div className="flex items-center gap-2">
      {message ? (
        <span className="text-xs font-semibold text-ink-soft max-w-48 truncate" title={message}>
          {message}
        </span>
      ) : null}
      <button
        onClick={run}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-bold text-ink-soft transition-colors hover:bg-accent-soft/50 disabled:opacity-60"
        title="Check the inbox for new requests and receipts"
      >
        <RefreshCw size={15} className={pending ? "animate-spin" : ""} />
        {pending ? "Checking inbox…" : "Sync now"}
      </button>
    </div>
  );
}
