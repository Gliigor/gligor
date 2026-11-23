import { asAdmin } from "@/lib/auth";
import { exportClient } from "@/lib/services/clients";

/** AVG-inzageverzoek: alle gegevens van één klant als JSON-bestand. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const data = await asAdmin((q) => exportClient(q, id));
  if (!data) return new Response("Niet gevonden", { status: 404 });
  const name = data.client.company.replace(/[^\w-]+/g, "-").toLowerCase();
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="gegevens-${name}.json"`,
      "cache-control": "no-store",
    },
  });
}
