-- ============================================================
-- 008_auth_profiles.sql — Run in Supabase SQL Editor
-- ============================================================
-- Creates profiles table, auto-insert trigger, and updates
-- RLS policies for authenticated Supabase Auth.
-- ============================================================

-- -----------------------------------------------
-- 1. Profiles table
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------
-- 2. Auto-insert profile on new auth.users signup
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

-- Drop existing trigger if re-running
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- -----------------------------------------------
-- 3. RLS for profiles
-- -----------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- -----------------------------------------------
-- 4. Allow anon users to view public LOBBY rooms
--    (read-only discovery for the homepage before
--    the user signs in).
-- -----------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'rooms'
    AND policyname = 'Public rooms are viewable by anyone'
  ) THEN
    EXECUTE 'CREATE POLICY "Public rooms are viewable by anyone"
      ON rooms FOR SELECT
      TO anon
      USING (is_public = true AND status = ''LOBBY'')';
  END IF;
END;
$$;

-- ============================================================
-- DONE! Remember to disable email confirmations:
-- Supabase Dashboard → Authentication → Settings → Email
-- → Toggle OFF "Enable email confirmations"
-- ============================================================
