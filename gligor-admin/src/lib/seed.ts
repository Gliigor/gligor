/**
 * Voorbeeldgegevens: 3 verzonnen klanten in verschillende fases, met logboek,
 * tickets, betalingen, taken en concepten. Alle datums zijn relatief aan
 * vandaag, zodat het dashboard er altijd "levend" uitziet.
 */
import type { Query } from "./db/driver";
import { addDays, amsDate } from "./domain/dates";
import { STAGE_LABEL, type Stage } from "./config";
import { createClient, moveStage, syncPayments } from "./services/clients";
import { addLogEntry } from "./services/work";
import { runDaily } from "./services/today";

export const DEMO_ADMIN_ID = "00000000-0000-4000-8000-00000000a001";

export async function seedDemo(q: Query, now: Date): Promise<void> {
  const today = amsDate(now);
  const d = (n: number) => addDays(today, n);
  const ts = (n: number, hour = 10) => `${d(n)}T${String(hour - 1).padStart(2, "0")}:00:00Z`;

  // 1. Plus-klant, al bijna een kwartaal bezig.
  const a = await createClient(
    q,
    {
      company: "Installatiebedrijf Demo B.V.",
      sector: "Installatietechniek",
      city: "Amersfoort",
      owner_name: "Henk Jansen",
      email: "henk@installatie-demo.example",
      phone: "06 11 22 33 44",
      preferred_channel: "telefoon",
      package: "plus",
      setup_type: "microsoft365",
      users_count: 4,
      tags: ["offertes", "planning"],
      notes: "Wil vooral minder tijd kwijt zijn aan offertes en werkbonnen. Zoon Daan (werkvoorbereider) is de AI-kampioen.",
    },
    "lead",
    d(-95),
  );
  await moveStage(q, a.id, "kennismaking", d(-95));
  await moveStage(q, a.id, "intake", d(-92));
  await q("update clients set start_date = $2 where id = $1", [a.id, d(-87)]);
  await moveStage(q, a.id, "inrichting", d(-87));
  await moveStage(q, a.id, "training", d(-80));
  await moveStage(q, a.id, "checkin", d(-59));
  await moveStage(q, a.id, "doorlopend", d(-55));

  // 2. Basis-klant in week 4: de garantie-evaluatie staat vandaag klaar.
  const b = await createClient(
    q,
    {
      company: "Bakkerij Voorbeeld",
      sector: "Bakkerij",
      city: "Utrecht",
      owner_name: "Marieke de Vries",
      email: "marieke@bakkerij-voorbeeld.example",
      phone: "06 55 66 77 88",
      preferred_channel: "whatsapp",
      package: "basis",
      setup_type: "claude",
      users_count: 2,
      tags: ["social media"],
      notes: "Doet zelf de administratie, 's avonds. Wil hulp bij bestellingen per mail en Instagram-posts.",
    },
    "lead",
    d(-40),
  );
  await moveStage(q, b.id, "kennismaking", d(-40));
  await moveStage(q, b.id, "intake", d(-35));
  await q("update clients set start_date = $2 where id = $1", [b.id, d(-28)]);
  await moveStage(q, b.id, "inrichting", d(-28));
  await moveStage(q, b.id, "training", d(-21));
  await moveStage(q, b.id, "checkin", d(-1));

  // 3. Nieuwe lead, kennismaking deze week.
  const c = await createClient(
    q,
    {
      company: "Kapsalon Testlaan",
      sector: "Kapper",
      city: "Zwolle",
      owner_name: "Sanne Bakker",
      email: "sanne@kapsalon-testlaan.example",
      phone: "06 99 88 77 66",
      preferred_channel: "telefoon",
      package: "basis",
      tags: ["afspraken"],
      notes: "Via de website. Krijgt veel WhatsApp-vragen over openingstijden en prijzen.",
    },
    "lead",
    d(-6),
  );
  await moveStage(q, c.id, "kennismaking", d(-2));

  // Datums van de fasewissels laten kloppen met het verhaal.
  await q(
    `update client_stage_history h set changed_at = (s.d || 'T09:00:00Z')::timestamptz
     from (values
       ($1::uuid, 'kennismaking'::client_stage, $3::text), ($1, 'intake', $4), ($1, 'inrichting', $5), ($1, 'training', $6), ($1, 'checkin', $7), ($1, 'doorlopend', $8),
       ($2::uuid, 'kennismaking', $9), ($2, 'intake', $10), ($2, 'inrichting', $11), ($2, 'training', $12), ($2, 'checkin', $13)
     ) as s(id, stage, d)
     where h.client_id = s.id and h.to_stage = s.stage`,
    [a.id, b.id, d(-95), d(-92), d(-87), d(-80), d(-59), d(-55), d(-40), d(-35), d(-28), d(-21), d(-1)],
  );
  await q("update clients set stage_changed_at = $2 where id = $1", [a.id, ts(-55)]);
  await q("update clients set stage_changed_at = $2 where id = $1", [b.id, ts(-1)]);
  await q("update clients set stage_changed_at = $2 where id = $1", [c.id, ts(-2)]);
  await q("update clients set created_at = $2 where id = $1", [a.id, ts(-95)]);
  await q("update clients set created_at = $2 where id = $1", [b.id, ts(-40)]);
  await q("update clients set created_at = $2 where id = $1", [c.id, ts(-6)]);
  await q(
    "update client_stage_history h set changed_at = c.created_at from clients c where c.id = h.client_id and h.to_stage = 'lead'",
  );
  // De automatische logregels "Fase gewijzigd" op de datum van de wissel zetten.
  const history = await q<{ client_id: string; to_stage: Stage; changed_at: string }>(
    "select client_id, to_stage, changed_at from client_stage_history",
  );
  for (const h of history) {
    await q(
      "update log_entries set occurred_at = $3 where client_id = $1 and source = 'systeem' and summary like $2",
      [h.client_id, `Fase gewijzigd:%→ ${STAGE_LABEL[h.to_stage]}`, h.changed_at],
    );
  }

  // Alles van vóór vandaag is "al gebeurd": e-mails verstuurd, taken klaar.
  await q(
    `update emails set status = 'verzonden', sent_at = scheduled_for, message_id = '<seed-' || id || '@gligor.ai>'
     where status in ('concept', 'gepland') and scheduled_for < $1`,
    [`${today}T00:00:00Z`],
  );
  await q("update tasks set status = 'klaar', completed_at = (due_date || 'T16:00:00Z')::timestamptz where status = 'open' and due_date < $1", [today]);

  // Logboek.
  const log = (client: string, n: number, type: "gesprek" | "telefoon" | "email" | "bezoek" | "notitie", summary: string, actions = "", followUp: string | null = null) =>
    addLogEntry(q, { client_id: client, type, occurred_at: ts(n, 11), summary, agreed_actions: actions, follow_up_date: followUp });

  await log(a.id, -95, "gesprek", "Kennismaking (videobellen). Henk schrijft elke week 6–8 offertes, kost hem een avond per week.", "Intake plannen bij hem op kantoor");
  await log(a.id, -92, "bezoek", "Intake op kantoor in Amersfoort. 4 gebruikers met Microsoft 365 Business Standard. Offertes en werkbonnen zijn de grootste tijdvreters.", "Copilot-licenties laten bestellen\nOffertesjabloon opvragen");
  await log(a.id, -80, "bezoek", "Starttraining met Henk, Daan en twee monteurs. Offertes maken met Copilot ging goed na de tweede oefening.", "Spiekbriefje 'werkbon naar factuur' maken");
  await log(a.id, -59, "telefoon", "Garantie-evaluatie: ze besparen naar eigen zeggen 5–6 uur per week op offertes. Ruim boven de 4 uur. Gaat door met Plus.");
  await log(a.id, -34, "telefoon", "Kort gebeld: Daan wil de planning van monteurs ook slimmer doen. Goed kandidaat voor het volgende kwartaalproces.");

  await log(b.id, -40, "gesprek", "Kennismaking in de bakkerij. Marieke beantwoordt 's avonds bestellingen per mail en doet zelf Instagram.");
  await log(b.id, -35, "bezoek", "Intake. Claude Team voor Marieke en haar zus. Bestellingen per mail en een vast weekritme voor posts.");
  await log(b.id, -21, "bezoek", "Starttraining. Antwoorden op bestellingen gaan al veel sneller. Instagram-posts vond ze nog lastig.", "Extra spiekbriefje voor Instagram-posts sturen", d(-1));
  await log(b.id, -7, "email", "Marieke mailt dat ze nu op vrijdag alle posts voor de week maakt in 20 minuten.");

  await log(c.id, -6, "notitie", "Lead via het contactformulier van gligor.ai. Kapsalon met 3 medewerkers.", "Bellen voor kennismakingsgesprek", today);

  // Tickets.
  const ticket = async (client: string, subject: string, body: string, hoursAgo: number, from: string) => {
    const at = new Date(now.getTime() - hoursAgo * 3_600_000).toISOString();
    const [t] = await q<{ id: string }>(
      "insert into tickets (client_id, subject, status, awaiting_since, created_at) values ($1, $2, 'nieuw', $3, $3) returning id",
      [client, subject, at],
    );
    await q(
      `insert into ticket_messages (ticket_id, direction, from_email, to_email, subject, body_text, message_id, created_at)
       values ($1, 'in', $2, 'hello@gligor.ai', $3, $4, $5, $6)`,
      [t.id, from, subject, body, `<seed-${t.id}@voorbeeld.example>`, at],
    );
    await q("insert into log_entries (client_id, type, summary, source, ticket_id, occurred_at) values ($1, 'email', $2, 'email_in', $3, $4)", [
      client,
      `E-mail ontvangen: ${subject}`,
      t.id,
      at,
    ]);
  };
  await ticket(
    b.id,
    "Instagram-spiekbriefje werkt niet goed",
    "Hoi Gligor,\n\nAls ik het spiekbriefje voor Instagram gebruik, krijg ik steeds hele lange teksten met veel hashtags. Kan dat korter? Ik wil gewoon twee zinnen en een foto.\n\nGroetjes, Marieke",
    170,
    "Marieke de Vries <marieke@bakkerij-voorbeeld.example>",
  );
  await ticket(
    b.id,
    "Vraag over de check-in",
    "Hallo Gligor,\n\nMorgen hebben we de check-in. Moet ik iets voorbereiden? Ik heb bijgehouden hoeveel tijd ik kwijt ben aan de bestellingen.\n\nGroetjes, Marieke",
    3,
    "Marieke de Vries <marieke@bakkerij-voorbeeld.example>",
  );

  // Betalingen: alles betaald, behalve één maand bij klant 1 (te laat).
  for (const id of [a.id, b.id]) {
    const [client] = await q<import("./types").ClientRow>("select * from clients where id = $1", [id]);
    await syncPayments(q, client, today);
  }
  await q(
    `update payments set paid_at = least(due_date - 3, $1::date) where due_date < $1 and client_id in ($2, $3)`,
    [today, a.id, b.id],
  );
  await q(
    `update payments set paid_at = null where id = (
       select id from payments where client_id = $1 and kind = 'maand' and due_date < $2 order by period_start desc limit 1)`,
    [a.id, today],
  );

  // Zoals de dagelijkse job van vanochtend: geplande e-mails van vandaag klaarzetten.
  await runDaily(q, now);
}
