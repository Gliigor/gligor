import { Pill, type Tone } from "./ui";
import { STAGE_LABEL, TICKET_STATUS_LABEL, type Stage, type TicketStatus } from "@/lib/config";
import { PAYMENT_STATUS_LABEL, type PaymentStatus } from "@/lib/domain/payments";
import type { DeadlineState } from "@/lib/domain/tickets";

const STAGE_TONE: Record<Stage, Tone> = {
  lead: "grey",
  kennismaking: "blue",
  intake: "blue",
  inrichting: "amber",
  training: "amber",
  checkin: "amber",
  doorlopend: "green",
  opgezegd: "grey",
};

export function StagePill({ stage }: { stage: Stage }) {
  return <Pill tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Pill>;
}

const PAYMENT_TONE: Record<PaymentStatus, Tone> = {
  betaald: "green",
  op_tijd: "green",
  openstaand: "amber",
  te_laat: "red",
  geannuleerd: "grey",
};

export function PaymentPill({ status }: { status: PaymentStatus }) {
  return <Pill tone={PAYMENT_TONE[status]}>{PAYMENT_STATUS_LABEL[status]}</Pill>;
}

const TICKET_TONE: Record<TicketStatus, Tone> = { nieuw: "blue", open: "amber", wacht_op_klant: "grey", opgelost: "green" };

export function TicketPill({ status }: { status: TicketStatus }) {
  return <Pill tone={TICKET_TONE[status]}>{TICKET_STATUS_LABEL[status]}</Pill>;
}

export function DeadlinePill({ state, label }: { state: DeadlineState | null; label: string }) {
  if (!state) return <Pill tone="grey">{label}</Pill>;
  return <Pill tone={state === "te_laat" ? "red" : state === "bijna" ? "amber" : "green"}>{label}</Pill>;
}
