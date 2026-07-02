import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_BUCKETS = new Set(["biscuit-receipts", "biscuit-photos"]);

/** Serve private storage files to logged-in users via short-lived signed URLs. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bucket: string; path: string[] }> }
) {
  const { bucket, path } = await params;
  if (!ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: "unknown bucket" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const objectPath = path.map(decodeURIComponent).join("/");
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 300);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.redirect(data.signedUrl);
}
