-- ═══════════════════════════════════════════════════════════════════════════════
-- SELLY — payment is not delivery.  Run in the SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- WHAT WAS WRONG
--   A cloud kitchen order counted as settled the moment it was marked
--   delivered. Delivery status was doing double duty as payment status, so
--   there was no way to record the case that actually costs a kitchen money:
--   delivered, and still not paid for.
--
--   For cash on delivery that conflation is usually harmless -- the rider takes
--   the cash at the door. It is wrong the moment a rider comes back without it,
--   and wrong for every UPI order where the customer said they would pay and
--   then did not.
--
-- WHAT THIS ADDS
--   paid_at      when the money actually arrived. Null means it has not.
--   payment_ref  the UTR or note the kitchen matched it against.
--
--   Nothing is backfilled as paid. Marking historical orders paid because they
--   were delivered would bake the same assumption into the data permanently,
--   and this migration exists to stop making it. Old orders show as unpaid
--   until somebody says otherwise, which is at least honest.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════

alter table public.orders add column if not exists paid_at     timestamptz;
alter table public.orders add column if not exists payment_ref text;

comment on column public.orders.paid_at is
  'When payment actually arrived. Null means unpaid -- deliberately NOT implied '
  'by delivery, which is a different question.';
comment on column public.orders.payment_ref is
  'UTR or reference the kitchen matched the payment against.';

-- "What is still owed" is the question this table gets asked most often once a
-- kitchen has any volume, and it is always scoped to one business.
create index if not exists orders_business_unpaid_idx
  on public.orders (business_id, created_at desc)
  where paid_at is null;


-- ── Cash on delivery settles itself at the door ──────────────────────────────
-- For a COD order the rider taking the cash IS the payment, so making the
-- kitchen confirm it separately would be busywork for the common case. Every
-- other mode still has to be confirmed by somebody seeing the money.
--
-- A rider who comes back without the cash is the exception, and the kitchen can
-- un-mark it -- which is the whole reason paid_at is now its own field.

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
           token           = null,
           -- Cash handed over at the door. Only for COD, and only if it was not
           -- already settled some other way.
           paid_at         = case
                               when o.paid_at is not null then o.paid_at
                               when coalesce(o.payment_mode, 'cod') = 'cod' then now()
                               else null
                             end,
           payment_ref     = case
                               when o.paid_at is null
                                and coalesce(o.payment_mode, 'cod') = 'cod'
                               then 'Cash collected on delivery'
                               else o.payment_ref
                             end
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
