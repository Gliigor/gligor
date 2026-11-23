import { NextResponse } from "next/server";

/**
 * ============================================================================
 *  PLACEHOLDER: Stripe is nog NIET gekoppeld.
 * ============================================================================
 *
 * Zo koppel je Stripe later, zonder dat de UI hoeft te veranderen:
 *
 * 1. `npm install stripe` en zet STRIPE_SECRET_KEY en STRIPE_WEBHOOK_SECRET.
 * 2. Maak per verwachte betaling een Stripe-factuur en sla het factuur-id op in
 *    payments.external_provider = 'stripe' en payments.external_id = 'in_...'.
 *    (Of: maak een Stripe-abonnement en koppel de facturen bij invoice.created.)
 * 3. Verifieer hier de handtekening:
 *      const event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)
 * 4. Verwerk de events via de bestaande servicelaag (src/lib/services/work.ts):
 *      invoice.paid            → markPaidByExternalId(q, 'stripe', invoice.id, <betaaldatum>)
 *      invoice.payment_failed  → niets aan de status doen: na de vervaldatum wordt
 *                                hij vanzelf "Te laat" en verschijnt hij in Vandaag.
 *    Gebruik withSystem() uit src/lib/db voor de databasetoegang.
 *
 * De betaalstatus (Op tijd / Openstaand / Te laat / Betaald) wordt altijd
 * berekend uit vervaldatum en betaaldatum, dus het dashboard werkt meteen mee.
 */
export async function POST() {
  return NextResponse.json({ error: "Stripe is nog niet gekoppeld (zie src/app/api/webhooks/stripe/route.ts)" }, { status: 501 });
}
