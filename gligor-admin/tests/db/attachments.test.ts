import { test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb, ADMIN_CLAIMS } from "../helpers/pglite";
import { ingestInbound } from "../../src/lib/services/tickets";

test("inkomende mail: mislukte bijlage houdt het ticket niet tegen", async () => {
  const db = await createTestDb();
  const r = await db.as(ADMIN_CLAIMS, (q) =>
    ingestInbound(
      q,
      {
        from: "klant@voorbeeld.example",
        to: "hello@gligor.ai",
        subject: "Met bijlage",
        text: "Zie bijlage.",
        html: null,
        messageId: "<bijlage-1@voorbeeld.example>",
        inReplyTo: null,
        references: null,
        receivedAt: new Date().toISOString(),
        attachments: [{ filename: "offerte.pdf", contentType: "application/pdf", size: 10, load: async () => new Uint8Array(10) }],
      },
      { save: async () => { throw new Error("geen opslag"); }, path: (t, m, f) => `${t}/${m}/${f}` },
    ),
  );
  assert.equal(r.created, "lead");
  const [m] = await db.raw<{ body_text: string }>("select body_text from ticket_messages");
  assert.match(m.body_text, /Bijlage niet opgeslagen: offerte\.pdf/);
  await db.close();
});
