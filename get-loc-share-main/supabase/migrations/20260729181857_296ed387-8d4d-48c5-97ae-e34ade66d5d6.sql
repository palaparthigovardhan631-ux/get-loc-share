ALTER TABLE public.ancestor_profiles
  ADD COLUMN IF NOT EXISTS face_url text,
  ADD COLUMN IF NOT EXISTS voice_id text;

CREATE TABLE IF NOT EXISTS public.call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ancestor_id uuid NOT NULL REFERENCES public.ancestor_profiles(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.chat_sessions(id) ON DELETE SET NULL,
  stream_id text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  turns integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_logs TO authenticated;
GRANT ALL ON public.call_logs TO service_role;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own call logs" ON public.call_logs;
CREATE POLICY "Users manage their own call logs" ON public.call_logs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS call_logs_ancestor_idx ON public.call_logs (ancestor_id, started_at DESC);