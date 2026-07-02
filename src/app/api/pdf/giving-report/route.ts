import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { computeGivingStats, givingDate, fetchGivenCases } from "@/lib/data/stats";
import { GivingReportDocument, type ReportCase } from "@/lib/pdf/giving-report";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year")) || new Date().getFullYear();

  const stats = await computeGivingStats(supabase, new Date(year, 11, 31));
  const given = await fetchGivenCases(supabase);

  // Owner names for the case table
  const { data: casesWithOwners } = await supabase
    .from("biscuit_cases")
    .select("id, owners:biscuit_owners(name)")
    .in("status", ["paid", "closed"]);
  const ownerById = new Map(
    (casesWithOwners ?? []).map((c) => {
      const owner = Array.isArray(c.owners) ? c.owners[0] : c.owners;
      return [c.id, owner?.name ?? "—"];
    })
  );

  const cases: ReportCase[] = given
    .filter((c) => givingDate(c).getFullYear() === year)
    .sort((a, b) => givingDate(a).getTime() - givingDate(b).getTime())
    .map((c) => ({
      date: formatDate(givingDate(c).toISOString()),
      animal: [c.animal_name ?? "Unnamed", c.species].filter(Boolean).join(", "),
      owner: ownerById.get(c.id) ?? "—",
      situation: (c.situation ?? "").slice(0, 140),
      amount: c.amount != null ? Number(c.amount) : null,
    }));

  const buffer = await renderToBuffer(GivingReportDocument({ year, stats, cases }));

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rowley-giving-report-${year}.pdf"`,
    },
  });
}
