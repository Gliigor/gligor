import { NextResponse, type NextRequest } from "next/server";
import { withSystem } from "@/lib/db";
import { parseCalEvent, verifyCalSignature } from "@/lib/domain/leads";
import { handleCalBooking } from "@/lib/services/leads";

export const dynamic = "force-dynamic";

/**
 * Cal.com-webhook (Booking created / rescheduled / cancelled). Cal.com
 * ondertekent de body met het geheim uit CAL_WEBHOOK_SECRET.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CAL_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "CAL_WEBHOOK_SECRET ontbreekt" }, { status: 500 });
  const body = await req.text();
  if (!verifyCalSignature(body, req.headers.get("x-cal-signature-256"), secret)) {
    return NextResponse.json({ error: "ongeldige handtekening" }, { status: 401 });
  }
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "geen JSON" }, { status: 400 });
  }
  const booking = parseCalEvent(json);
  if (!booking) return NextResponse.json({ ignored: true });
  const result = await withSystem((q) => handleCalBooking(q, booking));
  return NextResponse.json({ ok: true, ...result });
}
