-- ═══════════════════════════════════════════════════════════════════════════════
-- SELLY — the ordering page ignored trading hours.  Run in the SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- WHAT WAS WRONG
--   place_public_order only checked store_config.acceptingOrders, the manual
--   pause switch. It never looked at the kitchen's trading hours.
--
--   So the app's own dashboard would say "not taking orders — outside today's
--   hours" while the public link cheerfully accepted an order at 3am. Food gets
--   promised that nobody is there to cook, and the customer finds out by it
--   never arriving.
--
--   Trading hours exist precisely to stop that. The kitchen screens honour them;
--   the one surface a customer actually touches did not.
--
-- THE SHAPE OF store_config.hours
--   An array of seven entries, index 0 = Sunday, each {open, close} in "HH:MM",
--   or null for a day the kitchen does not trade. A close earlier than the open
--   means past midnight — "18:00 to 02:00" is a normal late-night kitchen and
--   a naive open <= now <= close gets it wrong every time.
--
-- TIMEZONE
--   Asia/Kolkata explicitly. The database runs in UTC, so "is it inside 10:00
--   to 23:00" asked in UTC is wrong by five and a half hours — which would shut
--   a kitchen at 5:30pm and open it at 4:30am.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════

create or replace function public.kitchen_is_open(p_config jsonb)
returns boolean
language plpgsql
stable
as $fn$
declare
  v_now   timestamptz := now();
  v_local timestamp;
  v_dow   int;
  v_mins  int;
  v_day   jsonb;
  v_open  int;
  v_close int;
begin
  -- The manual switch wins. A kitchen that has paused itself is shut even
  -- inside its hours -- that is the entire point of the switch.
  if coalesce((p_config ->> 'acceptingOrders')::boolean, true) = false then
    return false;
  end if;

  if p_config -> 'hours' is null or jsonb_typeof(p_config -> 'hours') <> 'array' then
    return true;   -- no hours set: assume open rather than locking them out
  end if;

  v_local := v_now at time zone 'Asia/Kolkata';
  v_dow   := extract(dow from v_local)::int;              -- 0 = Sunday
  v_mins  := extract(hour from v_local)::int * 60 + extract(minute from v_local)::int;

  v_day := p_config -> 'hours' -> v_dow;
  if v_day is null or jsonb_typeof(v_day) = 'null' then
    return false;                                         -- closed that day
  end if;

  v_open  := split_part(v_day ->> 'open',  ':', 1)::int * 60
           + split_part(v_day ->> 'open',  ':', 2)::int;
  v_close := split_part(v_day ->> 'close', ':', 1)::int * 60
           + split_part(v_day ->> 'close', ':', 2)::int;

  if v_close > v_open then
    return v_mins >= v_open and v_mins < v_close;
  end if;

  -- Past midnight: open 18:00, close 02:00 covers both ends of the clock.
  return v_mins >= v_open or v_mins < v_close;
end;
$fn$;


-- Rebuilt only to swap the one check. Everything else is unchanged from FIX_008.
create or replace function public.place_public_order(
  p_code        text,
  p_name        text,
  p_mobile      text,
  p_address     text,
  p_items       jsonb,
  p_payment     text default 'cod',
  p_note        text default null,
  p_scheduled   timestamptz default null
)
returns table (order_id text, total numeric, rating_token uuid, public_token uuid)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_biz      public.business_settings%rowtype;
  v_item     jsonb;
  v_row      public.catalog%rowtype;
  v_qty      int;
  v_portion  text;
  v_unit     numeric;
  v_cart     jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
  v_delivery numeric := 0;
  v_addon    text;
  v_addprice numeric;
  v_id       text;
  v_mobile   text := right(regexp_replace(coalesce(p_mobile, ''), '\D', '', 'g'), 10);
  v_rating   uuid;
  v_public   uuid;
begin
  if length(v_mobile) <> 10 then
    raise exception 'a 10-digit mobile number is required';
  end if;
  if coalesce(btrim(p_address), '') = '' then
    raise exception 'a delivery address is required';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'the order is empty';
  end if;

  select * into v_biz from public.business_settings
   where public_code = lower(btrim(p_code)) limit 1;
  if not found then raise exception 'that ordering link is not valid'; end if;

  -- Manual pause AND trading hours, in the kitchen's own timezone.
  if not public.kitchen_is_open(coalesce(v_biz.store_config, '{}'::jsonb)) then
    raise exception 'this kitchen is closed right now';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty     := greatest(1, least(50, coalesce((v_item ->> 'qty')::int, 1)));
    v_portion := nullif(btrim(coalesce(v_item ->> 'portion', '')), '');

    select * into v_row from public.catalog
     where id = (v_item ->> 'id')
       and business_id::text = v_biz.business_id::text
     limit 1;
    if not found then
      raise exception 'one of those dishes is no longer on the menu';
    end if;
    if coalesce(v_row.in_stock, true) = false then
      raise exception '% is sold out', v_row.name;
    end if;

    v_unit := coalesce(
      (v_row.extra_fields -> 'portionPrices' ->> v_portion)::numeric,
      v_row.price
    );

    v_cart := v_cart || jsonb_build_object(
      'name',  case when v_portion is null then v_row.name
                    else v_row.name || ' (' || v_portion || ')' end,
      'price', v_unit,
      'qty',   v_qty,
      'productNumber', coalesce(v_row.product_number, '')
    );
    v_subtotal := v_subtotal + (v_unit * v_qty);

    if v_item ? 'addOns' then
      for v_addon in select * from jsonb_array_elements_text(v_item -> 'addOns') loop
        select (a ->> 'price')::numeric into v_addprice
          from jsonb_array_elements(coalesce(v_row.extra_fields -> 'addOns', '[]'::jsonb)) a
         where a ->> 'name' = v_addon
         limit 1;
        if v_addprice is not null then
          v_cart := v_cart || jsonb_build_object(
            'name', '+ ' || v_addon, 'price', v_addprice, 'qty', v_qty, 'productNumber', ''
          );
          v_subtotal := v_subtotal + (v_addprice * v_qty);
        end if;
      end loop;
    end if;
  end loop;

  v_delivery := coalesce(v_biz.delivery_charge, 0);
  if coalesce(v_biz.free_above, 0) > 0 and v_subtotal >= v_biz.free_above then
    v_delivery := 0;
  end if;

  v_id     := (extract(epoch from clock_timestamp()) * 1000)::bigint::text;
  v_rating := gen_random_uuid();
  v_public := gen_random_uuid();

  insert into public.orders (
    id, business_id, name, mobile, cart, bill, address,
    payment_mode, status, source, channel, order_kind,
    scheduled_for, extra, rating_token, public_token, created_at, updated_at
  ) values (
    v_id, v_biz.business_id, coalesce(nullif(btrim(p_name), ''), 'Guest'), v_mobile,
    v_cart,
    jsonb_build_object('subtotal', v_subtotal, 'discount', 0,
                       'delivery', v_delivery, 'total', v_subtotal + v_delivery),
    btrim(p_address),
    case when p_payment in ('cod', 'upi') then p_payment else 'cod' end,
    'confirmed', 'web', 'web',
    case when p_scheduled is null then 'standard' else 'scheduled' end,
    p_scheduled,
    case when nullif(btrim(coalesce(p_note, '')), '') is null then '{}'::jsonb
         else jsonb_build_object('note', btrim(p_note)) end,
    v_rating, v_public, now(), now()
  );

  insert into public.customer_contacts (business_id, mobile, name, addresses)
  values (
    v_biz.business_id::text::uuid, v_mobile, nullif(btrim(p_name), ''),
    jsonb_build_array(jsonb_build_object(
      'label', 'Home', 'address', btrim(p_address), 'usedAt', now()))
  )
  on conflict (business_id, mobile) do update
    set name = coalesce(excluded.name, public.customer_contacts.name);

  return query select v_id, v_subtotal + v_delivery, v_rating, v_public;
end;
$fn$;

revoke all on function public.place_public_order(text, text, text, text, jsonb, text, text, timestamptz) from public;
grant execute on function public.place_public_order(text, text, text, text, jsonb, text, text, timestamptz) to anon, authenticated;


-- ── Tell the page, so it can say so before anyone fills a cart ───────────────
-- Dropped first, not replaced. This adds is_open to the returned columns, and
-- Postgres refuses to change a function's OUT parameters through CREATE OR
-- REPLACE -- the row type is part of its identity. Nothing depends on it in the
-- database, so dropping is safe; the grant is reissued below.
drop function if exists public.get_public_kitchen(text);

create function public.get_public_kitchen(p_code text)
returns table (
  business_id     text,
  business_name   text,
  city            text,
  delivery_charge numeric,
  free_above      numeric,
  store_config    jsonb,
  schedule_config jsonb,
  upi_id          text,
  is_open         boolean
)
language sql
security definer
set search_path = public
as $fn$
  select s.business_id::text, s.business_name, s.city,
         s.delivery_charge, s.free_above, s.store_config, s.schedule_config,
         s.upi_id,
         public.kitchen_is_open(coalesce(s.store_config, '{}'::jsonb))
  from public.business_settings s
  where s.public_code = lower(btrim(p_code))
  limit 1;
$fn$;

revoke all on function public.get_public_kitchen(text) from public;
grant execute on function public.get_public_kitchen(text) to anon, authenticated;
