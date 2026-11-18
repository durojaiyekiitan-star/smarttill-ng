-- SmartTill NG schema. Run once in Supabase: SQL Editor -> New query -> paste -> Run.
create extension if not exists pgcrypto;

create table if not exists merchants (
  id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null default 'My shop',
  sync_lock_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists wallet_configs (
  merchant_id uuid not null references merchants(id) on delete cascade,
  role text not null check (role in ('main','reserve','owner')),
  wallet_url text not null,
  primary key (merchant_id, role)
);

create table if not exists allocation_settings (
  merchant_id uuid primary key references merchants(id) on delete cascade,
  reserve_percent int not null default 70 check (reserve_percent between 1 and 99),
  owner_percent int not null default 30 check (owner_percent between 1 and 99),
  updated_at timestamptz not null default now(),
  constraint percentages_total_100 check (reserve_percent + owner_percent = 100)
);

-- Holds encrypted grant tokens. RLS is enabled with NO policies, so only the server (service role) can read it.
create table if not exists grants (
  merchant_id uuid primary key references merchants(id) on delete cascade,
  token_enc text, manage_url text, authorized_at timestamptz,
  limit_value text, asset_code text, asset_scale int,
  pending_nonce text, pending_interact_nonce text, pending_continue_uri text,
  pending_continue_token_enc text, pending_auth_server text,
  updated_at timestamptz not null default now()
);

-- One row per sale. This is the transaction record.
create table if not exists incoming_payments (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  mode text not null check (mode in ('testnet','demo')),
  reference text not null unique,
  op_url text not null,
  received_value text not null,
  asset_code text not null,
  asset_scale int not null,
  description text,
  reserve_percent int not null,
  owner_percent int not null,
  status text not null check (status in ('pending','processing','completed','partial','failed')),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, mode, op_url)   -- duplicate protection: one record per incoming payment
);
create index if not exists incoming_merchant_time on incoming_payments (merchant_id, mode, occurred_at desc);

create table if not exists outgoing_payments (
  id uuid primary key default gen_random_uuid(),
  incoming_payment_id uuid not null references incoming_payments(id) on delete cascade,
  merchant_id uuid not null references merchants(id) on delete cascade,
  role text not null check (role in ('reserve','owner')),
  debit_value text not null,
  asset_code text not null,
  asset_scale int not null,
  status text not null check (status in ('pending','processing','completed','failed','skipped')),
  quote_id text, op_url text, sent_value text, received_value text, error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (incoming_payment_id, role)   -- one leg per destination per sale
);
create index if not exists outgoing_merchant_status on outgoing_payments (merchant_id, status);

create table if not exists audit_log (
  id bigserial primary key,
  merchant_id uuid references merchants(id) on delete cascade,
  event text not null,
  ref text,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- Row level security: a signed-in merchant can only read their own rows. All writes go through the server.
alter table merchants enable row level security;
alter table wallet_configs enable row level security;
alter table allocation_settings enable row level security;
alter table grants enable row level security;
alter table incoming_payments enable row level security;
alter table outgoing_payments enable row level security;
alter table audit_log enable row level security;

create policy "own merchant" on merchants for select using (id = auth.uid());
create policy "own wallets" on wallet_configs for select using (merchant_id = auth.uid());
create policy "own settings" on allocation_settings for select using (merchant_id = auth.uid());
create policy "own incoming" on incoming_payments for select using (merchant_id = auth.uid());
create policy "own outgoing" on outgoing_payments for select using (merchant_id = auth.uid());
create policy "own audit" on audit_log for select using (merchant_id = auth.uid());
