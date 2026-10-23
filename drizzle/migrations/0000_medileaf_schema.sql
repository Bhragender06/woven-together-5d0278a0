CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  timezone text NOT NULL DEFAULT 'UTC',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  avatar_url text,
  mfa_enabled boolean NOT NULL DEFAULT false,
  onboarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile delete" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);
CREATE INDEX profiles_email_idx ON public.profiles (lower(email));

CREATE TABLE public.user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_name text NOT NULL DEFAULT '',
  platform text NOT NULL DEFAULT 'web',
  push_token text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_storage_key text,
  processing_status text NOT NULL DEFAULT 'uploaded' CHECK (processing_status IN ('uploaded','processing','needs_review','verified','failed','deleted')),
  extracted_text text,
  overall_confidence numeric,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  deleted_at timestamptz
);
CREATE INDEX prescriptions_user_idx ON public.prescriptions (user_id);

CREATE TABLE public.prescription_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  medication_name text NOT NULL DEFAULT '',
  strength text, dosage text, frequency text, timing text, duration text, quantity text,
  refill_count integer, instructions text,
  confidence numeric,
  user_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX prescription_items_rx_idx ON public.prescription_items (prescription_id);

CREATE TABLE public.medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prescription_item_id uuid REFERENCES public.prescription_items(id) ON DELETE SET NULL,
  name text NOT NULL,
  strength text NOT NULL DEFAULT '',
  dosage text NOT NULL DEFAULT '',
  form text NOT NULL DEFAULT '',
  route text NOT NULL DEFAULT '',
  instructions text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('prescription','manual')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','discontinued')),
  start_date date NOT NULL DEFAULT current_date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX medications_user_idx ON public.medications (user_id);
CREATE INDEX medications_status_idx ON public.medications (status);

CREATE TABLE public.medication_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id uuid NOT NULL UNIQUE REFERENCES public.medications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  frequency text NOT NULL DEFAULT '',
  dose_amount text NOT NULL DEFAULT '',
  time_of_day text[] NOT NULL DEFAULT '{}',
  doses_per_day integer NOT NULL DEFAULT 1,
  duration_days integer,
  timezone text NOT NULL DEFAULT 'UTC',
  start_date date NOT NULL DEFAULT current_date,
  end_date date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX medication_schedules_med_idx ON public.medication_schedules (medication_id);

CREATE TABLE public.dose_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.medication_schedules(id) ON DELETE CASCADE,
  medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  scheduled_time text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','taken','skipped','missed','snoozed')),
  taken_at timestamptz,
  skipped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, scheduled_date, scheduled_time)
);
CREATE INDEX dose_events_schedule_idx ON public.dose_events (schedule_id);
CREATE INDEX dose_events_scheduled_at_idx ON public.dose_events (scheduled_at);

CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  medication_id uuid REFERENCES public.medications(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES public.medication_schedules(id) ON DELETE CASCADE,
  reminder_type text NOT NULL DEFAULT 'dose' CHECK (reminder_type IN ('dose','missed_dose','refill','schedule_change')),
  notification_time text,
  snooze_minutes integer NOT NULL DEFAULT 10,
  enabled boolean NOT NULL DEFAULT true,
  quiet_hours_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reminders_user_idx ON public.reminders (user_id);

CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  push_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT false,
  discreet_mode boolean NOT NULL DEFAULT false,
  sound boolean NOT NULL DEFAULT true,
  snooze_minutes integer NOT NULL DEFAULT 10,
  missed_window integer NOT NULL DEFAULT 60,
  escalate boolean NOT NULL DEFAULT true,
  refill_days integer NOT NULL DEFAULT 5,
  quiet_start text NOT NULL DEFAULT '22:30',
  quiet_end text NOT NULL DEFAULT '07:00',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.refills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id uuid NOT NULL UNIQUE REFERENCES public.medications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0,
  remaining_quantity integer NOT NULL DEFAULT 0,
  estimated_runout_date date,
  refill_status text NOT NULL DEFAULT 'not_due' CHECK (refill_status IN ('not_due','approaching','due','requested','completed')),
  last_refill_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refills_runout_idx ON public.refills (estimated_runout_date);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','submitted','processing','completed','cancelled','failed')),
  pharmacy text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_user_idx ON public.orders (user_id);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  medication_id uuid REFERENCES public.medications(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 0,
  refill_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.caregiver_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  caregiver_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('view_medications','view_schedules','manage_reminders','view_refills','manage_selected_medications')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL,
  action text NOT NULL,
  resource_type text,
  resource_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_user_idx ON public.audit_logs (user_id);
CREATE INDEX audit_logs_created_idx ON public.audit_logs (created_at);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['user_devices','prescriptions','prescription_items','medications','medication_schedules','dose_events','reminders','notification_preferences','refills','orders','order_items'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "own rows" ON public.%I FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t);
  END LOOP;
END $$;

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own audit select" ON public.audit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own audit insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND auth.uid() = actor_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.caregiver_permissions TO authenticated;
GRANT ALL ON public.caregiver_permissions TO service_role;
ALTER TABLE public.caregiver_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages" ON public.caregiver_permissions FOR ALL TO authenticated USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "caregiver sees own grants" ON public.caregiver_permissions FOR SELECT TO authenticated USING (auth.uid() = caregiver_user_id);

CREATE POLICY "own rx images select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'prescriptions' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own rx images insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'prescriptions' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own rx images delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'prescriptions' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles select" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.admin_emails (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_emails TO service_role;
ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), ''), lower(COALESCE(NEW.email, '')))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.notification_preferences (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  IF EXISTS (SELECT 1 FROM public.admin_emails WHERE email = lower(COALESCE(NEW.email, ''))) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $function$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.protect_profile_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_protect_status BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_status();

CREATE TABLE public.recycling_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  wrappers integer NOT NULL DEFAULT 0 CHECK (wrappers >= 0 AND wrappers <= 500),
  bottles integer NOT NULL DEFAULT 0 CHECK (bottles >= 0 AND bottles <= 500),
  expired integer NOT NULL DEFAULT 0 CHECK (expired >= 0 AND expired <= 500),
  tracking_number text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  verified_count integer CHECK (verified_count IS NULL OR verified_count >= 0),
  verified_at timestamptz,
  verified_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (wrappers + bottles + expired > 0)
);
CREATE INDEX recycling_submissions_user_idx ON public.recycling_submissions(user_id);
GRANT SELECT, INSERT ON public.recycling_submissions TO authenticated;
GRANT ALL ON public.recycling_submissions TO service_role;
ALTER TABLE public.recycling_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own returns select" ON public.recycling_submissions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own returns insert" ON public.recycling_submissions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending' AND verified_count IS NULL AND verified_at IS NULL AND verified_by IS NULL);

CREATE TABLE public.reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tier integer NOT NULL CHECK (tier IN (50, 100, 150)),
  seeds text[] NOT NULL DEFAULT '{}',
  ship_name text NOT NULL DEFAULT '',
  ship_address text NOT NULL DEFAULT '',
  ship_phone text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'shipped', 'delivered')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tier)
);
CREATE INDEX reward_claims_user_idx ON public.reward_claims(user_id);
GRANT SELECT, INSERT ON public.reward_claims TO authenticated;
GRANT ALL ON public.reward_claims TO service_role;
ALTER TABLE public.reward_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own claims select" ON public.reward_claims FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own claims insert" ON public.reward_claims FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.validate_reward_claim()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total integer;
BEGIN
  SELECT COALESCE(SUM(verified_count), 0) INTO total
  FROM public.recycling_submissions
  WHERE user_id = NEW.user_id AND status = 'verified';
  IF total < NEW.tier THEN
    RAISE EXCEPTION 'You need % verified items to claim this reward (you have %)', NEW.tier, total;
  END IF;
  IF cardinality(NEW.seeds) < 1 OR cardinality(NEW.seeds) > 3 THEN
    RAISE EXCEPTION 'Choose 1 to 3 seed varieties';
  END IF;
  IF NOT (NEW.seeds <@ ARRAY['sunflower', 'marigold', 'lavender', 'wildflower', 'chamomile']::text[]) THEN
    RAISE EXCEPTION 'Unknown seed variety';
  END IF;
  IF length(trim(NEW.ship_name)) = 0 OR length(trim(NEW.ship_address)) < 10 THEN
    RAISE EXCEPTION 'Add a delivery name and full address';
  END IF;
  NEW.status := 'processing';
  NEW.created_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.validate_reward_claim() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER reward_claims_validate BEFORE INSERT ON public.reward_claims
FOR EACH ROW EXECUTE FUNCTION public.validate_reward_claim();