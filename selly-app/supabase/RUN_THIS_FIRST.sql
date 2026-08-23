-- ═══════════════════════════════════════════════════════════════════════════════
-- SELLY — PHASE 1 (cloud kitchens).  RUN THIS ONE FILE. THAT IS ALL.
-- ═══════════════════════════════════════════════════════════════════════════════
--
--   Supabase dashboard  →  SQL Editor  →  New query  →  paste all of this  →  Run
--
-- Takes a few seconds. Safe to run twice. Nothing in it deletes data.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHY THIS REPLACES THE FIVE FILES IN migrations/
--
-- Those were written for the full product — cafe tables, cake occasions, a
-- jukebox, discovery, and public ordering for guests scanning a QR code. Phase 1
-- is cloud kitchen owners only, with no customer-facing page, so most of that
-- would create tables nobody reads.
--
-- This is the subset that phase 1 actually needs, and nothing else. The other
-- files stay on disk for when those phases arrive.
--
-- DELIBERATELY NOT INCLUDED
--   Public/anonymous access (old 005). With no customer-facing page yet, there
--   is nothing to open up — and an unused public write policy is just an
--   unguarded door. It gets added the day the ordering page ships, not before.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── 1 · Orders ───────────────────────────────────────────────────────────────
-- Columns the kitchen screens read. All nullable with sane defaults, so every
-- order that already exists stays valid and keeps its current meaning.

alter table public.orders add column if not exists order_kind    text  default 'standard';
alter table public.orders add column if not exists channel       text  default 'manual';
alter table public.orders add column if not exists extra         jsonb default '{}'::jsonb;

-- Scheduling. Null means "as soon as possible", which is every existing row.
alter table public.orders add column if not exists scheduled_for timestamptz;
alter table public.orders add column if not exists schedule_slot text;

comment on column public.orders.channel is
  'How the order reached us: manual (the kitchen typed it in), whatsapp, web.';
comment on column public.orders.scheduled_for is
  'When the customer wants it. Null = ASAP.';

-- The kitchen asks two questions of this table: what is due soon, and what does
-- tomorrow look like. Both are business_id + scheduled_for.
create index if not exists orders_business_scheduled_idx
  on public.orders (business_id, scheduled_for)
  where scheduled_for is not null;

create index if not exists orders_business_kind_idx
  on public.orders (business_id, order_kind);


-- ── 2 · Kitchen settings ─────────────────────────────────────────────────────
-- Trading hours, prep time, and the scheduling rules. Two blobs rather than
-- twenty columns because each is read and written as a whole.

alter table public.business_settings
  add column if not exists store_config    jsonb default '{}'::jsonb;
alter table public.business_settings
  add column if not exists schedule_config jsonb default '{}'::jsonb;

comment on column public.business_settings.store_config is
  'Trading hours, accepting-orders switch, prep minutes, delivery radius.';
comment on column public.business_settings.schedule_config is
  'Slot windows, lead time, package price, trial length.';


-- ── 3 · Customer packages ────────────────────────────────────────────────────
-- A CUSTOMER paying THIS KITCHEN monthly, which is what lets them choose a
-- delivery time. Nothing to do with what the kitchen pays Selly (section 4) —
-- opposite direction of money, so a separate table.
--
-- Keyed on mobile because the phone number is the one identifier that survives a
-- customer changing device, and the rest of the app already matches on it.

create table if not exists public.customer_packages (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references auth.users (id) on delete cascade,

  mobile       text not null,
  name         text,

  plan         text not null default 'schedule',
  status       text not null default 'trial',      -- trial | active | expired | cancelled

  -- Copied onto the row at signup, not read from settings at billing time: a
  -- kitchen raising its price must not raise it for existing members.
  price_month  numeric(10,2),

  started_at   timestamptz not null default now(),
  period_end   timestamptz,
  trial_ends   timestamptz,
  cancelled_at timestamptz,

  orders_used  int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint customer_packages_status_chk
    check (status in ('trial', 'active', 'expired', 'cancelled'))
);

-- One LIVE package per customer per kitchen. Cancelled rows are kept as history,
-- so the constraint only covers the ones still granting access.
create unique index if not exists customer_packages_live_idx
  on public.customer_packages (business_id, mobile)
  where status in ('trial', 'active');

create index if not exists customer_packages_expiry_idx
  on public.customer_packages (business_id, status, period_end);

alter table public.customer_packages enable row level security;

drop policy if exists "customer_packages owner all" on public.customer_packages;
create policy "customer_packages owner all" on public.customer_packages
  for all
  using      (business_id = auth.uid())
  with check (business_id = auth.uid());


-- ── 4 · What the kitchen pays Selly ──────────────────────────────────────────
--   Rs 1,000 once, to onboard.
--   Rs 20 per order that actually completes.
--
-- The amount OWED is never stored — it is computed from the orders table every
-- time it is shown (see lib/billing.js). A stored counter drifts the first time
-- an order is cancelled late, and then nobody can explain the bill. This table
-- holds only the agreed terms and what has been paid, which orders cannot tell us.

create table if not exists public.business_billing (
  business_id        uuid primary key references auth.users (id) on delete cascade,

  -- Columns, not constants: a kitchen signed on different terms keeps them, and
  -- a future price change cannot silently rewrite an existing agreement.
  onboarding_fee     numeric(10,2) not null default 1000,
  onboarding_paid    boolean       not null default false,
  onboarding_paid_at timestamptz,
  per_order_fee      numeric(10,2) not null default 20,

  status             text not null default 'active',
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint business_billing_status_chk check (status in ('active', 'paused', 'closed'))
);

alter table public.business_billing enable row level security;

-- Read-only to the kitchen. The fee is an agreement between two parties, not a
-- setting the paying side can edit.
drop policy if exists "business_billing owner read" on public.business_billing;
create policy "business_billing owner read" on public.business_billing
  for select using (business_id = auth.uid());


create table if not exists public.billing_payments (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references auth.users (id) on delete cascade,

  kind         text not null,          -- onboarding | orders
  period       text,                   -- 'August 2026'; null for onboarding
  amount       numeric(10,2) not null,
  orders_count int,

  method       text,
  reference    text,
  paid_at      timestamptz not null default now(),
  created_at   timestamptz not null default now(),

  constraint billing_payments_kind_chk check (kind in ('onboarding', 'orders'))
);

create index if not exists billing_payments_business_idx
  on public.billing_payments (business_id, paid_at desc);

-- One settlement per kitchen per month, so a double-submit cannot double-bill.
create unique index if not exists billing_payments_period_idx
  on public.billing_payments (business_id, period)
  where kind = 'orders' and period is not null;

alter table public.billing_payments enable row level security;

drop policy if exists "billing_payments owner read" on public.billing_payments;
create policy "billing_payments owner read" on public.billing_payments
  for select using (business_id = auth.uid());


-- ── 5 · Every kitchen gets a billing row ─────────────────────────────────────
-- Backfill for anyone who signed up already, then a trigger so nobody signing up
-- later can end up without one.

insert into public.business_billing (business_id)
select id from auth.users
on conflict (business_id) do nothing;

create or replace function public.ensure_business_billing()
returns trigger language plpgsql security definer as $$
begin
  insert into public.business_billing (business_id) values (new.id)
  on conflict (business_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_billing on auth.users;
create trigger on_auth_user_billing
  after insert on auth.users
  for each row execute function public.ensure_business_billing();


-- ── 6 · updated_at, kept honest ──────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customer_packages_touch on public.customer_packages;
create trigger customer_packages_touch
  before update on public.customer_packages
  for each row execute function public.touch_updated_at();

drop trigger if exists business_billing_touch on public.business_billing;
create trigger business_billing_touch
  before update on public.business_billing
  for each row execute function public.touch_updated_at();


-- ── 7 · Expiring lapsed packages ─────────────────────────────────────────────
-- Called by the app on load rather than by a cron job, so a kitchen that opens
-- the app after a week away sees the truth without anything scheduled existing.

create or replace function public.expire_customer_packages(p_business uuid)
returns int language sql as $$
  with expired as (
    update public.customer_packages
       set status = 'expired'
     where business_id = p_business
       and status in ('trial', 'active')
       and coalesce(period_end, trial_ends) < now()
    returning 1
  )
  select coalesce(count(*), 0)::int from expired;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- Done. Check it worked — this should return 2 rows:
--   select table_name from information_schema.tables
--    where table_name in ('customer_packages','business_billing');
-- ═══════════════════════════════════════════════════════════════════════════════
