import { NextResponse } from "next/server";
import { asAdmin } from "@/lib/auth";
import { readAttachment } from "@/lib/storage";
import type { AttachmentRow } from "@/lib/types";

/** Bijlage downloaden: alleen voor de beheerder, via een kortlevende link. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Niet gevonden", { status: 404 });
  const found = await asAdmin(async (q) => {
    const [a] = await q<AttachmentRow>("select * from ticket_attachments where id = $1", [id]);
    return a ? { a, file: await readAttachment(q, a.storage_path) } : null;
  });
  if (!found) return new NextResponse("Niet gevonden", { status: 404 });
  const { a, file } = found;
  if ("url" in file) return NextResponse.redirect(file.url);
  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "content-type": a.content_type,
      // Altijd als download, nooit in de browser uitvoeren (bijv. HTML-bijlagen).
      "content-disposition": `attachment; filename="${a.filename.replace(/"/g, "")}"`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
}
