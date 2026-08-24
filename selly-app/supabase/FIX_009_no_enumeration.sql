-- ═══════════════════════════════════════════════════════════════════════════════
-- SELLY — the ordering views could be listed in bulk.  Run in the SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- WHAT WAS WRONG
--   FIX_008 exposed public_kitchen and public_menu as views with SELECT granted
--   to anon. A view answers any query put to it, so
--
--       GET /rest/v1/public_kitchen?select=*
--
--   returned every business on the platform -- names, cities, delivery charges
--   and UPI ids -- and public_menu returned every dish every kitchen sells.
--
--   The intent was always that a stranger has to know a kitchen's code before
--   they see anything. A view cannot enforce that: the filter is the caller's
--   choice, and the caller is exactly who we do not control.
--
--   Not catastrophic on its own -- a menu and a shop name are things a business
--   displays anyway -- but it is a bulk harvest of every kitchen's UPI address
--   and price list, which is not something any of them agreed to.
--
-- THE FIX
--   Two functions that take the code. No code, no answer, and nothing to walk.
--   Same pattern as every other public entry point here: driver_lookup,
--   rating_context and track_order all authorise on something presented.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── Close the open doors ─────────────────────────────────────────────────────
revoke select on public.public_kitchen from anon, authenticated;
revoke select on public.public_menu    from anon, authenticated;

drop view if exists public.public_kitchen;
drop view if exists public.public_menu;


-- ── One kitchen, by its code ─────────────────────────────────────────────────
create or replace function public.get_public_kitchen(p_code text)
returns table (
  business_id     text,
  business_name   text,
  city            text,
  delivery_charge numeric,
  free_above      numeric,
  store_config    jsonb,
  schedule_config jsonb,
  upi_id          text
)
language sql
security definer
set search_path = public
as $fn$
  select s.business_id::text,
         s.business_name,
         s.city,
         s.delivery_charge,
         s.free_above,
         s.store_config,
         s.schedule_config,
         -- A UPI address is a payment destination, not a credential. Handed out
         -- only alongside the code that identifies this one kitchen.
         s.upi_id
  from public.business_settings s
  where s.public_code = lower(btrim(p_code))
  limit 1;
$fn$;

revoke all on function public.get_public_kitchen(text) from public;
grant execute on function public.get_public_kitchen(text) to anon, authenticated;


-- ── That kitchen's menu, and only that kitchen's ─────────────────────────────
create or replace function public.get_public_menu(p_code text)
returns table (
  id           text,
  name         text,
  price        numeric,
  category     text,
  sub_category text,
  description  text,
  image_url    text,
  sizes        text[],
  extra_fields jsonb
)
language sql
security definer
set search_path = public
as $fn$
  select c.id, c.name, c.price, c.category, c.sub_category,
         c.description, c.image_url, c.sizes, c.extra_fields
  from public.catalog c
  join public.business_settings s
    on s.business_id::text = c.business_id::text
  where s.public_code = lower(btrim(p_code))
    and coalesce(c.in_stock, true)
  order by c.category nulls last, c.created_at;
$fn$;

revoke all on function public.get_public_menu(text) from public;
grant execute on function public.get_public_menu(text) to anon, authenticated;
