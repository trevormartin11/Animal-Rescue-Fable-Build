import { NextResponse } from "next/server";
import { createSystemClient } from "@/lib/supabase/system";
import { syncInbox } from "@/lib/gmail/sync";

export const maxDuration = 300;

function authorized(request: Request): boolean {
  const header = request.headers.get("authorization");
  return header === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const supabase = await createSystemClient();
    const result = await syncInbox(supabase);
    return NextResponse.json(result);
  } catch (e) {
    console.error("Cron sync failed:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export const POST = GET;
