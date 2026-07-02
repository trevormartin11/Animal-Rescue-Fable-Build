import { google, gmail_v1 } from "googleapis";
import type { DbClient } from "@/lib/supabase/types";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify", // read, drafts, send, labels
];

export function gmailConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function getRedirectUri(): string {
  return `${process.env.APP_URL}/api/gmail/oauth/callback`;
}

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getRedirectUri()
  );
}

export function getAuthUrl(state: string): string {
  const oauth2 = createOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // always get a refresh token
    scope: GMAIL_SCOPES,
    state,
  });
}

/**
 * Build an authorized Gmail API client from the tokens stored in the DB.
 * Refreshed access tokens are persisted back automatically.
 */
export async function getAuthorizedGmail(
  supabase: DbClient
): Promise<{ gmail: gmail_v1.Gmail; email: string } | null> {
  const { data: tokens } = await supabase
    .from("biscuit_gmail_tokens")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (!tokens?.refresh_token || !gmailConfigured()) return null;

  const oauth2 = createOAuth2Client();
  oauth2.setCredentials({
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token ?? undefined,
    expiry_date: tokens.access_token_expires_at
      ? new Date(tokens.access_token_expires_at).getTime()
      : undefined,
  });

  oauth2.on("tokens", async (newTokens) => {
    const update: Record<string, unknown> = {};
    if (newTokens.access_token) {
      update.access_token = newTokens.access_token;
      update.access_token_expires_at = newTokens.expiry_date
        ? new Date(newTokens.expiry_date).toISOString()
        : null;
    }
    if (newTokens.refresh_token) update.refresh_token = newTokens.refresh_token;
    if (Object.keys(update).length) {
      await supabase.from("biscuit_gmail_tokens").update(update).eq("id", 1);
    }
  });

  return {
    gmail: google.gmail({ version: "v1", auth: oauth2 }),
    email: tokens.email ?? "",
  };
}
