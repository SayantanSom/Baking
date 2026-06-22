-- Fix: "Database error saving new user"
-- Run this in the Supabase SQL Editor if signup fails.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inviter_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM app_users WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.raw_user_meta_data->>'invited_by_admin', '') = 'true' THEN
    inviter_id := NULLIF(NEW.raw_user_meta_data->>'invited_by', '')::UUID;

    INSERT INTO app_users (user_id, email, status, role, approved_at, approved_by)
    VALUES (NEW.id, NEW.email, 'approved', 'user', NOW(), inviter_id)
    ON CONFLICT (user_id) DO UPDATE
      SET status = 'approved',
          email = EXCLUDED.email,
          approved_at = COALESCE(app_users.approved_at, NOW()),
          approved_by = COALESCE(app_users.approved_by, EXCLUDED.approved_by);

    INSERT INTO user_settings (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
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
GRANT ALL ON TABLE public.user_settings TO supabase_auth_admin;
GRANT ALL ON TABLE public.app_users TO supabase_auth_admin;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
