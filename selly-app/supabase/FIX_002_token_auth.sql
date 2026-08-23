-- ═══════════════════════════════════════════════════════════════════════════════
-- SELLY — SECURITY FIX. Run this in the SQL Editor, same as before.
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- WHAT WAS WRONG
--   assign_delivery_token guarded itself with:
--
--       if v_order.business_id <> auth.uid() then raise exception ...
--
--   For an anonymous caller auth.uid() is NULL, and `something <> NULL` is NULL,
--   not true. Postgres treats a NULL condition as false, so the exception never
--   fired and the function carried on. Order ids are timestamps, so they are
--   guessable -- meaning a stranger could ask for a token on someone else's
--   order and be handed back the customer's delivery OTP.
--
--   The function is SECURITY DEFINER, so it was running with owner rights while
--   doing that. Two mistakes compounding: a NULL-unsafe comparison, and relying
--   on a GRANT that Supabase's default privileges had already widened.
--
-- WHAT THIS CHANGES
--   1. Rejects a null caller explicitly, before anything else.
--   2. Revokes execute from anon, so the grant matches the intent instead of
--      depending on the function's own check as the only line of defence.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════

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
  -- First, and separately from the ownership test. An anonymous caller has no
  -- business here at all, and "is this yours" cannot be answered for somebody
  -- who is nobody.
  if v_caller is null then
    raise exception 'you must be signed in';
  end if;

  select * into v_order from public.orders where id = p_order limit 1;
  if not found then raise exception 'no such order'; end if;

  if v_order.business_id is distinct from v_caller then
    raise exception 'not your order';
  end if;

  -- Already handed over: give back what it has rather than reissuing, so a
  -- second tap cannot invalidate a sticker that is already on a packet.
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
     where p.business_id = v_order.business_id
       and p.mobile      = right(regexp_replace(coalesce(v_order.mobile, ''), '\D', '', 'g'), 10)
       and p.status in ('trial', 'active')
       and coalesce(p.period_end, p.trial_ends, now() + interval '100 years') > now()
  ) into v_member;

  v_otp := case when v_member then null
                else lpad((floor(random() * 10000))::int::text, 4, '0') end;

  update public.orders
     set token = v_token, delivery_otp = v_otp
   where id = p_order;

  return query select v_token, v_otp;
end;
$fn$;

-- Supabase's default privileges hand execute on new public functions to anon as
-- well, so revoking from PUBLIC alone left anon holding a grant. Name it.
revoke all on function public.assign_delivery_token(text) from public;
revoke all on function public.assign_delivery_token(text) from anon;
grant execute on function public.assign_delivery_token(text) to authenticated;


-- ── The same class of check, audited elsewhere ───────────────────────────────
-- driver_lookup, driver_update, rating_context and submit_rating do not use
-- auth.uid() at all -- they authorise on a token that has to be presented, so
-- a null caller is expected and harmless there. They need no change.
--
-- expire_customer_packages takes the business id as an argument and only ever
-- expires rows that have already lapsed, so it cannot leak or grant anything.
-- Tightened anyway, on the principle that a function nobody anonymous should
-- call should not be callable anonymously.
revoke all on function public.expire_customer_packages(uuid) from anon;
grant execute on function public.expire_customer_packages(uuid) to authenticated;
