import { asAdmin } from "@/lib/auth";
import { giftsCsv, listGifts } from "@/lib/services/loyalty";
import { amsDate } from "@/lib/domain/dates";

/** Cadeaulog als CSV (puntkomma's, komma als decimaalteken) voor de boekhouder. */
export async function GET(req: Request) {
  const jaar = new URL(req.url).searchParams.get("jaar");
  const year = jaar && /^\d{4}$/.test(jaar) ? Number(jaar) : Number(amsDate().slice(0, 4));
  const gifts = await asAdmin((q) => listGifts(q, year));
  // BOM zodat Excel de euro's en accenten goed leest.
  return new Response("﻿" + giftsCsv(gifts), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="cadeaus-${year}.csv"`,
      "cache-control": "no-store",
    },
  });
}
