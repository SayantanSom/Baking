-- User approval workflow: new signups are pending until a super admin approves them.
-- Run once in the Supabase SQL Editor on an existing database.

CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('super_admin', 'user')),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_users_status ON app_users(status);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);

CREATE OR REPLACE FUNCTION public.is_approved_user(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app_users
    WHERE user_id = uid AND status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app_users
    WHERE user_id = uid AND role = 'super_admin' AND status = 'approved'
  );
$$;

-- Backfill existing auth users as approved; earliest account becomes super admin.
INSERT INTO app_users (user_id, email, status, role, approved_at)
SELECT u.id, u.email, 'approved', 'user', NOW()
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;

UPDATE app_users
SET role = 'super_admin'
WHERE user_id = (
  SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1
);

-- Ensure all approved users have settings rows
INSERT INTO user_settings (user_id)
SELECT au.user_id
FROM app_users au
WHERE au.status = 'approved'
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM app_users WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  IF (SELECT COUNT(*) FROM app_users) = 0 THEN
    INSERT INTO app_users (user_id, email, status, role, approved_at)
    VALUES (NEW.id, NEW.email, 'approved', 'super_admin', NOW());
    INSERT INTO user_settings (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  ELSE
    INSERT INTO app_users (user_id, email, status, role)
    VALUES (NEW.id, NEW.email, 'pending', 'user');
  END IF;

  RETURN NEW;
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
GRANT ALL ON TABLE public.app_users TO supabase_auth_admin;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.approve_app_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE app_users
  SET
    status = 'approved',
    approved_at = NOW(),
    approved_by = auth.uid(),
    updated_at = NOW()
  WHERE user_id = target_user_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found or not pending';
  END IF;

  INSERT INTO user_settings (user_id) VALUES (target_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_app_user(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE app_users
  SET
    status = 'rejected',
    approved_at = NULL,
    approved_by = auth.uid(),
    updated_at = NOW()
  WHERE user_id = target_user_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found or not pending';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_app_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_app_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_approved_user(UUID) TO authenticated;

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own app user row" ON app_users;
CREATE POLICY "Users can view own app user row" ON app_users
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Super admins can view all app users" ON app_users;
CREATE POLICY "Super admins can view all app users" ON app_users
  FOR SELECT USING (public.is_super_admin(auth.uid()));

-- Tighten data access to approved users only (user_settings)
DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
CREATE POLICY "Users can view own settings" ON user_settings
  FOR SELECT USING (auth.uid() = user_id AND public.is_approved_user(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
CREATE POLICY "Users can insert own settings" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_approved_user(auth.uid()));

DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
CREATE POLICY "Users can update own settings" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id AND public.is_approved_user(auth.uid()));

-- Ingredients
DROP POLICY IF EXISTS "Users can view own ingredients" ON ingredients;
CREATE POLICY "Users can view own ingredients" ON ingredients
  FOR SELECT USING (auth.uid() = user_id AND public.is_approved_user(auth.uid()));
DROP POLICY IF EXISTS "Users can insert own ingredients" ON ingredients;
CREATE POLICY "Users can insert own ingredients" ON ingredients
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_approved_user(auth.uid()));
DROP POLICY IF EXISTS "Users can update own ingredients" ON ingredients;
CREATE POLICY "Users can update own ingredients" ON ingredients
  FOR UPDATE USING (auth.uid() = user_id AND public.is_approved_user(auth.uid()));
DROP POLICY IF EXISTS "Users can delete own ingredients" ON ingredients;
CREATE POLICY "Users can delete own ingredients" ON ingredients
  FOR DELETE USING (auth.uid() = user_id AND public.is_approved_user(auth.uid()));

-- Products
DROP POLICY IF EXISTS "Users can view own products" ON products;
CREATE POLICY "Users can view own products" ON products
  FOR SELECT USING (auth.uid() = user_id AND public.is_approved_user(auth.uid()));
DROP POLICY IF EXISTS "Users can insert own products" ON products;
CREATE POLICY "Users can insert own products" ON products
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_approved_user(auth.uid()));
DROP POLICY IF EXISTS "Users can update own products" ON products;
CREATE POLICY "Users can update own products" ON products
  FOR UPDATE USING (auth.uid() = user_id AND public.is_approved_user(auth.uid()));
DROP POLICY IF EXISTS "Users can delete own products" ON products;
CREATE POLICY "Users can delete own products" ON products
  FOR DELETE USING (auth.uid() = user_id AND public.is_approved_user(auth.uid()));

-- Catalogue templates
DROP POLICY IF EXISTS "Users can view own catalogue templates" ON catalogue_templates;
CREATE POLICY "Users can view own catalogue templates" ON catalogue_templates
  FOR SELECT USING (auth.uid() = user_id AND public.is_approved_user(auth.uid()));
DROP POLICY IF EXISTS "Users can insert own catalogue templates" ON catalogue_templates;
CREATE POLICY "Users can insert own catalogue templates" ON catalogue_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_approved_user(auth.uid()));
DROP POLICY IF EXISTS "Users can update own catalogue templates" ON catalogue_templates;
CREATE POLICY "Users can update own catalogue templates" ON catalogue_templates
  FOR UPDATE USING (auth.uid() = user_id AND public.is_approved_user(auth.uid()));
DROP POLICY IF EXISTS "Users can delete own catalogue templates" ON catalogue_templates;
CREATE POLICY "Users can delete own catalogue templates" ON catalogue_templates
  FOR DELETE USING (auth.uid() = user_id AND public.is_approved_user(auth.uid()));

CREATE TRIGGER app_users_updated
  BEFORE UPDATE ON app_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
