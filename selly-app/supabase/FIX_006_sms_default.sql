-- ═══════════════════════════════════════════════════════════════════════════════
-- SELLY — SMS is the default channel, not WhatsApp.  Run in the SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- The product no longer depends on WhatsApp. SMS reaches every phone, needs no
-- app installed, and no platform can switch it off. WhatsApp stays available as
-- a per-customer override -- some customers genuinely prefer it and supporting
-- it costs one column value -- but nothing defaults to it any more.
--
-- Two changes, and the second is the one that matters: flipping the default only
-- affects customers added from here on. Everyone already on file was created
-- with 'whatsapp' and would keep it forever, so the kitchen would go on being
-- told to message their existing customers on an app they have stopped using.
--
-- Only rows still sitting on the old default are moved. A customer deliberately
-- set to WhatsApp keeps it -- there is no way to tell those apart afterwards, so
-- this is the one moment it can be done safely, before anyone has chosen.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════

alter table public.customer_contacts
  alter column preferred_channel set default 'sms';

update public.customer_contacts
   set preferred_channel = 'sms'
 where preferred_channel = 'whatsapp';

comment on column public.customer_contacts.preferred_channel is
  'Which app to open when messaging this customer: sms (default) or whatsapp. '
  'A per-customer override, not a platform the product depends on.';
