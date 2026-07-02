"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { sendRecapNow } from "@/app/actions/settings";

export function SendRecapButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const run = () => {
    if (!confirm("Send the family recap email for last month now?")) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await sendRecapNow();
        setMessage(
          result.ok
            ? `Sent to ${result.sentTo?.join(", ")}`
            : result.reason ?? "Couldn't send"
        );
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Couldn't send");
      }
    });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={run}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-deep transition-colors disabled:opacity-60"
      >
        <Send size={14} />
        {pending ? "Writing & sending…" : "Send last month's recap now"}
      </button>
      {message ? <span className="text-xs font-semibold text-ink-soft">{message}</span> : null}
    </div>
  );
}
