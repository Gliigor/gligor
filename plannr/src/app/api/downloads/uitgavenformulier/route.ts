import { NextResponse } from "next/server";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toHouseStyle } from "@/lib/house-style/types";
import { loadLogo } from "@/lib/report/build";
import { renderExpenseFormPdf } from "@/lib/pdf/render";

export const runtime = "nodejs";

/** Printable expense form (PDF) in the firm's house style. */
export async function GET() {
  const member = await getMember();
  if (!member) return new NextResponse("Niet ingelogd", { status: 401 });
  const supabase = await createClient();
  const { data: row } = await supabase.from("house_styles").select("*").eq("is_active", true).maybeSingle();
  const style = toHouseStyle(row);
  const pdf = await renderExpenseFormPdf(member.firm.name, style, await loadLogo(supabase, style.logoPath));
  const name = `Uitgavenoverzicht ${member.firm.name}`.replace(/[^\w .-]+/g, "").trim();
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
