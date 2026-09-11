-- ═══════════════════════════════════════════════════════════════════════════════
-- SELLY — within 5 km of where the customer is. Nothing else.
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- RUN AFTER FIX_015.
--
-- THE DECISION THIS ENCODES
--   FIX_013 said a customer and a kitchen naming the same area were a match
--   "regardless of distance" — trusting the kitchen to know its own patch. The
--   product owner's rule is simpler and better: suggest kitchens within 5 km of
--   the customer's address. So wherever a distance can be measured, it is now
--   the only thing that decides.
--
--   The ordering page turns a typed address into coordinates before calling
--   this, so "can be measured" is now the normal case rather than the one where
--   somebody happened to share a GPS pin.
--
-- THE RULE
--   customer located, kitchen located      → distance ≤ the kitchen's reach
--   customer located, kitchen not located  → same area   (nothing to measure)
--   customer not located                  → same area, or same city if no area
--
--   Area names only decide anything when there is no distance to be had. A name
--   is evidence about where something is; a measurement is the answer.
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
           (p_lat is not null and p_lng is not null) as located,
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

           me.located,
           (s.lat is not null and s.lng is not null) as k_located,

           case when me.located and s.lat is not null and s.lng is not null
                then public.km_between(me.lat, me.lng, s.lat, s.lng)
           end as distance_km,

           (me.area is not null and public.norm_place(s.area) = me.area) as same_area,
           (me.city is not null and public.norm_place(s.city) = me.city) as same_city,
           (me.area is not null) as gave_area,

           -- The smaller of what the customer asked for and what the kitchen
           -- will actually travel. A kitchen that only does 3 km is not offered
           -- to somebody 4 km away just because the search said five.
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
         case when distance_km is not null then 'distance'
              when same_area               then 'area'
              else                              'city'
         end as match_reason
    from candidate
   where
         -- Both ends placed: the distance is the answer, and only the distance.
         (located and k_located and distance_km <= reach_km)
         -- Customer placed, kitchen never set a location: its area is all we have.
      or (located and not k_located and same_area)
         -- Customer not placed at all.
      or (not located and same_area)
      or (not located and same_city and not gave_area)
   order by
     is_open desc,
     (distance_km is null),
     distance_km asc,
     business_name
   limit 25;
$fn$;

revoke all on function public.kitchens_for(numeric, numeric, text, text, numeric) from public;
grant execute on function public.kitchens_for(numeric, numeric, text, text, numeric) to anon, authenticated;
