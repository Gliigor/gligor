-- Per-firm switch for the AI document reader (Claude on Amazon Bedrock, EU).
-- Off by default: a firm owner has to turn it on explicitly, because it adds
-- a sub-processor for client documents.

alter table public.firms
  add column if not exists ai_extraction_enabled boolean not null default false,
  add column if not exists ai_extraction_changed_at timestamptz;

-- Only owners can change it: the existing firms_update_owner policy applies.
grant update (ai_extraction_enabled, ai_extraction_changed_at) on public.firms to authenticated;
