ALTER TABLE public.ancestor_profiles
  ADD COLUMN IF NOT EXISTS hometown text,
  ADD COLUMN IF NOT EXISTS birthplace text,
  ADD COLUMN IF NOT EXISTS profession text,
  ADD COLUMN IF NOT EXISTS life_events text,
  ADD COLUMN IF NOT EXISTS likes text,
  ADD COLUMN IF NOT EXISTS dislikes text,
  ADD COLUMN IF NOT EXISTS favorite_foods text,
  ADD COLUMN IF NOT EXISTS personal_tragedies text,
  ADD COLUMN IF NOT EXISTS proudest_moments text,
  ADD COLUMN IF NOT EXISTS worldview text;

CREATE TABLE public.echoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ancestor_id uuid NOT NULL REFERENCES public.ancestor_profiles(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.chat_sessions(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.echoes TO authenticated;
GRANT ALL ON public.echoes TO service_role;

ALTER TABLE public.echoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own echoes" ON public.echoes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS echoes_ancestor_idx ON public.echoes (ancestor_id, created_at DESC);