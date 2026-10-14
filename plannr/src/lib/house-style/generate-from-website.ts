import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { suggestFromSources, type StyleSuggestion } from "./analyze";

export type { StyleSuggestion } from "./analyze";

const TIMEOUT_MS = 6000;
const MAX_HTML_BYTES = 1_500_000;
const MAX_CSS_BYTES = 500_000;
const MAX_STYLESHEETS = 3;

/** Blocks requests to private, loopback and link-local addresses (SSRF guard). */
function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivateAddress(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

async function assertPublicUrl(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Alleen http(s)-adressen zijn toegestaan.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("Dit adres wordt niet ondersteund.");
  const addresses = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new Error("Dit adres wordt niet ondersteund.");
  }
}

async function fetchText(url: URL, maxBytes: number, hops = 3): Promise<{ text: string; finalUrl: URL }> {
  await assertPublicUrl(url);
  const res = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "User-Agent": "PlannrHuisstijlBot/1.0 (+https://plannr.app)", Accept: "text/html,text/css,*/*;q=0.5" },
  });
  if (res.status >= 300 && res.status < 400 && res.headers.get("location") && hops > 0) {
    return fetchText(new URL(res.headers.get("location")!, url), maxBytes, hops - 1);
  }
  if (!res.ok || !res.body) throw new Error("De website kon niet worden geladen.");

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  await reader.cancel().catch(() => {});
  return { text: new TextDecoder().decode(Buffer.concat(chunks).subarray(0, maxBytes)), finalUrl: url };
}

/**
 * Suggests brand colors and the closest curated fonts for a firm's website.
 * Simple v1: reads the homepage HTML and up to three of its stylesheets.
 * Everything it returns stays adjustable by the owner.
 */
export async function generateHouseStyleFromWebsite(input: string): Promise<StyleSuggestion> {
  const url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  const { text: html, finalUrl } = await fetchText(url, MAX_HTML_BYTES);

  const sheetUrls = [...html.matchAll(/<link[^>]+rel=["']?stylesheet["']?[^>]*>/gi)]
    .map((m) => m[0].match(/href=["']([^"']+)["']/i)?.[1])
    .filter((href): href is string => Boolean(href))
    .map((href) => new URL(href, finalUrl))
    .filter((u) => u.hostname === finalUrl.hostname || u.hostname === "fonts.googleapis.com")
    .slice(0, MAX_STYLESHEETS);

  const sheets = await Promise.all(
    sheetUrls.map((u) =>
      u.hostname === "fonts.googleapis.com"
        ? Promise.resolve(u.toString())
        : fetchText(u, MAX_CSS_BYTES).then((r) => r.text).catch(() => ""),
    ),
  );
  return suggestFromSources(html, sheets);
}
