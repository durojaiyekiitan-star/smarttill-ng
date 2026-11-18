-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
alter table merchants add column if not exists full_name text;
alter table merchants add column if not exists phone text;
alter table merchants add column if not exists business_type text;
alter table merchants add column if not exists location text;
