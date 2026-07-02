import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { getAuthUrl, gmailConfigured } from "@/lib/gmail/client";

export async function GET(request: Request) {
  if (!gmailConfigured()) {
    return NextResponse.redirect(new URL("/settings?error=google_not_configured", request.url));
  }
  const state = crypto.randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("gmail_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return NextResponse.redirect(getAuthUrl(state));
}
