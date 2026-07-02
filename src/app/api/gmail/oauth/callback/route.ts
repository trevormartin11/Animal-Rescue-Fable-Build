import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { google } from "googleapis";
import { createOAuth2Client } from "@/lib/gmail/client";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("gmail_oauth_state")?.value;
  cookieStore.delete("gmail_oauth_state");

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(reason)}`, process.env.APP_URL));

  if (!code || !state || state !== expectedState) return fail("oauth_state_mismatch");

  // Only a logged-in app user may connect the mailbox
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("not_signed_in");

  try {
    const oauth2 = createOAuth2Client();
    const { tokens } = await oauth2.getToken(code);
    if (!tokens.refresh_token) return fail("no_refresh_token");

    oauth2.setCredentials(tokens);
    const gmail = google.gmail({ version: "v1", auth: oauth2 });
    const { data: profile } = await gmail.users.getProfile({ userId: "me" });
    const email = profile.emailAddress ?? null;

    const tokenRow = {
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token ?? null,
      access_token_expires_at: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : null,
      email,
    };
    const { data: updated } = await supabase
      .from("biscuit_gmail_tokens")
      .update(tokenRow)
      .eq("id", 1)
      .select("id");
    if (!updated?.length) {
      await supabase.from("biscuit_gmail_tokens").insert({ id: 1, ...tokenRow });
    }
    await supabase.from("biscuit_app_settings").update({ gmail_connected_email: email }).eq("id", 1);

    return NextResponse.redirect(new URL("/settings?connected=1", process.env.APP_URL));
  } catch (e) {
    console.error("Gmail OAuth callback failed:", e);
    return fail("token_exchange_failed");
  }
}
