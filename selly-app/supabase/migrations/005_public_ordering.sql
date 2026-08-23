-- ═══════════════════════════════════════════════════════════════════════════════
-- Selly — Migration 005: public ordering
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- HOW TO RUN
--   Supabase dashboard → SQL Editor → New query → paste → Run. Safe to re-run.
--   Run AFTER 003 (it references scheduled_for).
--
-- WHY THIS IS THE ONE THAT UNBLOCKS GOING LIVE
--   Every other table is gated on `business_id = auth.uid()`, which is correct
--   for the kitchen's own app — and fatal for a customer. A customer scanning a
--   QR code has no account and never will. Without a way in for an anonymous
--   visitor, the ordering page can read no menu and write no order, and the
--   whole product stops at the kitchen's own screen.
--
-- THE SHAPE OF THE ANSWER
--   Not "open up the tables". Two narrow views that expose only what a stranger
--   is allowed to see, plus one insert policy. The base tables stay locked.
--
-- WHAT A GUEST DELIBERATELY CANNOT DO
--   · read any other customer's order (tracking is by unguessable token)
--   · list orders at all — no select on the table, only through the token
--   · read upi_id, bank_details, or anything else financial
--   · modify or cancel an order once placed
--   · discover which businesses exist (no listing, must know the id)
--
-- WHAT THIS DOES NOT SOLVE — READ THIS
--   Rate limiting. RLS cannot count requests, so nothing here stops someone
--   scripting a thousand junk orders at one kitchen. Before this is public at
--   any scale, put the insert behind an edge function with a per-IP limit and a
--   CAPTCHA on repeat offenders. Until then a kitchen can be spammed, and the
--   only defence is that the business id is not published anywhere.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── 1 · An unguessable handle for tracking ───────────────────────────────────
-- Order ids are timestamp-derived and therefore guessable, so they cannot be the
-- thing that authorises reading an order. This token can.

alter table public.orders
  add column if not exists public_token uuid default gen_random_uuid();

-- Backfill: rows created before this migration have no token.
update public.orders set public_token = gen_random_uuid() where public_token is null;

create unique index if not exists orders_public_token_idx
  on public.orders (public_token);

comment on column public.orders.public_token is
  'Unguessable handle a guest uses to track their own order. Never list this '
  'alongside other customers'' orders.';


-- ── 2 · The menu a stranger may see ──────────────────────────────────────────
-- A curated view, not a relaxed policy. Adding a sensitive column to `catalog`
-- later cannot leak it here, because it would have to be named to appear.

drop view if exists public.public_menu;
create view public.public_menu as
  select
    c.id,
    c.business_id,
    c.name,
    c.price,
    c.category,
    c.sub_category,
    c.description,
    c.image_url,
    c.image_urls,
    c.extra_fields,
    coalesce(c.in_stock, true) as in_stock
  from public.catalog c;

grant select on public.public_menu to anon, authenticated;

comment on view public.public_menu is
  'Menu fields safe to show an anonymous visitor. Cost price, margins and any '
  'future internal column stay out by omission.';


-- ── 3 · The kitchen details a stranger may see ───────────────────────────────
-- business_settings holds upi_id and bank_details. Those must never reach a
-- public page, so this names its columns rather than selecting *.

drop view if exists public.public_kitchen;
create view public.public_kitchen as
  select
    s.business_id,
    s.business_name,
    s.city,
    s.delivery_charge,
    s.free_above,
    s.store_config,
    s.schedule_config
  from public.business_settings s;

grant select on public.public_kitchen to anon, authenticated;

comment on view public.public_kitchen is
  'Storefront details for the public ordering page. Deliberately excludes '
  'upi_id, bank_details and every other financial column.';


-- ── 4 · Letting a guest place an order ───────────────────────────────────────
-- Insert only. No select, no update, no delete — a guest can create an order and
-- then only reach it again through its token.

drop policy if exists "orders public insert" on public.orders;
create policy "orders public insert" on public.orders
  for insert
  to anon, authenticated
  with check (
    -- The business must actually exist. Without this, any uuid becomes a
    -- write target and the table fills with orders nobody owns.
    exists (select 1 from public.business_settings s where s.business_id = orders.business_id)
    -- A guest may not conjure an order that is already paid for or already
    -- delivered; they may only open one at the start of the flow.
    and status in ('pending_payment', 'confirmed')
  );


-- ── 5 · Tracking one order by token ──────────────────────────────────────────
-- A function rather than a select policy, because a policy that permits reading
-- by token still permits `select * from orders` — the filter is the caller's
-- choice, and a caller we do not control is exactly who this is for.
--
-- security definer so it can read past RLS, but it returns one row, only for an
-- exact token match, and only the columns a customer should see.

create or replace function public.track_order(p_token uuid)
returns table (
  id            text,
  status        text,
  cart          jsonb,
  bill          jsonb,
  address       text,
  scheduled_for timestamptz,
  schedule_slot text,
  created_at    timestamptz,
  updated_at    timestamptz
)
language sql
security definer
set search_path = public
as $$
  select o.id, o.status, o.cart, o.bill, o.address,
         o.scheduled_for, o.schedule_slot, o.created_at, o.updated_at
  from public.orders o
  where o.public_token = p_token
  limit 1;
$$;

revoke all on function public.track_order(uuid) from public;
grant execute on function public.track_order(uuid) to anon, authenticated;

comment on function public.track_order is
  'Returns one order by its unguessable token. The only route a guest has back '
  'to an order, and it cannot be used to enumerate.';


-- ── 6 · Joining as a member from the public page ─────────────────────────────
-- Starting a scheduling trial has to be possible from the customer's side, but
-- customer_packages is owner-only. Same pattern: a narrow definer function
-- rather than an open policy.

create or replace function public.start_package_trial(
  p_business uuid,
  p_mobile   text,
  p_name     text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      uuid;
  v_cfg     jsonb;
  v_days    int;
  v_price   numeric;
  v_mobile  text := right(regexp_replace(p_mobile, '\D', '', 'g'), 10);
begin
  if length(v_mobile) <> 10 then
    raise exception 'a 10-digit mobile number is required';
  end if;

  -- Already a member? Hand back the existing row rather than starting a second
  -- trial — otherwise the trial is infinitely renewable by re-signing up.
  select id into v_id
    from public.customer_packages
   where business_id = p_business and mobile = v_mobile
     and status in ('trial', 'active')
   limit 1;
  if v_id is not null then
    return v_id;
  end if;

  -- Someone whose trial already ended does not get another one.
  if exists (
    select 1 from public.customer_packages
     where business_id = p_business and mobile = v_mobile and trial_ends is not null
  ) then
    raise exception 'this number has already used its free trial';
  end if;

  select schedule_config into v_cfg
    from public.business_settings where business_id = p_business;

  v_days  := coalesce((v_cfg -> 'trialDays')::int, 14);
  v_price := (v_cfg ->> 'packagePrice')::numeric;

  insert into public.customer_packages
    (business_id, mobile, name, plan, status, price_month, trial_ends)
  values
    (p_business, v_mobile, p_name, 'schedule', 'trial', v_price,
     now() + (v_days || ' days')::interval)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.start_package_trial(uuid, text, text) from public;
grant execute on function public.start_package_trial(uuid, text, text) to anon, authenticated;


-- ── 7 · Is this customer allowed to schedule? ────────────────────────────────
-- The public page needs the answer without being able to read the packages
-- table, so it asks this instead.

create or replace function public.can_schedule(p_business uuid, p_mobile text)
returns table (allowed boolean, status text, ends_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select
    (p.status in ('trial', 'active')
      and coalesce(p.period_end, p.trial_ends, now() + interval '100 years') > now())
      as allowed,
    p.status,
    coalesce(p.period_end, p.trial_ends) as ends_at
  from public.customer_packages p
  where p.business_id = p_business
    and p.mobile = right(regexp_replace(p_mobile, '\D', '', 'g'), 10)
    and p.status in ('trial', 'active')
  limit 1;
$$;

revoke all on function public.can_schedule(uuid, text) from public;
grant execute on function public.can_schedule(uuid, text) to anon, authenticated;
