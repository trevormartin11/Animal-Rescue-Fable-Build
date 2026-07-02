export interface MimeAttachment {
  filename: string;
  contentType: string;
  data: Buffer;
}

export interface MimeMessage {
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  text: string;
  attachments?: MimeAttachment[];
}

function encodeHeader(value: string): string {
  // RFC 2047 encode if non-ASCII
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf-8").toString("base64")}?=`;
}

/** Build an RFC 2822 message and return it base64url-encoded for the Gmail API. */
export function buildRawMessage(msg: MimeMessage): string {
  const boundary = `biscuit_${Math.random().toString(36).slice(2)}`;
  const lines: string[] = [
    `From: ${msg.from}`,
    `To: ${msg.to}`,
    ...(msg.cc ? [`Cc: ${msg.cc}`] : []),
    ...(msg.bcc ? [`Bcc: ${msg.bcc}`] : []),
    `Subject: ${encodeHeader(msg.subject)}`,
    "MIME-Version: 1.0",
  ];

  if (msg.attachments?.length) {
    lines.push(
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(msg.text, "utf-8").toString("base64"),
    );
    for (const att of msg.attachments) {
      lines.push(
        `--${boundary}`,
        `Content-Type: ${att.contentType}; name="${att.filename}"`,
        "Content-Transfer-Encoding: base64",
        `Content-Disposition: attachment; filename="${att.filename}"`,
        "",
        att.data.toString("base64"),
      );
    }
    lines.push(`--${boundary}--`);
  } else {
    lines.push(
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(msg.text, "utf-8").toString("base64"),
    );
  }

  return Buffer.from(lines.join("\r\n"), "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
