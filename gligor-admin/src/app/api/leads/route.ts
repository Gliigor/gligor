import { NextResponse, type NextRequest } from "next/server";
import { withSystem } from "@/lib/db";
import { hashIp, parseLeadForm } from "@/lib/domain/leads";
import { allowFormHit, createWebsiteLead } from "@/lib/services/leads";

export const dynamic = "force-dynamic";

/**
 * Contactformulier van gligor.ai. Werkt met fetch (JSON-antwoord, CORS) én als
 * gewoon formulier zonder JavaScript (doorsturen naar de bedankpagina).
 * Spambescherming: een honeypotveld en maximaal 5 berichten per uur per IP.
 */
const MAX_PER_HOUR = 5;

function allowedOrigins(): string[] {
  return (process.env.LEAD_ALLOWED_ORIGINS ?? "https://gligor.ai,https://www.gligor.ai")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

function cors(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin");
  if (!origin || !allowedOrigins().includes(origin)) return {};
  return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" };
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req) });
}

export async function POST(req: NextRequest) {
  const isJson = (req.headers.get("content-type") ?? "").includes("application/json");
  const headers = cors(req);
  const origin = req.headers.get("origin");
  if (origin && !headers["Access-Control-Allow-Origin"]) return NextResponse.json({ error: "niet toegestaan" }, { status: 403 });

  let raw: Record<string, unknown>;
  try {
    raw = isJson ? await req.json() : Object.fromEntries(await req.formData());
  } catch {
    return NextResponse.json({ error: "Ongeldig formulier." }, { status: 400, headers });
  }

  const back = (status: "verzonden" | "fout", message?: string) => {
    if (isJson) {
      return status === "verzonden"
        ? NextResponse.json({ ok: true }, { headers })
        : NextResponse.json({ error: message }, { status: 400, headers });
    }
    const site = allowedOrigins()[0] ?? "https://gligor.ai";
    return NextResponse.redirect(status === "verzonden" ? `${site}/bedankt` : `${site}/#contact`, 303);
  };

  const parsed = parseLeadForm(raw);
  // Spam krijgt hetzelfde antwoord als een echt bericht, zodat bots niets leren.
  if (parsed.kind === "spam") return back("verzonden");
  if (parsed.kind === "invalid") return back("fout", parsed.error);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "onbekend";
  const ipHash = hashIp(ip, process.env.FORM_SECRET ?? process.env.CRON_SECRET ?? "gligor-admin");
  try {
    const ok = await withSystem(async (q) => {
      if (!(await allowFormHit(q, "lead", ipHash, MAX_PER_HOUR, 60))) return false;
      await createWebsiteLead(q, parsed.data, new Date());
      return true;
    });
    if (!ok) {
      return isJson
        ? NextResponse.json({ error: "Je hebt al een paar berichten gestuurd. Probeer het over een uur opnieuw, of mail me." }, { status: 429, headers })
        : back("fout");
    }
  } catch (err) {
    console.error("[leads]", err);
    return NextResponse.json({ error: "Er ging iets mis. Mail me gerust direct." }, { status: 500, headers });
  }
  return back("verzonden");
}
