-- ═══════════════════════════════════════════════════════════════════════════════
-- SELLY — an area is as good as a location.  Run in the SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- RUN AFTER FIX_010, FIX_011 AND FIX_012.
--
-- WHAT WAS WRONG
--   Discovery had two modes and neither matched how people actually describe
--   where they live:
--
--     coordinates   exact, but demands a permission prompt that plenty of
--                   people decline, and that a kitchen owner standing in a
--                   basement kitchen may not be able to satisfy at all
--     city          "Pune" is a million people. Useless for delivery.
--
--   The unit in between is the one everybody uses on the phone: Baner, Kothrud,
--   Wakad, Viman Nagar. That is what a locality is, and it is what this adds.
--
-- THE RULE
--   A kitchen is shown to a customer when ANY of these is true:
--
--     · both ends have coordinates and the kitchen is within its own radius
--     · both name the same area          <- regardless of distance
--     · both name the same city, and we cannot measure a distance
--
--   The middle one is the point. A customer in Baner and a kitchen in Baner are
--   a match even at 6 km, because the kitchen said it serves Baner and knows its
--   own patch better than a radius does. Distance is evidence, not the verdict.
--
--   The third only applies when nobody has coordinates, because a city is far
--   too coarse to overrule a measured distance -- a kitchen 30 km across Pune
--   should not surface just because both said "Pune".
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── 1 · Where a kitchen says it is ───────────────────────────────────────────

alter table public.business_settings add column if not exists area text;
alter table public.customer_sessions  add column if not exists area text;

comment on column public.business_settings.area is
  'The locality, as a person would say it: Baner, Kothrud, Viman Nagar. The '
  'unit between a pin and a city, and the one customers actually use.';


-- ── 2 · Comparing two place names typed by two different people ──────────────
-- "baner", "Baner ", "BANER" and "Baner  Road" are not the same string and are
-- all the same place to a human. Case, padding and doubled spaces all go.
--
-- Deliberately no fuzzy matching. "Balewadi" and "Baner" are three edits apart
-- and are different places; a trigram match that thinks otherwise sends food to
-- the wrong side of a highway. Exact-after-tidying is the honest line.

create or replace function public.norm_place(p text)
returns text
language sql
immutable
as $fn$
  select nullif(lower(btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g'))), '');
$fn$;


-- ── 3 · One way in, whatever the customer was willing to give ────────────────
-- Supersedes kitchens_near and kitchens_in_city, which stay in place so that a
-- page deployed before this migration keeps working. Nothing new should call
-- them.
--
-- Every argument is optional. Give coordinates, an area, a city, or any
-- combination, and this uses whatever it has.

create or replace function public.kitchens_for(
  p_lat    numeric default null,
  p_lng    numeric default null,
  p_area   text    default null,
  p_city   text    default null,
  p_max_km numeric default 5
)
returns table (
  public_code     text,
  business_name   text,
  area            text,
  city            text,
  cuisine         text,
  distance_km     numeric,
  is_open         boolean,
  dishes          int,
  min_price       numeric,
  delivery_charge numeric,
  free_above      numeric,
  match_reason    text
)
language sql
security definer
set search_path = public
as $fn$
  with me as (
    select p_lat as lat, p_lng as lng,
           public.norm_place(p_area) as area,
           public.norm_place(p_city) as city
  ),
  candidate as (
    select s.public_code,
           s.business_name,
           s.area,
           s.city,
           s.cuisine,
           s.delivery_charge,
           s.free_above,
           public.kitchen_is_open(coalesce(s.store_config, '{}'::jsonb)) as is_open,

           -- Can this pair even be measured? Needs coordinates at BOTH ends.
           (me.lat is not null and me.lng is not null
            and s.lat is not null and s.lng is not null) as measurable,

           case when me.lat is not null and me.lng is not null
                     and s.lat is not null and s.lng is not null
                then public.km_between(me.lat, me.lng, s.lat, s.lng)
           end as distance_km,

           (me.area is not null and public.norm_place(s.area) = me.area) as same_area,
           (me.city is not null and public.norm_place(s.city) = me.city) as same_city,

           least(coalesce(p_max_km, 5), coalesce(s.delivery_radius_km, 5)) as reach_km,

           (select count(*)::int from public.catalog c
             where c.business_id::text = s.business_id::text
               and coalesce(c.in_stock, true)) as dishes,
           (select min(c.price) from public.catalog c
             where c.business_id::text = s.business_id::text
               and coalesce(c.in_stock, true)) as min_price
      from public.business_settings s
      cross join me
     where s.listed
       and s.public_code is not null
       -- A kitchen with nothing on its menu is a dead end, not an option.
       and exists (select 1 from public.catalog c
                    where c.business_id::text = s.business_id::text
                      and coalesce(c.in_stock, true))
  )
  select public_code, business_name, area, city, cuisine,
         distance_km, is_open, dishes, min_price, delivery_charge, free_above,
         case when measurable and distance_km <= reach_km then 'distance'
              when same_area                              then 'area'
              else                                             'city'
         end as match_reason
    from candidate
   where (measurable and distance_km <= reach_km)
      or same_area
      or (same_city and not measurable)
   order by
     -- A closed kitchen is information, not a choice.
     is_open desc,
     -- Measured first, nearest of those first. An area match with no distance
     -- sorts after them rather than pretending to a precision it does not have.
     (distance_km is null),
     distance_km asc,
     business_name
   limit 25;
$fn$;

revoke all on function public.kitchens_for(numeric, numeric, text, text, numeric) from public;
grant execute on function public.kitchens_for(numeric, numeric, text, text, numeric) to anon, authenticated;


-- ── 4 · The session remembers an area too ────────────────────────────────────
-- Both of these change shape, and Postgres will not replace a function whose
-- return type or argument list has moved. Dropping first is the whole reason
-- this section is longer than it looks like it should be.

drop function if exists public.session_context(text);

create function public.session_context(p_token text)
returns table (
  mobile text, name text, address text, area text, city text,
  lat numeric, lng numeric, has_location boolean
)
language sql
security definer
set search_path = public
as $fn$
  update public.customer_sessions
     set last_seen = now()
   where token = lower(btrim(p_token))
     and expires_at > now()
  returning mobile, name, address, area, city, lat, lng,
            -- "We know enough to find them kitchens." Coordinates, an area or
            -- an address all qualify; any one of them produces a usable list.
            (lat is not null
             or public.norm_place(area) is not null
             or public.norm_place(address) is not null);
$fn$;

revoke all on function public.session_context(text) from public;
grant execute on function public.session_context(text) to anon, authenticated;


drop function if exists public.save_session_details(text, text, text, text, numeric, numeric);

create function public.save_session_details(
  p_token   text,
  p_name    text default null,
  p_address text default null,
  p_area    text default null,
  p_city    text default null,
  p_lat     numeric default null,
  p_lng     numeric default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_hit int;
begin
  update public.customer_sessions
     set name    = coalesce(nullif(btrim(coalesce(p_name, '')), ''), name),
         address = coalesce(nullif(btrim(coalesce(p_address, '')), ''), address),
         area    = coalesce(nullif(btrim(coalesce(p_area, '')), ''), area),
         city    = coalesce(nullif(btrim(coalesce(p_city, '')), ''), city),
         -- Coordinates only overwrite when new ones are given. Somebody editing
         -- their name should not silently lose the location they set last month.
         lat     = coalesce(p_lat, lat),
         lng     = coalesce(p_lng, lng),
         last_seen = now()
   where token = lower(btrim(p_token))
     and expires_at > now();

  get diagnostics v_hit = row_count;
  return v_hit > 0;
end;
$fn$;

revoke all on function public.save_session_details(text, text, text, text, text, numeric, numeric) from public;
grant execute on function public.save_session_details(text, text, text, text, text, numeric, numeric) to anon, authenticated;


-- ── 5 · Texting in knows about areas as well ─────────────────────────────────
-- Same columns out, so a plain replace is enough here.

create or replace function public.start_sms_session(p_mobile text)
returns table (token text, is_returning boolean, name text, has_location boolean)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_mobile text := right(regexp_replace(coalesce(p_mobile, ''), '\D', '', 'g'), 10);
  v_row    public.customer_sessions%rowtype;
begin
  if length(v_mobile) <> 10 then
    raise exception 'a 10-digit mobile number is required';
  end if;

  select * into v_row from public.customer_sessions where mobile = v_mobile limit 1;

  if found then
    update public.customer_sessions
       set last_seen  = now(),
           expires_at = now() + interval '90 days'
     where id = v_row.id;
    return query select v_row.token, true, v_row.name,
                        (v_row.lat is not null
                         or public.norm_place(v_row.area) is not null
                         or public.norm_place(v_row.address) is not null);
    return;
  end if;

  insert into public.customer_sessions (token, mobile)
  values (public.new_session_token(), v_mobile)
  returning * into v_row;

  return query select v_row.token, false, null::text, false;
end;
$fn$;

revoke all on function public.start_sms_session(text) from public, anon;
grant execute on function public.start_sms_session(text) to service_role;




-- ── 6 · A kitchen names its area on its own ordering page ────────────────────
-- Same shape FIX_010 established, plus area and cuisine, so a customer can tell
-- one Selly kitchen from another before committing to a menu. Everything the
-- ordering page already reads -- business_id, schedule_config, upi_id -- stays
-- exactly where it was; only the two new columns are appended.
--
-- Note the lookup is lower(): public codes are stored lowercase, and matching
-- on upper() here would quietly find nothing at all.

drop function if exists public.get_public_kitchen(text);

create function public.get_public_kitchen(p_code text)
returns table (
  business_id     text,
  business_name   text,
  area            text,
  city            text,
  cuisine         text,
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
  select s.business_id::text, s.business_name, s.area, s.city, s.cuisine,
         s.delivery_charge, s.free_above, s.store_config, s.schedule_config,
         s.upi_id,
         public.kitchen_is_open(coalesce(s.store_config, '{}'::jsonb))
  from public.business_settings s
  where s.public_code = lower(btrim(p_code))
  limit 1;
$fn$;

revoke all on function public.get_public_kitchen(text) from public;
grant execute on function public.get_public_kitchen(text) to anon, authenticated;
