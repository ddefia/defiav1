-- ============================================================
-- RLS MIGRATION: app_storage multi-tenant isolation
-- Run this in Supabase SQL Editor to protect user data
-- ============================================================

-- 1. Enable Row Level Security on app_storage
ALTER TABLE app_storage ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if re-running
DROP POLICY IF EXISTS "users_own_data" ON app_storage;
DROP POLICY IF EXISTS "team_members_access" ON app_storage;
DROP POLICY IF EXISTS "anon_migration_access" ON app_storage;

-- 3. Policy: Users can read/write keys that start with their 8-char user prefix
--    Key format: "{userId.slice(0,8)}_{dataType}_{brandName}"
CREATE POLICY "users_own_data" ON app_storage
  FOR ALL
  USING (
    starts_with(key, substring(auth.uid()::text, 1, 8) || '_')
  )
  WITH CHECK (
    starts_with(key, substring(auth.uid()::text, 1, 8) || '_')
  );

-- 4. Policy: Team members can access the brand owner's keys
--    Only for active team memberships
CREATE POLICY "team_members_access" ON app_storage
  FOR SELECT  -- Read-only for team members via this policy
  USING (
    substring(key, 1, 8) IN (
      SELECT substring(owner_id::text, 1, 8)
      FROM team_members
      WHERE user_id = auth.uid()
        AND status = 'active'
    )
  );

-- 5. Policy: Team editors can write to owner's keys
CREATE POLICY "team_editors_write" ON app_storage
  FOR INSERT WITH CHECK (
    substring(key, 1, 8) IN (
      SELECT substring(owner_id::text, 1, 8)
      FROM team_members
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role = 'editor'
    )
  );

CREATE POLICY "team_editors_update" ON app_storage
  FOR UPDATE USING (
    substring(key, 1, 8) IN (
      SELECT substring(owner_id::text, 1, 8)
      FROM team_members
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role = 'editor'
    )
  );

-- 6. Policy: Allow anon_ prefixed keys during auth migration window
--    (users migrating from logged-out to logged-in state)
CREATE POLICY "anon_migration_read" ON app_storage
  FOR SELECT
  USING (starts_with(key, 'anon_'));

-- NOTE: Service role key (used by server.js cron jobs) bypasses RLS automatically.
-- Only the Supabase anon key (client-side) is subject to these policies.

-- ============================================================
-- ALSO: Add user_id index for team membership lookups
-- ============================================================
CREATE INDEX IF NOT EXISTS team_members_user_idx ON team_members (user_id);
CREATE INDEX IF NOT EXISTS team_members_owner_idx ON team_members (owner_id);
