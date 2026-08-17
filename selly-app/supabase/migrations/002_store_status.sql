-- ═══════════════════════════════════════════════════════════════════════════════
-- Selly — Migration 002: store status
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- HOW TO RUN
--   Supabase dashboard → SQL Editor → New query → paste → Run.
--   Safe to re-run, and independent of 001 — run them in either order.
--
-- WHY
--   A cloud kitchen with no storefront cannot rely on a customer seeing a closed
--   shutter. If the kitchen is shut and the ordering page still takes orders,
--   food gets promised that nobody is there to cook. This holds the open/closed
--   state and the trading hours that decide it.
--
-- DELIBERATELY NOT HERE
--   delivery_charge, free_above, cod_fee, upi_id and city already exist as real
--   columns on business_settings and are already edited by the Settings screen.
--   Duplicating them into a jsonb blob would give every delivery fee two homes
--   and no answer for which one wins.
-- ═══════════════════════════════════════════════════════════════════════════════

alter table public.business_settings
  add column if not exists store_config jsonb default '{}'::jsonb;

comment on column public.business_settings.store_config is
  'Store-wide trading state. Keys: acceptingOrders (bool, the manual kill switch), '
  'closedMessage (text shown to customers when shut), hours (array of 7 '
  '{open,close} strings indexed 0=Sunday, null entries mean closed that day), '
  'deliveryRadiusKm (number), defaultPrepMinutes (number, used for the "ready in '
  'about N minutes" promise and the kitchen''s overdue timer). '
  'Delivery fees live in the existing delivery_charge / free_above columns.';


-- ─────────────────────────────────────────────────────────────────────────────
-- Public read of trading state, for the ordering page
-- ─────────────────────────────────────────────────────────────────────────────
-- The guest ordering page has no login, so it cannot read business_settings —
-- RLS restricts that to the owner. This returns only what a customer needs to
-- see before ordering, and nothing else from the row: no tokens, no GST number,
-- no bank details.

create or replace function public.store_public_status(p_slug text)
returns table (
  business_name    text,
  accepting_orders boolean,
  closed_message   text,
  delivery_charge  numeric,
  free_above       numeric,
  upi_id           text,
  prep_minutes     int
)
language sql
security definer
set search_path = public
as $$
  select
    s.business_name,
    coalesce((s.store_config->>'acceptingOrders')::boolean, true),
    nullif(s.store_config->>'closedMessage', ''),
    coalesce(s.delivery_charge, 0)::numeric,
    coalesce(s.free_above, 0)::numeric,
    nullif(s.upi_id, ''),
    coalesce((s.store_config->>'defaultPrepMinutes')::int, 30)
  from public.business_settings s
  where s.business_slug = p_slug
  limit 1;
$$;

revoke all on function public.store_public_status(text) from public;
grant execute on function public.store_public_status(text) to anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════════
-- Verify with:
--   select column_name from information_schema.columns
--   where table_name = 'business_settings' and column_name = 'store_config';
--   -- expect 1 row
-- ═══════════════════════════════════════════════════════════════════════════════
