-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.

-- 1. Remember when each Main Till wallet was connected (older payments are never split).
alter table wallet_configs add column if not exists connected_at timestamptz not null default now();

-- 2. Earlier versions copied the server's wallets into every new account.
--    Keep each wallet only on the account that holds the authorisation (or the oldest account).
--    Other accounts will connect their own wallets.
delete from wallet_configs w
using (
  select w2.merchant_id, w2.wallet_url,
         row_number() over (
           partition by w2.wallet_url
           order by (g.token_enc is not null) desc, m.created_at asc
         ) as rn
  from wallet_configs w2
  join merchants m on m.id = w2.merchant_id
  left join grants g on g.merchant_id = w2.merchant_id
) d
where w.merchant_id = d.merchant_id and w.wallet_url = d.wallet_url and d.rn > 1;

-- 3. From now on one Main Till wallet can belong to only one account.
create unique index if not exists wallet_main_unique on wallet_configs (lower(wallet_url)) where role = 'main';
