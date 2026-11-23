import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { demoDataDir, isDemo } from "./env";

/**
 * Bijlagen van tickets. Productie: privé-bucket in Supabase Storage (EU),
 * alleen bereikbaar via kortlevende ondertekende links. Demo: lokale map.
 */
export const BUCKET = "ticket-bijlagen";

function storageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SECRET_KEY zijn nodig voor bijlagen. Zie README.md.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from(BUCKET);
}

function safeName(name: string): string {
  return name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "bijlage";
}

export function attachmentPath(ticketId: string, messageId: string, filename: string): string {
  return `${ticketId}/${messageId}/${safeName(filename)}`;
}

export async function saveAttachment(storagePath: string, bytes: Uint8Array, contentType: string): Promise<void> {
  if (isDemo()) {
    const full = path.join(demoDataDir(), "bijlagen", storagePath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, bytes);
    return;
  }
  const { error } = await storageClient().upload(storagePath, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Bijlage opslaan mislukt: ${error.message}`);
}

/** Productie: ondertekende link (60 s). Demo: de bestandsinhoud zelf. */
export async function readAttachment(storagePath: string): Promise<{ url: string } | { bytes: Buffer }> {
  if (isDemo()) return { bytes: await fs.readFile(path.join(demoDataDir(), "bijlagen", storagePath)) };
  const { data, error } = await storageClient().createSignedUrl(storagePath, 60);
  if (error || !data) throw new Error(`Bijlage niet gevonden: ${error?.message ?? ""}`);
  return { url: data.signedUrl };
}

export async function removeAttachments(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  if (isDemo()) {
    await Promise.all(paths.map((p) => fs.rm(path.join(demoDataDir(), "bijlagen", p), { force: true })));
    return;
  }
  await storageClient().remove(paths);
}
