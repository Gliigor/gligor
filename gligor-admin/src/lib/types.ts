import type { Channel, LogType, PackageKey, SetupType, Stage, TicketStatus } from "./config";
import type { PaymentKind } from "./domain/payments";

export interface ClientRow {
  id: string;
  company: string;
  sector: string | null;
  city: string | null;
  owner_name: string;
  email: string | null;
  phone: string | null;
  preferred_channel: Channel;
  package: PackageKey;
  monthly_fee: number;
  start_fee: number;
  start_date: string | null;
  end_date: string | null;
  setup_type: SetupType | null;
  users_count: number;
  stage: Stage;
  stage_changed_at: string;
  notes: string;
  tags: string[];
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LogEntryRow {
  id: string;
  client_id: string;
  occurred_at: string;
  type: LogType;
  summary: string;
  agreed_actions: string;
  follow_up_date: string | null;
  follow_up_done: boolean;
  source: "handmatig" | "email_in" | "email_uit" | "systeem";
  email_id: string | null;
  ticket_id: string | null;
  created_at: string;
}

export interface TaskRow {
  id: string;
  client_id: string | null;
  title: string;
  due_date: string | null;
  status: "open" | "klaar";
  source: "handmatig" | "logboek" | "levenscyclus" | "systeem";
  automation_key: string | null;
  log_entry_id: string | null;
  completed_at: string | null;
  created_at: string;
}

export type EmailStatus = "concept" | "gepland" | "verzonden" | "mislukt" | "geannuleerd";

export interface EmailRow {
  id: string;
  client_id: string | null;
  ticket_id: string | null;
  template_key: string | null;
  kind: "sjabloon" | "ticket" | "herinnering" | "nieuwsbrief" | "digest" | "los";
  to_email: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduled_for: string | null;
  sent_at: string | null;
  message_id: string | null;
  provider_id: string | null;
  error: string | null;
  automation_key: string | null;
  payment_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateRow {
  key: string;
  name: string;
  stage: Stage | null;
  subject: string;
  body: string;
  auto_send: boolean;
  sort: number;
  updated_at: string;
}

export interface TicketRow {
  id: string;
  number: number;
  client_id: string | null;
  subject: string;
  status: TicketStatus;
  awaiting_since: string | null;
  first_response_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketMessageRow {
  id: string;
  ticket_id: string;
  direction: "in" | "uit";
  from_email: string;
  to_email: string;
  subject: string;
  body_text: string;
  body_html: string | null;
  message_id: string | null;
  in_reply_to: string | null;
  references_header: string | null;
  email_id: string | null;
  created_at: string;
}

export interface AttachmentRow {
  id: string;
  message_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  storage_path: string;
  created_at: string;
}

export interface PaymentRow {
  id: string;
  client_id: string;
  kind: PaymentKind;
  period_start: string;
  due_date: string;
  amount: number;
  paid_at: string | null;
  cancelled: boolean;
  source: "handmatig" | "stripe";
  external_provider: string | null;
  external_id: string | null;
  created_at: string;
  updated_at: string;
}
