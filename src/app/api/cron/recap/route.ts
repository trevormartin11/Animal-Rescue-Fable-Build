import { NextResponse } from "next/server";
import { createSystemClient } from "@/lib/supabase/system";
import { sendMonthlyRecap } from "@/lib/recap";

export const maxDuration = 300;

/**
 * Runs on the 1st of each month: sends the recap for the month that just ended,
 * if auto-send is enabled in Settings.
 */
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const supabase = await createSystemClient();

    const { data: settings } = await supabase
      .from("biscuit_app_settings")
      .select("monthly_recap_enabled")
      .eq("id", 1)
      .single();
    if (!settings?.monthly_recap_enabled) {
      return NextResponse.json({ ok: false, reason: "Auto recap disabled" });
    }

    const lastMonth = new Date();
    lastMonth.setDate(0); // last day of previous month
    const result = await sendMonthlyRecap(supabase, lastMonth);
    return NextResponse.json(result);
  } catch (e) {
    console.error("Cron recap failed:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export const POST = GET;
