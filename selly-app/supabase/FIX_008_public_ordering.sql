-- ═══════════════════════════════════════════════════════════════════════════════
-- SELLY — customers can order for themselves.  Run in the SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Until now every order was typed in by the kitchen. This is the half that lets
-- a customer scan a code, see the menu and place the order themselves.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- THE DECISION THAT MATTERS MOST HERE
--
-- The price is NEVER taken from the browser. place_public_order receives item
-- ids and quantities and looks every price up from the catalog itself. If it
-- trusted a total sent by the page, anyone could open the console and buy a
-- thali for one rupee — and the kitchen would find out at the door.
--
-- Same for the delivery fee and the free-above threshold: read from the
-- kitchen's own settings, not from whatever arrived in the request.
--
-- WHY A FUNCTION AND NOT AN INSERT POLICY
--   An insert policy would let a stranger write an orders row directly, with
--   whatever bill, status or business_id they fancied. A function accepts a
--   narrow set of arguments, computes everything that matters itself, and is the
--   only door. The orders table stays closed.
--
-- WHAT IS DELIBERATELY EXPOSED
--   Menu and kitchen details, through two views that name their columns. upi_id
--   is included — a UPI address is how people pay you, it is not a secret.
--   bank_details is not, and never should be.
--
-- WHAT THIS STILL DOES NOT SOLVE
--   Rate limiting. RLS and SQL functions cannot count requests, so nothing here
--   stops somebody scripting junk orders at a kitchen. Before this is on a
--   printed flyer, put the call behind an edge function with a per-IP limit.
--   Until then the protection is that the code is not published anywhere.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── 0 · A handle for following your own order ────────────────────────────────
-- Order ids are timestamps and therefore guessable, so they cannot be what
-- authorises reading an order. This can.

alter table public.orders add column if not exists public_token uuid default gen_random_uuid();
update public.orders set public_token = gen_random_uuid() where public_token is null;

create unique index if not exists orders_public_token_idx on public.orders (public_token);

comment on column public.orders.public_token is
  'Unguessable handle a customer uses to follow their own order. Never list it '
  'next to anybody else''s.';


-- ── 1 · A short code for the kitchen ─────────────────────────────────────────
-- The business id is a uuid; nobody prints a uuid on a flyer. This is the thing
-- the QR encodes.

alter table public.business_settings
  add column if not exists public_code text;

update public.business_settings
   set public_code = lower(substr(md5(business_id::text || 'selly'), 1, 8))
 where public_code is null;

create unique index if not exists business_settings_public_code_idx
  on public.business_settings (public_code);

comment on column public.business_settings.public_code is
  'Short code in the ordering link. Printed on flyers and packaging, so it has '
  'to be short — the business uuid is not something anyone types.';


-- ── 2 · What a stranger may see ──────────────────────────────────────────────
-- Views that name their columns. Adding a sensitive column to a base table
-- later cannot leak it here, because it would have to be named to appear.

drop view if exists public.public_kitchen;
create view public.public_kitchen as
  select
    s.public_code,
    s.business_id,
    s.business_name,
    s.city,
    s.delivery_charge,
    s.free_above,
    s.store_config,
    s.schedule_config,
    -- A UPI address is a payment destination, not a credential. bank_details is
    -- a different thing entirely and is not here.
    s.upi_id
  from public.business_settings s
  where s.public_code is not null;

grant select on public.public_kitchen to anon, authenticated;


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
    c.sizes,
    c.extra_fields,
    coalesce(c.in_stock, true) as in_stock
  from public.catalog c
  where coalesce(c.in_stock, true);

grant select on public.public_menu to anon, authenticated;


-- ── 3 · Placing the order ────────────────────────────────────────────────────
-- Items arrive as [{ "id": "...", "qty": 2, "portion": "Half",
--                    "addOns": ["Extra gravy"] }]
-- and every rupee is worked out here.

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

  -- Refuse politely when the kitchen is shut, rather than taking an order
  -- nobody is there to cook.
  if coalesce((v_biz.store_config ->> 'acceptingOrders')::boolean, true) = false then
    raise exception 'this kitchen is not taking orders right now';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty     := greatest(1, least(50, coalesce((v_item ->> 'qty')::int, 1)));
    v_portion := nullif(btrim(coalesce(v_item ->> 'portion', '')), '');

    select * into v_row from public.catalog
     where id = (v_item ->> 'id')
       and business_id::text = v_biz.business_id::text
     limit 1;
    -- Silently skipping an unknown item would let somebody pad an order with
    -- things the kitchen never listed. Refuse the whole thing instead.
    if not found then
      raise exception 'one of those dishes is no longer on the menu';
    end if;
    if coalesce(v_row.in_stock, true) = false then
      raise exception '% is sold out', v_row.name;
    end if;

    -- The portion price if there is one, the dish price otherwise. Read from
    -- the catalog, never from the request.
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

    -- Add-ons, priced the same way.
    if v_item ? 'addOns' then
      for v_addon in select * from jsonb_array_elements_text(v_item -> 'addOns') loop
        select (a ->> 'price')::numeric into v_addprice
          from jsonb_array_elements(coalesce(v_row.extra_fields -> 'addOns', '[]'::jsonb)) a
         where a ->> 'name' = v_addon
         limit 1;
        if v_addprice is not null then
          v_cart := v_cart || jsonb_build_object(
            'name', '+ ' || v_addon, 'price', v_addprice, 'qty', v_qty,
            'productNumber', ''
          );
          v_subtotal := v_subtotal + (v_addprice * v_qty);
        end if;
      end loop;
    end if;
  end loop;

  -- Delivery, from the kitchen's settings.
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

  -- Remember them, so the kitchen can reach them and so their address is
  -- offered back next time.
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


-- ── 4 · Following your own order ─────────────────────────────────────────────
-- One row, by a token nobody can guess. No listing, so it cannot be walked.

create or replace function public.track_order(p_token uuid)
returns table (
  order_id text, status text, cart jsonb, bill jsonb,
  address text, scheduled_for timestamptz, kitchen text,
  created_at timestamptz, updated_at timestamptz
)
language sql
security definer
set search_path = public
as $fn$
  select o.id, o.status, o.cart, o.bill, o.address, o.scheduled_for,
         coalesce(s.business_name, 'the kitchen'), o.created_at, o.updated_at
  from public.orders o
  left join public.business_settings s on s.business_id::text = o.business_id::text
  where o.public_token = p_token
  limit 1;
$fn$;

revoke all on function public.track_order(uuid) from public;
grant execute on function public.track_order(uuid) to anon, authenticated;
