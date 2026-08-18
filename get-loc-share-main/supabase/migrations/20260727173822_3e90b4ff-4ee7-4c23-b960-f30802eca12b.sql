
ALTER TABLE public.ancestor_profiles
  ADD COLUMN IF NOT EXISTS spoken_language TEXT,
  ADD COLUMN IF NOT EXISTS accent_note TEXT,
  ADD COLUMN IF NOT EXISTS portrait_url TEXT;
