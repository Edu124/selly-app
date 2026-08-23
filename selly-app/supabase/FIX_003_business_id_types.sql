-- ═══════════════════════════════════════════════════════════════════════════════
-- SELLY — FIX 003.  Run this in the SQL Editor.  Includes FIX_002, so if you
-- have not run that one yet, running this covers both.
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- WHAT WENT WRONG
--   "Give a number" failed with: operator does not exist: text = uuid
--
--   Your existing public.orders table stores business_id as TEXT. Every table
--   this project added stores it as UUID, because that is what it references in
--   auth.users. So the moment a function compared one to the other, Postgres had
--   no operator for it and gave up.
--
--   It only surfaced now because the first check in the function is "does this
--   order exist" -- every probe with a made-up id returned before it ever
--   reached a comparison. A real order id got past that and hit the wall.
--
-- WHY THIS TOUCHES MORE THAN ONE FUNCTION
--   The same mismatch sits in driver_lookup, driver_update and submit_rating.
--   None of them had been run against a real order yet, so all three would have
--   failed the same way the first time a rider or customer used them. Fixing
--   only the reported one would have left two live faults to find later.
--
-- THE APPROACH
--   Compare as text on both sides, and cast to uuid only where a value is going
--   INTO a uuid column. Not converting orders.business_id itself: that column is
--   referenced by policies, indexes and existing rows, and a type change on a
--   live table is a far bigger and riskier operation than a cast.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── assign_delivery_token ────────────────────────────────────────────────────
create or replace function public.assign_delivery_token(p_order text)
returns table (token text, otp text)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_order  public.orders%rowtype;
  v_caller uuid := auth.uid();
  v_token  text;
  v_otp    text;
  v_member boolean;
  n        int;
begin
  -- Checked first and on its own: for an anonymous caller auth.uid() is NULL,
  -- and an ownership test against NULL yields NULL, which Postgres treats as
  -- false -- so the check would pass a stranger straight through.
  if v_caller is null then
    raise exception 'you must be signed in';
  end if;

  select * into v_order from public.orders where id = p_order limit 1;
  if not found then raise exception 'no such order'; end if;

  -- ::text on both sides. orders.business_id is text here, auth.uid() is uuid.
  if v_order.business_id::text is distinct from v_caller::text then
    raise exception 'not your order';
  end if;

  if v_order.token is not null and v_order.delivered_at is null then
    return query select v_order.token, v_order.delivery_otp;
    return;
  end if;

  for n in 1..99 loop
    if not exists (
      select 1 from public.orders o
       where o.business_id = v_order.business_id
         and o.token = lpad(n::text, 2, '0')
         and o.delivered_at is null
    ) then
      v_token := lpad(n::text, 2, '0');
      exit;
    end if;
  end loop;

  if v_token is null then
    raise exception 'all 99 tokens are in use -- close some deliveries first';
  end if;

  -- Members are not asked for a code.
  select exists (
    select 1 from public.customer_packages p
     where p.business_id::text = v_order.business_id::text
       and p.mobile = right(regexp_replace(coalesce(v_order.mobile, ''), '\D', '', 'g'), 10)
       and p.status in ('trial', 'active')
       and coalesce(p.period_end, p.trial_ends, now() + interval '100 years') > now()
  ) into v_member;

  v_otp := case when v_member then null
                else lpad((floor(random() * 10000))::int::text, 4, '0') end;

  update public.orders set token = v_token, delivery_otp = v_otp where id = p_order;

  return query select v_token, v_otp;
end;
$fn$;

revoke all on function public.assign_delivery_token(text) from public;
revoke all on function public.assign_delivery_token(text) from anon;
grant execute on function public.assign_delivery_token(text) to authenticated;


-- ── driver_lookup ────────────────────────────────────────────────────────────
create or replace function public.driver_lookup(p_code uuid, p_token text)
returns table (
  order_id text, token text, customer text, mobile text, address text,
  items jsonb, amount numeric, payment_mode text, needs_otp boolean,
  kitchen text, kitchen_phone text, picked_up boolean, delivered boolean,
  slack_mins int
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_partner public.delivery_partners%rowtype;
  v_order   public.orders%rowtype;
begin
  select * into v_partner from public.delivery_partners
   where access_code = p_code and active limit 1;
  if not found then raise exception 'this delivery link is not valid'; end if;

  select * into v_order from public.orders
   where business_id::text = v_partner.business_id::text
     and token = upper(btrim(p_token))
     and delivered_at is null
   limit 1;
  if not found then raise exception 'no open order with that token'; end if;

  update public.delivery_partners set last_used_at = now() where id = v_partner.id;

  insert into public.delivery_events (business_id, order_id, partner_id, event)
  values (v_partner.business_id, v_order.id, v_partner.id, 'looked_up');

  return query
    select v_order.id, v_order.token, v_order.name, v_order.mobile, v_order.address,
           v_order.cart, (v_order.bill ->> 'total')::numeric, v_order.payment_mode,
           (v_order.delivery_otp is not null),
           coalesce(s.business_name, 'Kitchen'),
           coalesce(s.whatsapp_number, ''),
           (v_order.picked_up_at is not null),
           false,
           (extract(epoch from (
             coalesce(v_order.scheduled_for, v_order.created_at + interval '45 minutes') - now()
           )) / 60)::int
      from public.business_settings s
     where s.business_id::text = v_partner.business_id::text;
end;
$fn$;

revoke all on function public.driver_lookup(uuid, text) from public;
grant execute on function public.driver_lookup(uuid, text) to anon, authenticated;


-- ── driver_update ────────────────────────────────────────────────────────────
create or replace function public.driver_update(
  p_code uuid, p_token text, p_event text,
  p_otp text default null, p_driver text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_partner public.delivery_partners%rowtype;
  v_order   public.orders%rowtype;
begin
  select * into v_partner from public.delivery_partners
   where access_code = p_code and active limit 1;
  if not found then raise exception 'this delivery link is not valid'; end if;

  select * into v_order from public.orders
   where business_id::text = v_partner.business_id::text
     and token = upper(btrim(p_token))
     and delivered_at is null
   limit 1;
  if not found then raise exception 'no open order with that token'; end if;

  if p_event = 'picked_up' then
    update public.orders
       set picked_up_at = now(),
           driver_name  = coalesce(p_driver, driver_name),
           status       = 'out_for_delivery'
     where id = v_order.id;

    insert into public.delivery_events (business_id, order_id, partner_id, event, driver_name)
    values (v_partner.business_id, v_order.id, v_partner.id, 'picked_up', p_driver);
    return 'picked_up';

  elsif p_event = 'delivered' then
    -- Only enforced when one was issued. Members are given no code by design,
    -- and demanding one they never received would strand every regular.
    if v_order.delivery_otp is not null then
      if p_otp is null or btrim(p_otp) <> v_order.delivery_otp then
        insert into public.delivery_events (business_id, order_id, partner_id, event, driver_name, detail)
        values (v_partner.business_id, v_order.id, v_partner.id, 'otp_failed', p_driver, 'wrong code');
        raise exception 'that code does not match';
      end if;
    end if;

    update public.orders
       set delivered_at    = now(),
           otp_verified_at = case when v_order.delivery_otp is not null then now() end,
           driver_name     = coalesce(p_driver, driver_name),
           status          = 'delivered',
           token           = null
     where id = v_order.id;

    insert into public.delivery_events (business_id, order_id, partner_id, event, driver_name)
    values (v_partner.business_id, v_order.id, v_partner.id, 'delivered', p_driver);
    return 'delivered';
  end if;

  raise exception 'unknown event';
end;
$fn$;

revoke all on function public.driver_update(uuid, text, text, text, text) from public;
grant execute on function public.driver_update(uuid, text, text, text, text) to anon, authenticated;


-- ── rating_context ───────────────────────────────────────────────────────────
create or replace function public.rating_context(p_token uuid)
returns table (
  order_id text, kitchen text, items jsonb,
  delivered_at timestamptz, existing_score int
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
  left join public.business_settings s on s.business_id::text = o.business_id::text
  left join public.order_ratings     r on r.order_id          = o.id
  where o.rating_token = p_token
  limit 1;
$fn$;

revoke all on function public.rating_context(uuid) from public;
grant execute on function public.rating_context(uuid) to anon, authenticated;


-- ── submit_rating ────────────────────────────────────────────────────────────
-- order_ratings.business_id and complaints.business_id are uuid, so the value
-- coming off orders has to be cast on the way in, not just compared.
create or replace function public.submit_rating(
  p_token uuid, p_score int,
  p_keywords text[] default '{}', p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_order  public.orders%rowtype;
  v_biz    uuid;
  v_rating uuid;
begin
  if p_score is null or p_score < 1 or p_score > 5 then
    raise exception 'score must be between 1 and 5';
  end if;

  select * into v_order from public.orders where rating_token = p_token limit 1;
  if not found then raise exception 'that rating link is not valid'; end if;

  v_biz := v_order.business_id::text::uuid;

  insert into public.order_ratings
    (business_id, order_id, mobile, name, score, keywords, comment)
  values
    (v_biz, v_order.id, v_order.mobile, v_order.name,
     p_score, coalesce(p_keywords, '{}'), nullif(btrim(coalesce(p_comment, '')), ''))
  on conflict (order_id) do update
    set score = excluded.score, keywords = excluded.keywords,
        comment = excluded.comment, created_at = now()
  returning id into v_rating;

  -- One or two stars is a complaint whether or not anyone files one.
  if p_score <= 2 then
    insert into public.complaints
      (business_id, order_id, mobile, name, reason, detail, source, rating_id)
    select v_biz, v_order.id, v_order.mobile, v_order.name,
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


revoke all on function public.expire_customer_packages(uuid) from anon;
grant execute on function public.expire_customer_packages(uuid) to authenticated;
