-- ═══════════════════════════════════════════════════════════════════════════════
-- SELLY — FIX 004.  Run in the SQL Editor. Small, and the last of this run.
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- WHAT WENT WRONG
--   Looking a packet up on the rider page failed with:
--       column reference "token" is ambiguous
--
--   driver_lookup declares an OUT column named `token`, and its query also
--   filters on orders.token. Inside a plpgsql function an OUT parameter is a
--   variable in scope, so a bare `token` could mean either, and Postgres
--   refuses to guess.
--
--   assign_delivery_token has the same OUT name but already aliased its table,
--   which is why that half worked and this half did not.
--
-- THE FIX
--   Alias the table and qualify every column. Applied to driver_update as well:
--   it has no OUT columns today so it cannot hit this, but the same query would
--   break the moment anyone gave it one, and leaving one of a matched pair
--   unqualified is how that gets missed.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════


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
  select * into v_partner
    from public.delivery_partners dp
   where dp.access_code = p_code and dp.active
   limit 1;
  if not found then raise exception 'this delivery link is not valid'; end if;

  -- Every column qualified: `token` alone would be read as this function's own
  -- OUT parameter just as readily as the column.
  select * into v_order
    from public.orders o
   where o.business_id::text = v_partner.business_id::text
     and o.token = upper(btrim(p_token))
     and o.delivered_at is null
   limit 1;
  if not found then raise exception 'no open order with that token'; end if;

  update public.delivery_partners dp set last_used_at = now() where dp.id = v_partner.id;

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
  select * into v_partner
    from public.delivery_partners dp
   where dp.access_code = p_code and dp.active
   limit 1;
  if not found then raise exception 'this delivery link is not valid'; end if;

  select * into v_order
    from public.orders o
   where o.business_id::text = v_partner.business_id::text
     and o.token = upper(btrim(p_token))
     and o.delivered_at is null
   limit 1;
  if not found then raise exception 'no open order with that token'; end if;

  if p_event = 'picked_up' then
    update public.orders o
       set picked_up_at = now(),
           driver_name  = coalesce(p_driver, o.driver_name),
           status       = 'out_for_delivery'
     where o.id = v_order.id;

    insert into public.delivery_events (business_id, order_id, partner_id, event, driver_name)
    values (v_partner.business_id, v_order.id, v_partner.id, 'picked_up', p_driver);
    return 'picked_up';

  elsif p_event = 'delivered' then
    -- Only enforced when one was issued. Members get no code by design, and
    -- demanding one they never received would strand every regular customer.
    if v_order.delivery_otp is not null then
      if p_otp is null or btrim(p_otp) <> v_order.delivery_otp then
        insert into public.delivery_events (business_id, order_id, partner_id, event, driver_name, detail)
        values (v_partner.business_id, v_order.id, v_partner.id, 'otp_failed', p_driver, 'wrong code');
        raise exception 'that code does not match';
      end if;
    end if;

    update public.orders o
       set delivered_at    = now(),
           otp_verified_at = case when v_order.delivery_otp is not null then now() end,
           driver_name     = coalesce(p_driver, o.driver_name),
           status          = 'delivered',
           -- Freed for reuse; the sticker is going in the bin either way.
           token           = null
     where o.id = v_order.id;

    insert into public.delivery_events (business_id, order_id, partner_id, event, driver_name)
    values (v_partner.business_id, v_order.id, v_partner.id, 'delivered', p_driver);
    return 'delivered';
  end if;

  raise exception 'unknown event';
end;
$fn$;

revoke all on function public.driver_update(uuid, text, text, text, text) from public;
grant execute on function public.driver_update(uuid, text, text, text, text) to anon, authenticated;
