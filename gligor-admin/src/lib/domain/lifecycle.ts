import { addDays, addMonths } from "./dates";
import { GUARANTEE_HOURS, SETUP_LABEL, STAGES, TEMPLATE_KEYS, type PackageKey, type SetupType, type Stage } from "../config";

export interface LifecycleClient {
  id: string;
  package: PackageKey;
  start_date: string | null;
  setup_type: SetupType | null;
}

export interface PlannedTask {
  key: string;
  title: string;
  due: string;
}

export interface PlannedEmail {
  key: string;
  template: string;
  /** Datum waarop de e-mail klaar moet staan (vandaag = meteen een concept). */
  scheduledFor: string;
}

export interface StagePlan {
  tasks: PlannedTask[];
  emails: PlannedEmail[];
  /** Wordt gezet als de klant nog geen startdatum had. */
  startDate?: string;
  /** Bij opzeggen: einddatum, toekomstige betalingen en geplande e-mails vervallen. */
  endDate?: string;
  cancelFuture?: boolean;
}

export function stageIndex(stage: Stage): number {
  return STAGES.findIndex((s) => s.key === stage);
}

/**
 * Wat er automatisch gebeurt als een klant in een fase komt. Elke taak en e-mail
 * heeft een vaste sleutel, zodat terug- en weer vooruitschuiven niets dubbel maakt.
 */
export function planStageChange(client: LifecycleClient, to: Stage, today: string): StagePlan {
  const k = (part: string) => `${client.id}:${to}:${part}`;
  const plan: StagePlan = { tasks: [], emails: [] };
  const start = client.start_date ?? today;
  const notBefore = (d: string) => (d < today ? today : d);

  switch (to) {
    case "lead":
      break;

    case "kennismaking":
      plan.tasks.push({ key: k("voorbereiden"), title: "Kennismakingsgesprek voorbereiden", due: today });
      break;

    case "intake":
      plan.emails.push({ key: k("welkom"), template: TEMPLATE_KEYS.welkom, scheduledFor: today });
      plan.tasks.push({ key: k("intake-plannen"), title: "Intake plannen en voorbereiden", due: addDays(today, 2) });
      break;

    case "inrichting":
      if (!client.start_date) plan.startDate = today;
      plan.emails.push({ key: k("bevestiging"), template: TEMPLATE_KEYS.bevestigingIntake, scheduledFor: today });
      plan.tasks.push({
        key: k("inrichten"),
        title: client.setup_type ? `${SETUP_LABEL[client.setup_type]} inrichten` : "AI-tools inrichten",
        due: addDays(today, 7),
      });
      plan.tasks.push({ key: k("spiekbriefjes"), title: "Spiekbriefjes op maat maken", due: addDays(today, 7) });
      break;

    case "training":
      plan.emails.push({ key: k("klaar"), template: TEMPLATE_KEYS.inrichtingKlaar, scheduledFor: today });
      plan.tasks.push({ key: k("training"), title: "Starttraining geven", due: addDays(today, 3) });
      plan.emails.push({ key: k("checkin-2w"), template: TEMPLATE_KEYS.checkin2w, scheduledFor: notBefore(addDays(start, 14)) });
      plan.tasks.push({ key: k("checkin-2w-bellen"), title: "Check-in na 2 weken: even bellen", due: notBefore(addDays(start, 14)) });
      break;

    case "checkin":
      plan.emails.push({ key: k("garantie"), template: TEMPLATE_KEYS.garantie4w, scheduledFor: notBefore(addDays(start, 28)) });
      plan.tasks.push({
        key: k("garantie-meten"),
        title: `Garantie-evaluatie: besparing meten (minimaal ${GUARANTEE_HOURS} uur)`,
        due: notBefore(addDays(start, 28)),
      });
      break;

    case "doorlopend":
      if (client.package === "plus") {
        const q = nextQuarterlyMoment(start, today);
        plan.tasks.push(quarterlyTask(client.id, q));
        plan.emails.push(quarterlyEmail(client.id, q));
      }
      break;

    case "opgezegd":
      plan.endDate = today;
      plan.cancelFuture = true;
      plan.tasks.push({ key: k("afronden"), title: "Afronden: toegang, licenties en gegevens nalopen", due: addDays(today, 3) });
      break;
  }
  return plan;
}

/** Eerstvolgende kwartaalmoment (startdatum + 3, 6, 9 … maanden) op of na vandaag. */
export function nextQuarterlyMoment(startDate: string, today: string): string {
  for (let i = 1; i < 400; i++) {
    const d = addMonths(startDate, i * 3);
    if (d >= today) return d;
  }
  return today;
}

export function quarterlyTask(clientId: string, date: string): PlannedTask {
  return { key: `${clientId}:kwartaal:${date}:taak`, title: "Volgend proces kiezen en verbeteren", due: date };
}

export function quarterlyEmail(clientId: string, date: string): PlannedEmail {
  return { key: `${clientId}:kwartaal:${date}:mail`, template: TEMPLATE_KEYS.kwartaalUpdate, scheduledFor: date };
}
