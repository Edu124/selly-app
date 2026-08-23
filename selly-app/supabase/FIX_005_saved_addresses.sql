-- ═══════════════════════════════════════════════════════════════════════════════
-- SELLY — saved addresses.  One column. Run in the SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Repeat customers give the same address every time, and a kitchen taking the
-- order on the phone types it out again every time. This is where the ones they
-- have already given are kept, labelled, so the next order is a tap.
--
-- WHY A JSONB COLUMN AND NOT A TABLE
--   A customer has two or three addresses, always read together and always in
--   the context of the customer they belong to. A table would mean another set
--   of RLS policies, another index, another join, and another migration to get
--   wrong -- for a list that is never queried on its own.
--
--   If addresses ever need searching across customers ("everyone in Baner"),
--   that is the point to split them out. Not before.
--
-- Shape: [{ "label": "Home", "address": "Flat 302, ...", "usedAt": "..." }]
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════

alter table public.customer_contacts
  add column if not exists addresses jsonb not null default '[]'::jsonb;

comment on column public.customer_contacts.addresses is
  'Addresses this customer has ordered to, newest use first. Labelled Home / '
  'Work / Office / Other so the kitchen can pick one instead of retyping it.';
