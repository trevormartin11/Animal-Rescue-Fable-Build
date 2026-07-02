import type { gmail_v1 } from "googleapis";

export interface ParsedMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string | null;
  bodyText: string;
  attachments: { attachmentId: string; filename: string; contentType: string; size: number }[];
}

function header(payload: gmail_v1.Schema$MessagePart | undefined, name: string): string {
  return (
    payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ""
  );
}

function decodeBody(data: string | null | undefined): string {
  if (!data) return "";
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Extract a plain-text body, preferring text/plain parts, falling back to stripped HTML. */
function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";

  let plain = "";
  let html = "";

  const walk = (part: gmail_v1.Schema$MessagePart) => {
    if (part.mimeType === "text/plain" && part.body?.data) {
      plain += decodeBody(part.body.data) + "\n";
    } else if (part.mimeType === "text/html" && part.body?.data) {
      html += decodeBody(part.body.data);
    }
    part.parts?.forEach(walk);
  };
  walk(payload);

  return (plain.trim() || stripHtml(html)).trim();
}

function collectAttachments(
  payload: gmail_v1.Schema$MessagePart | undefined
): ParsedMessage["attachments"] {
  const out: ParsedMessage["attachments"] = [];
  const walk = (part: gmail_v1.Schema$MessagePart) => {
    if (part.filename && part.body?.attachmentId) {
      out.push({
        attachmentId: part.body.attachmentId,
        filename: part.filename,
        contentType: part.mimeType ?? "application/octet-stream",
        size: part.body.size ?? 0,
      });
    }
    part.parts?.forEach(walk);
  };
  if (payload) walk(payload);
  return out;
}

export function parseMessage(msg: gmail_v1.Schema$Message): ParsedMessage {
  const payload = msg.payload;
  return {
    id: msg.id!,
    threadId: msg.threadId!,
    from: header(payload, "From"),
    to: header(payload, "To"),
    subject: header(payload, "Subject"),
    date: msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : null,
    bodyText: extractBody(payload),
    attachments: collectAttachments(payload),
  };
}

/** "Jane Doe <jane@x.com>" -> "jane@x.com" */
export function extractEmailAddress(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  return (match ? match[1] : fromHeader).trim().toLowerCase();
}
