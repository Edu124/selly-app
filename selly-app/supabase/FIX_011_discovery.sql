-- ═══════════════════════════════════════════════════════════════════════════════
-- SELLY — customers find a kitchen near them.  Run in the SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- RUN FIX_010 FIRST. The functions here call kitchen_is_open, which FIX_010
-- creates; run them the other way round and this one fails on a missing
-- function rather than doing anything useful.
--
-- Until now a customer needed a particular kitchen's link. This is the Selly
-- front door: tell us where you are, see the kitchens that can reach you, pick
-- one, order.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- HOW "WITHIN 5 KM" IS ACTUALLY WORKED OUT
--
-- Both ends give real coordinates, and neither costs anything:
--
--   the kitchen   sets its location once from the app, using the browser's own
--                 geolocation. One tap, stored here.
--   the customer  the same, from the ordering page, with their permission.
--
-- No geocoding API, no Maps key, no per-request cost. The trade is that a
-- kitchen which never sets its location cannot be found by distance — so it
-- falls back to matching on city, which is crude but better than being invisible.
--
-- Distance is haversine in SQL rather than PostGIS: one formula, no extension to
-- enable, and at this scale the difference is unmeasurable.
--
-- WHAT A CUSTOMER CAN SEE
--   Only kitchens that are open, have a menu, and have said they want to be
--   listed. A kitchen using Selly purely as a till for its own customers should
--   not be advertised to strangers without asking.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── 1 · Where the kitchen is, and whether it wants to be found ───────────────

alter table public.business_settings add column if not exists lat numeric(9,6);
alter table public.business_settings add column if not exists lng numeric(9,6);
alter table public.business_settings add column if not exists listed boolean not null default false;
alter table public.business_settings add column if not exists delivery_radius_km numeric(5,2) default 5;
alter table public.business_settings add column if not exists cuisine text;

comment on column public.business_settings.listed is
  'Whether this kitchen appears in Selly discovery. Off by default — a kitchen '
  'using Selly as a till for its own customers has not asked to be advertised.';
comment on column public.business_settings.delivery_radius_km is
  'How far this kitchen will actually deliver. Its answer, not ours: a tiffin '
  'service doing 2 km and a biryani place doing 8 km are both normal.';


-- ── 2 · Distance ─────────────────────────────────────────────────────────────
-- Haversine. Immutable so it can be used in an index later if this ever needs it.

create or replace function public.km_between(
  lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric
)
returns numeric
language sql
immutable
as $fn$
  select round((
    6371 * 2 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) *
      power(sin(radians(lng2 - lng1) / 2), 2)
    ))
  )::numeric, 1);
$fn$;


-- ── 3 · Kitchens near a customer ─────────────────────────────────────────────
-- Ordered by distance, and filtered by each kitchen's OWN radius rather than one
-- number we picked. A kitchen that will not come 5 km should not be offered to
-- somebody 5 km away just because the page asked for five.

create or replace function public.kitchens_near(
  p_lat numeric,
  p_lng numeric,
  p_max_km numeric default 5
)
returns table (
  public_code   text,
  business_name text,
  city          text,
  cuisine       text,
  distance_km   numeric,
  is_open       boolean,
  dishes        int,
  min_price     numeric,
  delivery_charge numeric,
  free_above    numeric
)
language sql
security definer
set search_path = public
as $fn$
  select s.public_code,
         s.business_name,
         s.city,
         s.cuisine,
         public.km_between(p_lat, p_lng, s.lat, s.lng) as distance_km,
         public.kitchen_is_open(coalesce(s.store_config, '{}'::jsonb)) as is_open,
         (select count(*)::int from public.catalog c
           where c.business_id::text = s.business_id::text
             and coalesce(c.in_stock, true)) as dishes,
         (select min(c.price) from public.catalog c
           where c.business_id::text = s.business_id::text
             and coalesce(c.in_stock, true)) as min_price,
         s.delivery_charge,
         s.free_above
  from public.business_settings s
  where s.listed
    and s.public_code is not null
    and s.lat is not null and s.lng is not null
    -- Inside the customer's search AND inside what this kitchen will travel.
    and public.km_between(p_lat, p_lng, s.lat, s.lng) <= least(
          coalesce(p_max_km, 5), coalesce(s.delivery_radius_km, 5))
    -- A kitchen with nothing on its menu is not an option, it is a dead end.
    and exists (select 1 from public.catalog c
                 where c.business_id::text = s.business_id::text
                   and coalesce(c.in_stock, true))
  order by
    -- Open kitchens first: a closed one is information, not a choice.
    public.kitchen_is_open(coalesce(s.store_config, '{}'::jsonb)) desc,
    public.km_between(p_lat, p_lng, s.lat, s.lng) asc
  limit 25;
$fn$;

revoke all on function public.kitchens_near(numeric, numeric, numeric) from public;
grant execute on function public.kitchens_near(numeric, numeric, numeric) to anon, authenticated;


-- ── 4 · When we have no coordinates for them ─────────────────────────────────
-- Somebody who refuses location permission, or a kitchen that never set one.
-- Matching on city is crude, but a crude list beats an empty page.

create or replace function public.kitchens_in_city(p_city text)
returns table (
  public_code   text,
  business_name text,
  city          text,
  cuisine       text,
  is_open       boolean,
  dishes        int,
  min_price     numeric,
  delivery_charge numeric,
  free_above    numeric
)
language sql
security definer
set search_path = public
as $fn$
  select s.public_code, s.business_name, s.city, s.cuisine,
         public.kitchen_is_open(coalesce(s.store_config, '{}'::jsonb)),
         (select count(*)::int from public.catalog c
           where c.business_id::text = s.business_id::text and coalesce(c.in_stock, true)),
         (select min(c.price) from public.catalog c
           where c.business_id::text = s.business_id::text and coalesce(c.in_stock, true)),
         s.delivery_charge, s.free_above
  from public.business_settings s
  where s.listed
    and s.public_code is not null
    and lower(btrim(coalesce(s.city, ''))) = lower(btrim(coalesce(p_city, '')))
    and exists (select 1 from public.catalog c
                 where c.business_id::text = s.business_id::text
                   and coalesce(c.in_stock, true))
  order by public.kitchen_is_open(coalesce(s.store_config, '{}'::jsonb)) desc,
           s.business_name
  limit 25;
$fn$;

revoke all on function public.kitchens_in_city(text) from public;
grant execute on function public.kitchens_in_city(text) to anon, authenticated;
