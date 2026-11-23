import { NextResponse, type NextRequest } from "next/server";
import { withSystem } from "@/lib/db";
import { amsHour } from "@/lib/domain/dates";
import { loadToday, runDaily } from "@/lib/services/today";
import { digestText } from "@/lib/digest";
import { deliver } from "@/lib/email/deliver";
import { adminEmail, siteUrl } from "@/lib/env";
import { safeEqual } from "@/lib/secure";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Dagelijkse job. Vercel Cron rekent in UTC, dus vercel.json roept deze route
 * om 05:00 én 06:00 UTC aan; alleen de aanroep die om 07:00 Amsterdamse tijd
 * valt (zomer- of wintertijd) doet echt iets. ?force=1 slaat die controle over.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(req.headers.get("authorization"), `Bearer ${secret}`)) {
    return NextResponse.json({ error: "niet toegestaan" }, { status: 401 });
  }
  const now = new Date();
  if (req.nextUrl.searchParams.get("force") !== "1" && amsHour(now) !== 7) {
    return NextResponse.json({ skipped: true, reason: "niet 07:00 in Amsterdam" });
  }

  const result = await withSystem(async (q) => {
    const run = await runDaily(q, now);
    await q(
      `insert into settings (key, value) values ('last_daily_run', to_jsonb($1::text))
       on conflict (key) do update set value = excluded.value`,
      [run.today],
    );
    const { items, summary, today } = await loadToday(q, now);
    const digest = digestText(items, summary, today, siteUrl());
    let digestSent = false;
    try {
      const sent = await deliver({ to: adminEmail(), subject: digest.subject, text: digest.text });
      await q(
        `insert into emails (kind, to_email, subject, body, status, sent_at, message_id, provider_id)
         values ('digest', $1, $2, $3, 'verzonden', now(), $4, $5)`,
        [adminEmail(), digest.subject, digest.text, sent.messageId, sent.providerId],
      );
      digestSent = true;
    } catch (err) {
      console.error("[cron] digest niet verstuurd:", err);
    }
    return { ...run, items: items.length, digestSent };
  });
  return NextResponse.json(result);
}
