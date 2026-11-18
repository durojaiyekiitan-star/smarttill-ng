-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
alter table merchants add column if not exists whatsapp_number text;
alter table incoming_payments add column if not exists notified_at timestamptz;
