-- ============================================================
-- 009_fix_rls.sql — PASTE THIS IN SUPABASE SQL EDITOR
-- ============================================================
-- Fixes infinite recursion in room_participants RLS policy by
-- using a SECURITY DEFINER helper function for membership checks.
-- Safe to run multiple times (idempotent).
-- ============================================================

-- -----------------------------------------------
-- 0. Helper: check room membership (bypasses RLS)
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION is_room_member(p_room_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM room_participants
    WHERE room_id = p_room_id
    AND user_id = auth.uid()
  );
$$;

-- -----------------------------------------------
-- 1. ROOMS — any authenticated user can read any room
-- -----------------------------------------------
DROP POLICY IF EXISTS "Rooms are viewable by authenticated users" ON rooms;
CREATE POLICY "Rooms are viewable by authenticated users"
  ON rooms FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Public rooms are viewable by anyone" ON rooms;
CREATE POLICY "Public rooms are viewable by anyone"
  ON rooms FOR SELECT
  TO anon
  USING (is_public = true AND status = 'LOBBY');

-- -----------------------------------------------
-- 2. ROOM_PARTICIPANTS — uses helper function (no recursion)
-- -----------------------------------------------
DROP POLICY IF EXISTS "Participants are viewable by room members" ON room_participants;
CREATE POLICY "Participants are viewable by room members"
  ON room_participants FOR SELECT
  TO authenticated
  USING ( is_room_member(room_id) );

-- -----------------------------------------------
-- 3. ROOM_PLAYERS — uses helper function
-- -----------------------------------------------
DROP POLICY IF EXISTS "Room players are viewable by room members" ON room_players;
CREATE POLICY "Room players are viewable by room members"
  ON room_players FOR SELECT
  TO authenticated
  USING ( is_room_member(room_id) );

-- -----------------------------------------------
-- 4. BIDS — uses helper function
-- -----------------------------------------------
DROP POLICY IF EXISTS "Bids are viewable by room members" ON bids;
CREATE POLICY "Bids are viewable by room members"
  ON bids FOR SELECT
  TO authenticated
  USING ( is_room_member(room_id) );

-- -----------------------------------------------
-- 5. PLAYERS — everyone can read
-- -----------------------------------------------
DROP POLICY IF EXISTS "Players are viewable by everyone" ON players;
CREATE POLICY "Players are viewable by everyone"
  ON players FOR SELECT
  USING (true);

-- -----------------------------------------------
-- 6. PROFILES
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- -----------------------------------------------
-- 7. Auto-insert profile on signup
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- -----------------------------------------------
-- 8. ROOM_CHATS (if table exists)
-- -----------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_chats') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Chats are viewable by room members" ON room_chats';
    EXECUTE 'CREATE POLICY "Chats are viewable by room members"
      ON room_chats FOR SELECT
      TO authenticated
      USING ( is_room_member(room_id) )';
  END IF;
END;
$$;

-- ============================================================
-- DONE!
-- Remember: Supabase Dashboard → Authentication → Settings
-- → Email → Toggle OFF "Enable email confirmations"
-- ============================================================
