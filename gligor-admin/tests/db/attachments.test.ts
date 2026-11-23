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

test("bijlagen in de database: opslaan, lezen en AVG-verwijdering", async () => {
  process.env.DEMO_MODE = "false";
  delete process.env.SUPABASE_SECRET_KEY;
  const { saveAttachment, readAttachment, storageMode } = await import("../../src/lib/storage");
  const { forgetClient } = await import("../../src/lib/services/clients");
  assert.equal(storageMode(), "database");
  const db = await createTestDb();
  await db.as(ADMIN_CLAIMS, async (q) => {
    const r = await ingestInbound(
      q,
      {
        from: "klant2@voorbeeld.example",
        to: "hello@gligor.ai",
        subject: "Bijlage",
        text: "Zie bijlage.",
        html: null,
        messageId: "<bijlage-2@voorbeeld.example>",
        inReplyTo: null,
        references: null,
        receivedAt: new Date().toISOString(),
        attachments: [{ filename: "notitie.txt", contentType: "text/plain", size: 5, load: async () => new TextEncoder().encode("hallo") }],
      },
      { save: (p, b, t) => saveAttachment(q, p, b, t), path: (t, m, f) => `${t}/${m}/${f}` },
    );
    const [a] = await q<{ storage_path: string; client_id: string }>(
      "select a.storage_path, t.client_id from ticket_attachments a join ticket_messages m on m.id = a.message_id join tickets t on t.id = m.ticket_id where t.id = $1",
      [r.ticketId],
    );
    const file = await readAttachment(q, a.storage_path);
    assert.ok("bytes" in file && file.bytes.toString() === "hallo");
    await forgetClient(q, a.client_id);
    const left = await q<{ n: number }>("select count(*)::int as n from attachment_blobs");
    assert.equal(left[0].n, 0, "bijlage mee verwijderd");
  });
  await db.close();
  delete process.env.DEMO_MODE;
});
