import { NextResponse, type NextRequest } from "next/server";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { renderReportPdf } from "@/lib/pdf/render";
import { sampleReportData } from "@/lib/pdf/sample";
import { loadLogo } from "@/lib/report/build";
import { isFontName } from "@/lib/house-style/fonts";
import { isHexColor, isLayoutVariant, toHouseStyle } from "@/lib/house-style/types";

export const runtime = "nodejs";

/**
 * Sample report in the firm's house style, with optional unsaved overrides from
 * the settings form (?variant=&primary=&secondary=&accent=&heading=&body=).
 */
export async function GET(request: NextRequest) {
  const member = await getMember();
  if (!member) return new NextResponse("Niet ingelogd", { status: 401 });
  const q = request.nextUrl.searchParams;
  const supabase = await createClient();
  const { data: row } = await supabase.from("house_styles").select("*").eq("is_active", true).maybeSingle();
  const style = toHouseStyle(row);

  const variant = q.get("variant");
  const primary = `#${q.get("primary") ?? ""}`;
  const secondary = `#${q.get("secondary") ?? ""}`;
  const accent = `#${q.get("accent") ?? ""}`;
  if (isLayoutVariant(variant)) style.layoutVariant = variant;
  if (isHexColor(primary)) style.primaryColor = primary;
  if (isHexColor(secondary)) style.secondaryColor = secondary;
  if (isHexColor(accent)) style.accentColor = accent;
  if (isFontName(q.get("heading"))) style.fontHeading = q.get("heading")!;
  if (isFontName(q.get("body"))) style.fontBody = q.get("body")!;

  const data = await sampleReportData(member.firm.name);
  const pdf = await renderReportPdf(data, style, await loadLogo(supabase, style.logoPath));
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="voorbeeld.pdf"`, "Cache-Control": "private, no-store" },
  });
}
