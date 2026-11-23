import { NextResponse, type NextRequest } from "next/server";
import { resendClient } from "@/lib/email/deliver";
import { handleInbound, headerValue } from "@/lib/inbound";
import type { InboundEmail } from "@/lib/services/tickets";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Resend Inbound: Resend stuurt een ondertekende webhook (email.received).
 * We controleren de handtekening en halen daarna de volledige mail en
 * bijlagen op via de Resend API.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "RESEND_WEBHOOK_SECRET ontbreekt" }, { status: 500 });
  const payload = await req.text();
  const resend = resendClient();

  let event;
  try {
    event = resend.webhooks.verify({
      payload,
      headers: {
        id: req.headers.get("svix-id") ?? "",
        timestamp: req.headers.get("svix-timestamp") ?? "",
        signature: req.headers.get("svix-signature") ?? "",
      },
      webhookSecret: secret,
    });
  } catch {
    return NextResponse.json({ error: "ongeldige handtekening" }, { status: 401 });
  }
  if (event.type !== "email.received") return NextResponse.json({ ignored: event.type });

  const emailId = event.data.email_id;
  const { data: full, error } = await resend.emails.receiving.get(emailId);
  if (error || !full) return NextResponse.json({ error: error?.message ?? "mail niet gevonden" }, { status: 502 });

  const mail: InboundEmail = {
    from: full.from,
    to: full.to.join(", "),
    subject: full.subject ?? "",
    text: full.text ?? "",
    html: full.html,
    messageId: full.message_id ? (full.message_id.startsWith("<") ? full.message_id : `<${full.message_id}>`) : null,
    inReplyTo: headerValue(full.headers, "in-reply-to"),
    references: headerValue(full.headers, "references"),
    receivedAt: new Date(full.created_at).toISOString(),
    attachments: full.attachments.map((a) => ({
      filename: a.filename ?? "bijlage",
      contentType: a.content_type,
      size: a.size,
      load: async () => {
        const { data, error: e } = await resend.emails.receiving.attachments.get({ emailId, id: a.id });
        if (e || !data) throw new Error(`Bijlage ophalen mislukt: ${e?.message}`);
        const res = await fetch(data.download_url);
        return new Uint8Array(await res.arrayBuffer());
      },
    })),
  };
  const result = await handleInbound(mail);
  return NextResponse.json(result);
}
