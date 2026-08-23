-- ═══════════════════════════════════════════════════════════════════════════════
-- Selly — Migration 004: what the kitchen pays Selly
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- HOW TO RUN
--   Supabase dashboard → SQL Editor → New query → paste → Run. Safe to re-run.
--
-- THE MODEL
--   Rs 1,000 once, to onboard.
--   Rs 20 per order that actually completes.
--   Nothing else. No monthly fee, no percentage of the bill, no tiers.
--
-- WHAT IS DELIBERATELY NOT STORED
--   A running charge counter. The amount owed is COMPUTED from the orders table
--   every time it is asked for — see lib/billing.js. A stored counter drifts the
--   first time an order is cancelled late or back-dated, and then nobody can
--   explain the bill. Orders are the source of truth; this table only records
--   what has been PAID, which orders cannot tell us.
--
-- REPLACES
--   The Rs 3,000/month + 5% commission model in src/subscriptions.js and
--   src/commission.js. Those were Node modules sitting in a React Native app —
--   they could never have executed. Delete them.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── 1 · One billing row per kitchen ──────────────────────────────────────────
-- The fees are columns rather than constants so that a kitchen signed on
-- different terms keeps those terms, and a future price change cannot silently
-- rewrite what an existing kitchen agreed to.

create table if not exists public.business_billing (
  business_id       uuid primary key references auth.users (id) on delete cascade,

  onboarding_fee    numeric(10,2) not null default 1000,
  onboarding_paid   boolean       not null default false,
  onboarding_paid_at timestamptz,

  per_order_fee     numeric(10,2) not null default 20,

  status            text not null default 'active',   -- active | paused | closed
  notes             text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint business_billing_status_chk check (status in ('active', 'paused', 'closed'))
);

comment on table public.business_billing is
  'What this kitchen pays Selly: Rs 1,000 onboarding once, Rs 20 per completed order. '
  'Amounts owed are computed from the orders table, not stored here.';

alter table public.business_billing enable row level security;

-- A kitchen may read its own billing terms but must not edit them: the fee is
-- an agreement between two parties, not a user preference.
drop policy if exists "business_billing owner read" on public.business_billing;
create policy "business_billing owner read" on public.business_billing
  for select using (business_id = auth.uid());


-- ── 2 · Payments actually received ───────────────────────────────────────────

create table if not exists public.billing_payments (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references auth.users (id) on delete cascade,

  kind         text not null,                 -- onboarding | orders
  period       text,                          -- 'August 2026', null for onboarding
  amount       numeric(10,2) not null,

  -- How many orders this payment settled, so a receipt can be reconstructed
  -- even after the orders themselves are archived.
  orders_count int,

  method       text,                          -- upi | bank | cash | razorpay
  reference    text,                          -- UTR / payment id
  paid_at      timestamptz not null default now(),
  created_at   timestamptz not null default now(),

  constraint billing_payments_kind_chk check (kind in ('onboarding', 'orders'))
);

create index if not exists billing_payments_business_idx
  on public.billing_payments (business_id, paid_at desc);

-- One settlement per business per period, so a double-submit cannot double-bill.
create unique index if not exists billing_payments_period_idx
  on public.billing_payments (business_id, period)
  where kind = 'orders' and period is not null;

alter table public.billing_payments enable row level security;

drop policy if exists "billing_payments owner read" on public.billing_payments;
create policy "billing_payments owner read" on public.billing_payments
  for select using (business_id = auth.uid());


-- ── 3 · Every kitchen gets a billing row ─────────────────────────────────────
-- Backfill for anyone who signed up before this migration, then a trigger so no
-- future signup can end up without one.

insert into public.business_billing (business_id)
select id from auth.users
on conflict (business_id) do nothing;

create or replace function public.ensure_business_billing()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.business_billing (business_id)
  values (new.id)
  on conflict (business_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_billing on auth.users;
create trigger on_auth_user_billing
  after insert on auth.users
  for each row execute function public.ensure_business_billing();


-- ── 4 · Keep updated_at honest ───────────────────────────────────────────────

create or replace function public.touch_business_billing()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists business_billing_touch on public.business_billing;
create trigger business_billing_touch
  before update on public.business_billing
  for each row execute function public.touch_business_billing();
