-- ═══════════════════════════════════════════════════════════════════════════════
-- Selly — food-only, two-sided product
-- Migration 001: café tables + QR, Fun Zone coupons, bakery occasions, discovery
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- HOW TO RUN
--   Supabase dashboard → SQL Editor → New query → paste this whole file → Run.
--   Safe to re-run: every statement is idempotent (IF NOT EXISTS / DROP+CREATE).
--
-- CONVENTIONS THIS FILE FOLLOWS (matching the existing schema)
--   • business_id  uuid   — always equals the Supabase auth uid of the merchant.
--                           RLS on every merchant table is business_id = auth.uid().
--   • id on rows the app creates is text where the existing code generates
--     Date.now().toString() (catalog, orders). New tables use real uuids.
--   • customer_id / order_id are text and deliberately have NO foreign key:
--     the WhatsApp bot writes those rows and we must not be able to block it.
--
-- WHAT IS *NOT* HERE
--   No changes to existing columns. Everything below is additive, so the Railway
--   bot keeps working untouched — it simply ignores the new columns.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. EXTEND EXISTING TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- orders — table identity, order kind, channel, and a jsonb bag for cake specs.
-- The app never changes the meaning of an existing column, so the bot's
-- pending_payment / confirmed writes stay correct.
alter table public.orders add column if not exists table_no   int;
alter table public.orders add column if not exists order_kind text  default 'standard';  -- standard | cake
alter table public.orders add column if not exists channel    text  default 'whatsapp';  -- whatsapp | instagram | qr | walkin
alter table public.orders add column if not exists extra      jsonb default '{}'::jsonb;

comment on column public.orders.table_no   is 'Café table number the order came from (from the QR / prefilled wa.me text). Null for delivery and cake orders.';
comment on column public.orders.order_kind is 'standard = café/cloud-kitchen food order. cake = bakery custom order, specs live in extra.';
comment on column public.orders.extra      is 'Cake orders: {flavour, kg, eggless, cakeMsg, due, advancePaid, deliveryOpted, photoUrl}';

create index if not exists orders_business_table_idx on public.orders (business_id, table_no);
create index if not exists orders_business_kind_idx  on public.orders (business_id, order_kind);


-- business_settings — one-per-business config blobs. This table is already the
-- generic KV store (it holds `industry`), so config belongs here, not in new tables.
alter table public.business_settings add column if not exists cafe_config jsonb default '{}'::jsonb;
alter table public.business_settings add column if not exists cake_config jsonb default '{}'::jsonb;
alter table public.business_settings add column if not exists fun_zone    jsonb default '{}'::jsonb;

comment on column public.business_settings.cafe_config is '{tableCount, upiVpa, prepMinutes, menuSlug, waNumber}';
comment on column public.business_settings.cake_config is '{flavours:{name:ratePerKg}, weights:[], slots:[], egglessSurcharge, advance, deliveryFee, repeatDiscountPct}';
comment on column public.business_settings.fun_zone    is '{enabled, games:{}, prizes:[{emoji,label,kind,value,weight,win}], quiz:[{q,opts,right}], tracks:[{name,artist}], talkCards:[], memoryEmojis:[]}';


-- bot_customers — denormalised occasion so the customer list can show a birthday
-- badge without joining `occasions`. `occasions` remains the source of truth.
alter table public.bot_customers add column if not exists occasion_month int;
alter table public.bot_customers add column if not exists occasion_day   int;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CAFÉ — TABLES
-- ─────────────────────────────────────────────────────────────────────────────
-- One row per physical table. Each has its own QR (built client-side from
-- table_no + business_settings.cafe_config, nothing stored here).

create table if not exists public.cafe_tables (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  table_no    int  not null,
  label       text,                                  -- "Terrace 2", optional
  seats       int  default 4,
  state       text not null default 'free',           -- free | seated | ordered | served | bill
  state_at    timestamptz default now(),
  created_at  timestamptz default now(),
  unique (business_id, table_no)
);

alter table public.cafe_tables enable row level security;

drop policy if exists "cafe_tables owner all" on public.cafe_tables;
create policy "cafe_tables owner all" on public.cafe_tables
  for all to authenticated
  using (business_id = auth.uid())
  with check (business_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. FUN ZONE — COUPONS
-- ─────────────────────────────────────────────────────────────────────────────
-- Issued by the guest Fun Zone page (server-side) or manually from the app.
-- `kind` + `value` are what make the bill discount real — the demo cheated with
-- a flat ₹50 for every prize regardless of what was won.

create table if not exists public.coupons (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  code        text not null,
  prize_label text,
  kind        text not null default 'flat',           -- flat | percent | freeitem | upgrade
  value       numeric default 0,                      -- ₹ for flat, % for percent, 0 otherwise
  customer_id text,                                   -- bot_customers.id, no FK on purpose
  table_no    int,
  issued_via  text,                                   -- wheel | memory | quiz | manual
  status      text not null default 'issued',         -- issued | redeemed | expired
  expires_at  timestamptz,
  redeemed_at timestamptz,
  order_id    text,                                   -- the bill it was burned on
  created_at  timestamptz default now(),
  unique (business_id, code)
);

alter table public.coupons enable row level security;

drop policy if exists "coupons owner all" on public.coupons;
create policy "coupons owner all" on public.coupons
  for all to authenticated
  using (business_id = auth.uid())
  with check (business_id = auth.uid());

create index if not exists coupons_business_status_idx on public.coupons (business_id, status);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. FUN ZONE — JUKEBOX QUEUE
-- ─────────────────────────────────────────────────────────────────────────────
-- Guests pick a track from the Fun Zone page; the counter screen plays it next.

create table if not exists public.jukebox_queue (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  track       text not null,
  artist      text,
  table_no    int,
  status      text default 'queued',                  -- queued | played | skipped
  created_at  timestamptz default now()
);

alter table public.jukebox_queue enable row level security;

drop policy if exists "jukebox owner all" on public.jukebox_queue;
create policy "jukebox owner all" on public.jukebox_queue
  for all to authenticated
  using (business_id = auth.uid())
  with check (business_id = auth.uid());

create index if not exists jukebox_business_status_idx on public.jukebox_queue (business_id, status, created_at);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. BAKERY — OCCASIONS (birthday / anniversary reminders)
-- ─────────────────────────────────────────────────────────────────────────────
-- month + day, not a date: a birthday recurs and we never learn the year.
-- last_cake is what makes "same as last year, 10% off" possible without
-- reconstructing it from order history.

create table if not exists public.occasions (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null,
  customer_id      text,
  person_name      text,                              -- "Aarav" — whose birthday, not the buyer
  occasion         text not null default 'birthday',   -- birthday | anniversary
  month            int  not null check (month between 1 and 12),
  day              int  not null check (day   between 1 and 31),
  source_order_id  text,
  last_cake        jsonb default '{}'::jsonb,          -- {flavour, kg, eggless, cakeMsg}
  last_reminded_on date,                               -- guard so a cron can't double-send
  opted_out        boolean default false,
  created_at       timestamptz default now()
);

alter table public.occasions enable row level security;

drop policy if exists "occasions owner all" on public.occasions;
create policy "occasions owner all" on public.occasions
  for all to authenticated
  using (business_id = auth.uid())
  with check (business_id = auth.uid());

create index if not exists occasions_business_date_idx on public.occasions (business_id, month, day);


-- ═══════════════════════════════════════════════════════════════════════════════
-- CONSUMER / DISCOVERY SIDE
-- Different RLS shape from everything above: the place directory is readable by
-- every signed-in user, a consumer's queries are private to them, and merchants
-- can only see demand through an aggregate that never exposes user ids.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. DISCOVERY — PLACES
-- ─────────────────────────────────────────────────────────────────────────────
-- The curated directory. `signature` / `why` / `dishes` are the dish-level
-- editorial that makes the recommendation worth reading — hand-written, and the
-- actual moat. business_id is set only when the place is also a Selly merchant.

create table if not exists public.discovery_places (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid,
  name        text not null,
  emoji       text,
  cuisine     text,
  area        text not null,
  city        text default 'Pune',
  lat         double precision,
  lng         double precision,
  rating      numeric,
  reviews     int,
  phone       text,
  maps_url    text,
  dishes      text[] default '{}',                    -- canonical dish keys, see src/lib/discovery.js
  signature   text,                                   -- "Ghee Roast Dosa"
  price       text,                                   -- "₹120"
  why         text,                                   -- "crisp, not oily — reviewers keep coming back"
  delivery    boolean default false,
  active      boolean default true,
  shown_count int     default 0,
  created_at  timestamptz default now()
);

alter table public.discovery_places enable row level security;

-- Any signed-in user can read active listings (that is the whole point).
drop policy if exists "places readable"      on public.discovery_places;
create policy "places readable" on public.discovery_places
  for select to authenticated using (active);

-- A merchant may edit only their own claimed listing.
drop policy if exists "places owner update"  on public.discovery_places;
create policy "places owner update" on public.discovery_places
  for update to authenticated
  using (business_id = auth.uid())
  with check (business_id = auth.uid());

drop policy if exists "places owner insert"  on public.discovery_places;
create policy "places owner insert" on public.discovery_places
  for insert to authenticated with check (business_id = auth.uid());

create index if not exists places_area_idx     on public.discovery_places (city, area) where active;
create index if not exists places_dishes_idx   on public.discovery_places using gin (dishes);
create index if not exists places_business_idx on public.discovery_places (business_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. DISCOVERY — QUERIES (the demand log)
-- ─────────────────────────────────────────────────────────────────────────────
-- Every consumer question, append-only. This is the asset: "47 people asked for
-- biryani near you this month" is the number you walk in with when signing
-- restaurants. Kept private per user; merchants read it only via discovery_demand().

create table if not exists public.discovery_queries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid,                                    -- null for wa.me traffic with no account
  area       text,
  city       text default 'Pune',
  dish       text,                                    -- canonical key, null = "surprise me"
  raw_text   text,
  lang       text default 'en',                       -- en | hi
  source     text,                                    -- influencer handle | qr | app
  results    uuid[] default '{}',                     -- discovery_places ids shown
  covered    boolean default true,                    -- false = we had to refuse
  created_at timestamptz default now()
);

alter table public.discovery_queries enable row level security;

drop policy if exists "queries own insert" on public.discovery_queries;
create policy "queries own insert" on public.discovery_queries
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "queries own select" on public.discovery_queries;
create policy "queries own select" on public.discovery_queries
  for select to authenticated using (user_id = auth.uid());

create index if not exists queries_area_dish_idx on public.discovery_queries (area, dish, created_at desc);


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. DISCOVERY — WAITLIST (out-of-area demand)
-- ─────────────────────────────────────────────────────────────────────────────
-- When we can't cover an area we say so honestly and record the ask. That turns
-- a dead end into the expansion signal.

create table if not exists public.discovery_waitlist (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid,
  area       text not null,
  city       text default 'Pune',
  notified   boolean default false,
  created_at timestamptz default now(),
  unique (user_id, area)
);

alter table public.discovery_waitlist enable row level security;

drop policy if exists "waitlist own insert" on public.discovery_waitlist;
create policy "waitlist own insert" on public.discovery_waitlist
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "waitlist own select" on public.discovery_waitlist;
create policy "waitlist own select" on public.discovery_waitlist
  for select to authenticated using (user_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. CONSUMER — SAVED PLACES
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.consumer_saves (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  place_id   uuid not null references public.discovery_places (id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, place_id)
);

alter table public.consumer_saves enable row level security;

drop policy if exists "saves own all" on public.consumer_saves;
create policy "saves own all" on public.consumer_saves
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. SECURITY DEFINER FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────
-- Two deliberate holes in RLS, both narrow:
--   • discovery_demand  — merchants need aggregate demand for their area, but
--                         must never see who asked. Returns counts only.
--   • bump_place_shown  — consumers must not be able to write discovery_places,
--                         but every recommendation has to increment shown_count.

create or replace function public.discovery_demand(p_area text, p_days int default 30)
returns table (dish text, n bigint)
language sql
security definer
set search_path = public
as $$
  select q.dish, count(*) as n
  from public.discovery_queries q
  where q.area = p_area
    and q.dish is not null
    and q.created_at > now() - (p_days || ' days')::interval
  group by q.dish
  order by n desc;
$$;

revoke all on function public.discovery_demand(text, int) from public;
grant execute on function public.discovery_demand(text, int) to authenticated;


create or replace function public.bump_place_shown(p_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.discovery_places
  set shown_count = shown_count + 1
  where id = any(p_ids);
$$;

revoke all on function public.bump_place_shown(uuid[]) from public;
grant execute on function public.bump_place_shown(uuid[]) to authenticated;


-- Out-of-area demand, aggregated, for the merchant expansion panel.
create or replace function public.discovery_waitlist_demand(p_city text default 'Pune')
returns table (area text, n bigint)
language sql
security definer
set search_path = public
as $$
  select w.area, count(*) as n
  from public.discovery_waitlist w
  where w.city = p_city
  group by w.area
  order by n desc;
$$;

revoke all on function public.discovery_waitlist_demand(text) from public;
grant execute on function public.discovery_waitlist_demand(text) to authenticated;


-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE.
--
-- Verify with:
--   select table_name from information_schema.tables
--   where table_schema = 'public'
--     and table_name in ('cafe_tables','coupons','jukebox_queue','occasions',
--                        'discovery_places','discovery_queries',
--                        'discovery_waitlist','consumer_saves');
--   -- expect 8 rows
--
--   select column_name from information_schema.columns
--   where table_name = 'orders'
--     and column_name in ('table_no','order_kind','channel','extra');
--   -- expect 4 rows
-- ═══════════════════════════════════════════════════════════════════════════════
