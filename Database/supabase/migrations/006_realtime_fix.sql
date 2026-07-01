-- ============================================================
-- 006_realtime_fix.sql — Fix realtime balance sync for ALL clients
-- ============================================================
-- Symptom: a participant's remaining balance updated live only on some
-- screens (e.g. the admin's) after a player was won, not for every
-- connected client.
--
-- Root cause: the realtime tables used the default REPLICA IDENTITY
-- (primary key only). For RLS-enabled tables, Supabase Realtime needs the
-- full row to evaluate row visibility and emit the previous values on
-- UPDATE/DELETE — otherwise UPDATE events (such as the budget deduction on
-- room_participants) are not reliably delivered to every subscriber.
--
-- Fix: set REPLICA IDENTITY FULL on every realtime table and make sure all
-- of them — room_participants in particular — are members of the
-- supabase_realtime publication.
--
-- Safe to run multiple times (idempotent).
-- ============================================================

-- 1. Full row images in the WAL so Realtime can authorize + emit UPDATE/DELETE
ALTER TABLE rooms              REPLICA IDENTITY FULL;
ALTER TABLE room_participants  REPLICA IDENTITY FULL;
ALTER TABLE room_players       REPLICA IDENTITY FULL;
ALTER TABLE bids               REPLICA IDENTITY FULL;

-- room_chats may not exist on older setups — guard it.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'room_chats') THEN
    EXECUTE 'ALTER TABLE room_chats REPLICA IDENTITY FULL';
  END IF;
END $$;

-- 2. Ensure every table is in the realtime publication (ADD TABLE errors if
--    the table is already a member, so only add what's missing).
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['rooms', 'room_participants', 'room_players', 'bids', 'room_chats'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t)
       AND NOT EXISTS (
         SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
       )
    THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- 3. Re-assert permissive anon SELECT so realtime authorization can see rows.
--    (No-op if the policies already exist.)
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('rooms',             'Rooms readable by all'),
      ('room_participants', 'Participants readable by all'),
      ('room_players',      'Room players readable by all'),
      ('bids',              'Bids readable by all'),
      ('players',           'Players readable by all')
    ) AS v(tbl, polname)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = rec.tbl AND policyname = rec.polname
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO anon USING (true)',
        rec.polname, rec.tbl
      );
    END IF;
  END LOOP;
END $$;
