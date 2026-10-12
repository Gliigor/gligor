import { NextResponse, type NextRequest } from "next/server";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { renderReportPdf } from "@/lib/pdf/render";
import { buildReport } from "@/lib/report/build";
import { parseReportSections } from "@/lib/plan/types";

export const runtime = "nodejs";

function fileName(title: string, client: string) {
  return `${client} - ${title}`.replace(/[^\p{L}\p{N} ._-]+/gu, "").slice(0, 120) + ".pdf";
}

/** Live preview: renders the PDF for the selected sections without saving anything. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/plannen/[planId]/rapport">) {
  const member = await getMember();
  if (!member) return new NextResponse("Niet ingelogd", { status: 401 });
  const { planId } = await ctx.params;
  const raw = request.nextUrl.searchParams.get("secties");
  const sections = raw === null ? undefined : parseReportSections(raw.split(",").filter(Boolean));

  const supabase = await createClient();
  const report = await buildReport(supabase, planId, { sections, plannerName: member.profile.name || null });
  if (!report) return new NextResponse("Plan niet gevonden", { status: 404 });

  const pdf = await renderReportPdf(report.data, report.style, report.logo);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="voorbeeld.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** Export: renders, stores the PDF + a house-style snapshot, and returns a download link. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/plannen/[planId]/rapport">) {
  const member = await getMember();
  if (!member) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  const { planId } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { sections?: unknown };
  const sections = parseReportSections(body.sections);
  if (sections.length === 0) return NextResponse.json({ error: "Kies minimaal één rapportonderdeel." }, { status: 400 });

  const supabase = await createClient();
  const report = await buildReport(supabase, planId, { sections, plannerName: member.profile.name || null });
  if (!report) return NextResponse.json({ error: "Plan niet gevonden" }, { status: 404 });

  const pdf = await renderReportPdf(report.data, report.style, report.logo);
  const exportId = crypto.randomUUID();
  const path = `${member.firm.id}/${planId}/${exportId}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("exports")
    .upload(path, pdf, { contentType: "application/pdf", upsert: false });
  if (uploadError) return NextResponse.json({ error: "Opslaan van de PDF is mislukt." }, { status: 500 });

  const { error: insertError } = await supabase.from("exports").insert({
    id: exportId,
    firm_id: member.firm.id,
    plan_id: planId,
    pdf_path: path,
    sections_included: sections,
    house_style_snapshot: report.style,
    created_by: member.userId,
  });
  if (insertError) return NextResponse.json({ error: "Opslaan van de export is mislukt." }, { status: 500 });

  const name = fileName(report.plan.title, report.data.clientName);
  const { data: signed } = await supabase.storage.from("exports").createSignedUrl(path, 300, { download: name });
  return NextResponse.json({ exportId, url: signed?.signedUrl ?? `/api/exports/${exportId}` });
}
