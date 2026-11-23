import { NextResponse, type NextRequest } from "next/server";
import { handleInbound, headerValue } from "@/lib/inbound";
import { safeEqual } from "@/lib/secure";
import type { InboundEmail } from "@/lib/services/tickets";

export const dynamic = "force-dynamic";

interface PostmarkInbound {
  From: string;
  FromFull?: { Email: string; Name: string };
  To: string;
  Subject: string;
  TextBody?: string;
  StrippedTextReply?: string;
  HtmlBody?: string;
  Date?: string;
  Headers?: { Name: string; Value: string }[];
  Attachments?: { Name: string; Content: string; ContentType: string; ContentLength: number }[];
}

/**
 * Alternatief: Postmark Inbound. Stel als webhook-URL in:
 *   https://<jouw-domein>/api/inbound/postmark?token=<INBOUND_TOKEN>
 */
export async function POST(req: NextRequest) {
  if (!safeEqual(req.nextUrl.searchParams.get("token"), process.env.INBOUND_TOKEN)) {
    return NextResponse.json({ error: "niet toegestaan" }, { status: 401 });
  }
  const p = (await req.json()) as PostmarkInbound;
  const from = p.FromFull ? `${p.FromFull.Name} <${p.FromFull.Email}>` : p.From;
  const mail: InboundEmail = {
    from,
    to: p.To,
    subject: p.Subject ?? "",
    text: p.TextBody ?? p.StrippedTextReply ?? "",
    html: p.HtmlBody ?? null,
    messageId: headerValue(p.Headers, "message-id"),
    inReplyTo: headerValue(p.Headers, "in-reply-to"),
    references: headerValue(p.Headers, "references"),
    receivedAt: p.Date && !Number.isNaN(Date.parse(p.Date)) ? new Date(p.Date).toISOString() : new Date().toISOString(),
    attachments: (p.Attachments ?? []).map((a) => ({
      filename: a.Name,
      contentType: a.ContentType,
      size: a.ContentLength,
      load: async () => new Uint8Array(Buffer.from(a.Content, "base64")),
    })),
  };
  return NextResponse.json(await handleInbound(mail));
}
