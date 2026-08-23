-- ═══════════════════════════════════════════════════════════════════════════════
-- Selly — Migration 003: scheduled orders and customer packages
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- HOW TO RUN
--   Supabase dashboard → SQL Editor → New query → paste → Run.
--   Safe to re-run. Independent of 001 and 002 — run them in any order.
--
-- WHY
--   People do not order when they are hungry. They order when they have a free
--   minute. A customer with time at 8pm wants breakfast at 7am, and today the
--   only way to get it is to remember to order at 6:40am — which nobody does.
--
--   Two things are needed for that, and they are deliberately separate here:
--
--     scheduled_for      WHEN the food is wanted. A property of the order.
--     customer_packages  WHETHER this customer may ask for a time at all.
--                        A property of the relationship, billed monthly.
--
-- NOT THE SAME AS THE BUSINESS SUBSCRIPTION
--   The kitchen's own subscription to Selly lives elsewhere and is billed to the
--   kitchen. This table is the CUSTOMER paying the kitchen for the convenience
--   of choosing a delivery time. Different payer, different purpose, different
--   lifecycle — so it does not share a table with business billing.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── 1 · Orders can carry a requested time ────────────────────────────────────
-- Null means "as soon as possible", which is every order placed before today.
-- That default matters: nothing about existing rows changes meaning.

alter table public.orders add column if not exists scheduled_for timestamptz;
alter table public.orders add column if not exists schedule_slot text;

comment on column public.orders.scheduled_for is
  'When the customer wants the food. Null = ASAP, which is the normal case.';
comment on column public.orders.schedule_slot is
  'Named window the time fell in: breakfast | lunch | evening | dinner | custom. '
  'Denormalised on purpose — the kitchen plans in batches, not in timestamps.';

-- The kitchen''s two real questions are "what is due in the next hour" and
-- "what does tomorrow look like". Both are business_id + scheduled_for scans,
-- and the partial index keeps ASAP orders out of an index they never use.
create index if not exists orders_business_scheduled_idx
  on public.orders (business_id, scheduled_for)
  where scheduled_for is not null;


-- ── 2 · The customer's package ───────────────────────────────────────────────
-- Keyed on mobile rather than a customer uuid: the number is the one identifier
-- that survives a customer ordering from the web, from a message, or from a new
-- device. The rest of the app already resolves customers by last-10-digits.

create table if not exists public.customer_packages (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references auth.users (id) on delete cascade,

  mobile       text not null,
  name         text,

  plan         text not null default 'schedule',   -- schedule | schedule_plus
  status       text not null default 'trial',      -- trial | active | expired | cancelled

  -- Price is stored per row rather than read from a constant, so that a kitchen
  -- can change what it charges without rewriting what existing members pay.
  price_month  numeric(10,2),

  started_at   timestamptz not null default now(),
  period_end   timestamptz,
  cancelled_at timestamptz,

  -- Free trial so the habit forms before the first charge. Null = no trial given.
  trial_ends   timestamptz,

  orders_used  int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint customer_packages_status_chk
    check (status in ('trial', 'active', 'expired', 'cancelled'))
);

comment on table public.customer_packages is
  'A customer paying a kitchen monthly for the right to schedule delivery times. '
  'Not related to the kitchen''s own Selly subscription.';

-- One live package per customer per kitchen. A cancelled row is kept for history,
-- so the uniqueness only applies to the ones that still grant access.
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


-- ── 3 · What the kitchen offers ──────────────────────────────────────────────
-- Slot windows, lead time, how far ahead bookings open and what the package
-- costs are all per-kitchen decisions. They live in the settings blob rather
-- than as columns because they are read together and written as a unit.

alter table public.business_settings
  add column if not exists schedule_config jsonb default '{}'::jsonb;

comment on column public.business_settings.schedule_config is
  'Scheduling rules for this kitchen. Shape: '
  '{ enabled, slots: [{key,label,from,to}], leadMinutes, maxDaysAhead, '
  '  packagePrice, trialDays, freeWithoutPackage }';


-- ── 4 · Keep updated_at honest ───────────────────────────────────────────────

create or replace function public.touch_customer_packages()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customer_packages_touch on public.customer_packages;
create trigger customer_packages_touch
  before update on public.customer_packages
  for each row execute function public.touch_customer_packages();


-- ── 5 · Expiring a package ───────────────────────────────────────────────────
-- Called by the app on load rather than by a cron, so a kitchen that opens the
-- app after a week away sees the right state without any scheduled job existing.

create or replace function public.expire_customer_packages(p_business uuid)
returns int
language sql
as $$
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
