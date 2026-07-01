-- ============================================================
-- 004_cron.sql – Scheduled auction resolution via pg_cron
-- ============================================================

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule auction resolution every minute as safety net
-- Primary resolution is client-triggered via check_and_resolve RPC
SELECT cron.schedule(
  'resolve-expired-auctions',
  '* * * * *',
  'SELECT public.resolve_expired_auctions()'
);
