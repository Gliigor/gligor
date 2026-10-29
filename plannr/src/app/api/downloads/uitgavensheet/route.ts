import { NextResponse } from "next/server";
import { getMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toHouseStyle } from "@/lib/house-style/types";
import { loadLogo } from "@/lib/report/build";
import { buildExpenseSheet } from "@/lib/downloads/expense-sheet";

export const runtime = "nodejs";

/** Expense sheet (Excel) in the firm's house style, for planners to send to clients. */
export async function GET() {
  const member = await getMember();
  if (!member) return new NextResponse("Niet ingelogd", { status: 401 });
  const supabase = await createClient();
  const { data: row } = await supabase.from("house_styles").select("*").eq("is_active", true).maybeSingle();
  const style = toHouseStyle(row);
  const file = await buildExpenseSheet({ firmName: member.firm.name, style, logo: await loadLogo(supabase, style.logoPath) });
  const name = `Uitgavenoverzicht ${member.firm.name}`.replace(/[^\w .-]+/g, "").trim();
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
