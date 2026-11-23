import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { demoDataDir, isDemo } from "./env";
import type { Query } from "./db/driver";

/**
 * Bijlagen van tickets, op één van drie plekken:
 * - demo: een lokale map;
 * - met SUPABASE_SECRET_KEY: privé-bucket in Supabase Storage (EU), alleen via
 *   kortlevende ondertekende links;
 * - anders: in de database zelf (tabel attachment_blobs, met RLS). Prima voor
 *   een paar bijlagen per week en er is geen extra sleutel voor nodig.
 */
export const BUCKET = "ticket-bijlagen";

type Mode = "demo" | "storage" | "database";

export function storageMode(): Mode {
  if (isDemo()) return "demo";
  return process.env.SUPABASE_SECRET_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL ? "storage" : "database";
}

function storageClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from(BUCKET);
}

function safeName(name: string): string {
  return name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "bijlage";
}

export function attachmentPath(ticketId: string, messageId: string, filename: string): string {
  return `${ticketId}/${messageId}/${safeName(filename)}`;
}

export async function saveAttachment(q: Query, storagePath: string, bytes: Uint8Array, contentType: string): Promise<void> {
  const mode = storageMode();
  if (mode === "demo") {
    const full = path.join(demoDataDir(), "bijlagen", storagePath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, bytes);
    return;
  }
  if (mode === "storage") {
    const { error } = await storageClient().upload(storagePath, bytes, { contentType, upsert: true });
    if (error) throw new Error(`Bijlage opslaan mislukt: ${error.message}`);
    return;
  }
  await q(
    `insert into attachment_blobs (storage_path, content_type, data) values ($1, $2, $3::bytea)
     on conflict (storage_path) do update set content_type = excluded.content_type, data = excluded.data`,
    [storagePath, contentType, Buffer.from(bytes)],
  );
}

/** Storage: ondertekende link (60 s). Demo en database: de bestandsinhoud zelf. */
export async function readAttachment(q: Query, storagePath: string): Promise<{ url: string } | { bytes: Buffer }> {
  const mode = storageMode();
  if (mode === "demo") return { bytes: await fs.readFile(path.join(demoDataDir(), "bijlagen", storagePath)) };
  if (mode === "storage") {
    const { data, error } = await storageClient().createSignedUrl(storagePath, 60);
    if (error || !data) throw new Error(`Bijlage niet gevonden: ${error?.message ?? ""}`);
    return { url: data.signedUrl };
  }
  const [row] = await q<{ data: Uint8Array }>("select data from attachment_blobs where storage_path = $1", [storagePath]);
  if (!row) throw new Error("Bijlage niet gevonden.");
  return { bytes: Buffer.from(row.data) };
}

/** Na een AVG-verwijdering: de bestanden zelf ook weg (database-bijlagen gaan al mee in forgetClient). */
export async function removeAttachments(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const mode = storageMode();
  if (mode === "demo") {
    await Promise.all(paths.map((p) => fs.rm(path.join(demoDataDir(), "bijlagen", p), { force: true })));
    return;
  }
  if (mode === "storage") await storageClient().remove(paths);
}
