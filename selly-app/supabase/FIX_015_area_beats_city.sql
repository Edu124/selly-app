-- ═══════════════════════════════════════════════════════════════════════════════
-- SELLY — the city must not widen an answer the area already gave.
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- RUN AFTER FIX_013.
--
-- WHAT WAS WRONG
--   kitchens_for included a kitchen when the customer's city matched and no
--   distance could be measured. That is the right fallback for somebody who
--   only told us "Pune" — and it was invisible while one kitchen existed.
--
--   With thirty kitchens across six localities it broke immediately. A customer
--   in Baner who typed both "Baner" and "Pune", and did not share a pin, was
--   offered every kitchen in the city: Hadapsar, Kharadi, Wakad, all labelled
--   as though they served Baner. Twenty kilometres of Pune presented as local.
--
-- THE RULE NOW
--   The city is a fallback, not an addition. If the customer named their area,
--   that is the answer; the city does not widen it. The city only decides
--   anything when there is no area to go on.
--
--     · both ends have coordinates, kitchen within its own radius   → match
--     · both name the same area                                      → match
--     · same city, nothing measurable, AND no area was given         → match
--
--   The last clause is the whole change: "and no area was given".
--
--   A customer who names an area and gets a short list is better served than
--   one who names an area and gets the entire city, because the second list
--   cannot be trusted and so cannot be read.
-- ═══════════════════════════════════════════════════════════════════════════════

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

           (me.lat is not null and me.lng is not null
            and s.lat is not null and s.lng is not null) as measurable,

           case when me.lat is not null and me.lng is not null
                     and s.lat is not null and s.lng is not null
                then public.km_between(me.lat, me.lng, s.lat, s.lng)
           end as distance_km,

           (me.area is not null and public.norm_place(s.area) = me.area) as same_area,
           (me.city is not null and public.norm_place(s.city) = me.city) as same_city,

           -- Did the customer tell us a locality at all? If they did, the city
           -- is not allowed to broaden the result.
           (me.area is not null) as gave_area,

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
      or (same_city and not measurable and not gave_area)
   order by
     is_open desc,
     (distance_km is null),
     distance_km asc,
     business_name
   limit 25;
$fn$;

revoke all on function public.kitchens_for(numeric, numeric, text, text, numeric) from public;
grant execute on function public.kitchens_for(numeric, numeric, text, text, numeric) to anon, authenticated;
