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
  'How the order reached us: manual (the kitchen typed it in), web, whatsapp. '
  'Phase 1 is manual only — the other two arrive with the ordering page.';
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


-- ── 8 · Reaching the customer ────────────────────────────────────────────────
-- The gap this closes: the old notify path resolved a customer out of
-- bot_customers, a table only the WhatsApp bot ever wrote to. An order the
-- kitchen typed in has no such row, so advancing it produced "this order isn't
-- linked to a saved customer" and no message could ever be sent.
--
-- The order already carries the mobile number. That is enough to reach someone,
-- and it does not care which app the message goes through — which is the whole
-- point of moving off a single channel.

create table if not exists public.customer_contacts (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references auth.users (id) on delete cascade,

  mobile       text not null,
  name         text,

  -- Which app to open when the kitchen sends an update. Not a hard binding:
  -- it is a default the kitchen can override per message, because a customer
  -- who does not answer on one will answer on the other.
  preferred_channel text not null default 'whatsapp',   -- whatsapp | sms

  first_seen_at  timestamptz not null default now(),
  last_contacted timestamptz,
  orders_count   int not null default 0,
  created_at     timestamptz not null default now(),

  constraint customer_contacts_channel_chk
    check (preferred_channel in ('whatsapp', 'sms'))
);

create unique index if not exists customer_contacts_mobile_idx
  on public.customer_contacts (business_id, mobile);

alter table public.customer_contacts enable row level security;

drop policy if exists "customer_contacts owner all" on public.customer_contacts;
create policy "customer_contacts owner all" on public.customer_contacts
  for all
  using      (business_id = auth.uid())
  with check (business_id = auth.uid());

comment on table public.customer_contacts is
  'Everyone this kitchen has taken an order from, keyed on mobile. Exists so a '
  'manually-entered order can be replied to without the WhatsApp bot having '
  'created the customer first.';


-- ── 9 · What was actually said ───────────────────────────────────────────────
-- Every outbound message, whichever app carried it.
--
-- 'opened' rather than 'delivered' is deliberate and worth reading. In phase 1
-- there is no aggregator and no WhatsApp Business API: the kitchen taps a button
-- and their own phone opens the chat with the text already written. We know we
-- handed it over. We do not know they pressed send, and recording 'delivered'
-- would be a claim we cannot support.

create table if not exists public.message_log (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references auth.users (id) on delete cascade,

  order_id     text,
  mobile       text not null,

  channel      text not null,                 -- whatsapp | sms | push
  status_key   text,                          -- the order status that triggered it
  body         text not null,

  outcome      text not null default 'opened', -- opened | failed | skipped
  created_at   timestamptz not null default now(),

  constraint message_log_channel_chk check (channel in ('whatsapp', 'sms', 'push')),
  constraint message_log_outcome_chk check (outcome in ('opened', 'failed', 'skipped'))
);

create index if not exists message_log_business_idx
  on public.message_log (business_id, created_at desc);
create index if not exists message_log_order_idx
  on public.message_log (order_id);

alter table public.message_log enable row level security;

drop policy if exists "message_log owner all" on public.message_log;
create policy "message_log owner all" on public.message_log
  for all
  using      (business_id = auth.uid())
  with check (business_id = auth.uid());


-- ── 10 · Ratings ─────────────────────────────────────────────────────────────
-- One tap on a face, then a few words. The words offered depend on the face,
-- because handing "great taste" to someone whose food arrived cold gets you
-- either silence or a wrong answer.

alter table public.orders
  add column if not exists rating_token uuid default gen_random_uuid();

update public.orders set rating_token = gen_random_uuid() where rating_token is null;

create unique index if not exists orders_rating_token_idx
  on public.orders (rating_token);

comment on column public.orders.rating_token is
  'Unguessable handle in the rating link. The only thing that authorises '
  'submitting a rating, so it must never appear alongside other orders.';

create table if not exists public.order_ratings (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references auth.users (id) on delete cascade,

  order_id     text not null,
  mobile       text,
  name         text,

  score        int  not null,
  -- The chips they tapped. An array rather than free text because the whole
  -- point is that it aggregates -- "arrived cold" x11 is the finding.
  keywords     text[] not null default '{}',
  comment      text,

  replied_at   timestamptz,
  created_at   timestamptz not null default now(),

  constraint order_ratings_score_chk check (score between 1 and 5)
);

-- One rating per order. Someone re-opening the link edits their answer rather
-- than stacking a second one.
create unique index if not exists order_ratings_order_idx
  on public.order_ratings (order_id);

create index if not exists order_ratings_business_idx
  on public.order_ratings (business_id, created_at desc);

alter table public.order_ratings enable row level security;

drop policy if exists "order_ratings owner all" on public.order_ratings;
create policy "order_ratings owner all" on public.order_ratings
  for all
  using      (business_id = auth.uid())
  with check (business_id = auth.uid());


-- ── 11 · Complaints ──────────────────────────────────────────────────────────
-- Moved here from the Railway endpoint. Complaint handling is part of what the
-- kitchen is paying us for, so it cannot depend on a separate service being up
-- before the kitchen can answer an unhappy customer.
--
-- A one- or two-star rating IS a complaint whether or not anyone files one, so
-- ratings open one directly (source = 'rating') and it lands in the same queue
-- as the ones the kitchen raises itself.

create table if not exists public.complaints (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references auth.users (id) on delete cascade,

  order_id     text,
  mobile       text,
  name         text,

  reason       text not null,
  detail       text,
  source       text not null default 'kitchen',   -- kitchen | rating
  rating_id    uuid references public.order_ratings (id) on delete set null,

  status       text not null default 'open',      -- open | resolved | rejected
  resolution   text,                              -- refund | credit | remake | decline
  amount       numeric(10,2),
  owner_note   text,

  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,

  constraint complaints_status_chk check (status in ('open', 'resolved', 'rejected')),
  constraint complaints_source_chk check (source in ('kitchen', 'rating'))
);

create index if not exists complaints_business_idx
  on public.complaints (business_id, status, created_at desc);

alter table public.complaints enable row level security;

drop policy if exists "complaints owner all" on public.complaints;
create policy "complaints owner all" on public.complaints
  for all
  using      (business_id = auth.uid())
  with check (business_id = auth.uid());


-- ── 12 · The rating link ─────────────────────────────────────────────────────
-- The customer has no account and never will, so these two functions are the
-- entire public surface: one to see what they are rating, one to submit. Both
-- take the token and nothing else, so neither can be used to enumerate.
--
-- No table is opened up. This is the same narrow-function pattern the ordering
-- page will use when it ships.

create or replace function public.rating_context(p_token uuid)
returns table (
  order_id       text,
  kitchen        text,
  items          jsonb,
  delivered_at   timestamptz,
  existing_score int
)
language sql
security definer
set search_path = public
as $fn$
  select o.id,
         coalesce(s.business_name, 'the kitchen'),
         o.cart,
         o.updated_at,
         r.score
  from public.orders o
  left join public.business_settings s on s.business_id = o.business_id
  left join public.order_ratings     r on r.order_id    = o.id
  where o.rating_token = p_token
  limit 1;
$fn$;

revoke all on function public.rating_context(uuid) from public;
grant execute on function public.rating_context(uuid) to anon, authenticated;


create or replace function public.submit_rating(
  p_token    uuid,
  p_score    int,
  p_keywords text[] default '{}',
  p_comment  text   default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_order  public.orders%rowtype;
  v_rating uuid;
begin
  if p_score is null or p_score < 1 or p_score > 5 then
    raise exception 'score must be between 1 and 5';
  end if;

  select * into v_order from public.orders where rating_token = p_token limit 1;
  if not found then
    raise exception 'that rating link is not valid';
  end if;

  -- Re-opening the link edits the answer rather than adding a second one.
  insert into public.order_ratings
    (business_id, order_id, mobile, name, score, keywords, comment)
  values
    (v_order.business_id, v_order.id, v_order.mobile, v_order.name,
     p_score, coalesce(p_keywords, '{}'), nullif(btrim(coalesce(p_comment, '')), ''))
  on conflict (order_id) do update
    set score      = excluded.score,
        keywords   = excluded.keywords,
        comment    = excluded.comment,
        created_at = now()
  returning id into v_rating;

  -- One or two stars is a complaint whether or not anyone files one. Opening it
  -- here puts it in the queue the kitchen already watches, instead of leaving it
  -- inside an average nobody reads.
  if p_score <= 2 then
    insert into public.complaints
      (business_id, order_id, mobile, name, reason, detail, source, rating_id)
    select v_order.business_id, v_order.id, v_order.mobile, v_order.name,
           case when array_length(coalesce(p_keywords, '{}'), 1) > 0
                then array_to_string(p_keywords, ', ')
                else 'Low rating' end,
           nullif(btrim(coalesce(p_comment, '')), ''),
           'rating', v_rating
    where not exists (select 1 from public.complaints c where c.rating_id = v_rating);
  end if;

  return v_rating;
end;
$fn$;

revoke all on function public.submit_rating(uuid, int, text[], text) from public;
grant execute on function public.submit_rating(uuid, int, text[], text) to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Done. Check it worked — this should return 2 rows:
--   select table_name from information_schema.tables
--    where table_name in ('customer_packages','business_billing',
--                         'customer_contacts','message_log',
--                         'order_ratings','complaints');
-- Expect 6 rows.
-- ═══════════════════════════════════════════════════════════════════════════════
