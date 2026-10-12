import { NextResponse, type NextRequest } from "next/server";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Re-download a stored export via a short-lived signed URL. RLS decides access. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/exports/[exportId]">) {
  const member = await getMember();
  if (!member) return new NextResponse("Niet ingelogd", { status: 401 });
  const { exportId } = await ctx.params;
  const supabase = await createClient();
  const { data: exp } = await supabase
    .from("exports")
    .select("pdf_path, created_at, plan:plans(title)")
    .eq("id", exportId)
    .maybeSingle();
  if (!exp) return new NextResponse("Export niet gevonden", { status: 404 });

  const title = (exp.plan as unknown as { title: string } | null)?.title ?? "rapport";
  const name = `${title} ${exp.created_at.slice(0, 10)}`.replace(/[^\p{L}\p{N} ._-]+/gu, "").slice(0, 120) + ".pdf";
  const { data: signed, error } = await supabase.storage.from("exports").createSignedUrl(exp.pdf_path, 60, { download: name });
  if (error || !signed) return new NextResponse("Bestand niet beschikbaar", { status: 404 });
  return NextResponse.redirect(signed.signedUrl);
}
