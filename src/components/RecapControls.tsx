"use client";

import { useState, useTransition } from "react";
import { Eye, Send, X } from "lucide-react";
import { previewRecap, sendRecapNow, type RecapPreview } from "@/app/actions/settings";

export function RecapControls() {
  const [previewPending, startPreview] = useTransition();
  const [sendPending, startSend] = useTransition();
  const [preview, setPreview] = useState<RecapPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const runPreview = () => {
    setMessage(null);
    startPreview(async () => {
      try {
        const result = await previewRecap();
        if (result.ok) setPreview(result);
        else setMessage(result.reason ?? "Couldn't build the preview");
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Couldn't build the preview");
      }
    });
  };

  const runSend = () => {
    if (!confirm("Send the family recap email for last month now?")) return;
    setMessage(null);
    startSend(async () => {
      try {
        const result = await sendRecapNow();
        setMessage(
          result.ok ? `Sent to ${result.sentTo?.join(", ")}` : result.reason ?? "Couldn't send"
        );
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Couldn't send");
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={runPreview}
          disabled={previewPending}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-sm font-bold text-ink hover:bg-accent-soft/50 transition-colors disabled:opacity-60"
        >
          <Eye size={14} />
          {previewPending ? "Writing preview…" : "See preview"}
        </button>
        <button
          onClick={runSend}
          disabled={sendPending}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-deep transition-colors disabled:opacity-60"
        >
          <Send size={14} />
          {sendPending ? "Writing & sending…" : "Send last month's recap now"}
        </button>
        {message ? <span className="text-xs font-semibold text-ink-soft">{message}</span> : null}
      </div>

      {preview?.ok && (
        <div className="rounded-xl border border-line bg-cream p-4 relative">
          <button
            onClick={() => setPreview(null)}
            className="absolute right-3 top-3 text-muted hover:text-ink transition-colors"
            title="Close preview"
          >
            <X size={16} />
          </button>
          <div className="text-[13px] font-bold uppercase tracking-wide text-muted mb-1">
            Preview — nothing has been sent
          </div>
          <div className="text-sm font-bold mb-0.5">{preview.subject}</div>
          <div className="text-xs text-muted mb-3">
            To:{" "}
            {preview.recipients?.length
              ? preview.recipients.join(", ")
              : "no family recipients set yet — add them in Settings"}
          </div>
          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft font-body">
            {preview.text}
          </pre>
        </div>
      )}
    </div>
  );
}
