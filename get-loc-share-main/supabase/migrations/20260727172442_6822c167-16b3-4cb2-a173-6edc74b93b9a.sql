
CREATE EXTENSION IF NOT EXISTS vector;

-- Ancestor profiles
CREATE TABLE public.ancestor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  biography TEXT,
  birth_year INTEGER,
  passing_year INTEGER,
  relation TEXT,
  system_prompt_override TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ancestor_profiles TO authenticated;
GRANT ALL ON public.ancestor_profiles TO service_role;
ALTER TABLE public.ancestor_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ancestors" ON public.ancestor_profiles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Source documents
CREATE TABLE public.source_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ancestor_id UUID NOT NULL REFERENCES public.ancestor_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_url TEXT,
  file_type TEXT,
  era_label TEXT,
  document_date DATE,
  raw_content TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  chunk_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.source_documents TO authenticated;
GRANT ALL ON public.source_documents TO service_role;
ALTER TABLE public.source_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own documents" ON public.source_documents FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX source_documents_ancestor_idx ON public.source_documents(ancestor_id);

-- Memory chunks (with embeddings, 1536-dim text-embedding-3-small)
CREATE TABLE public.memory_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.source_documents(id) ON DELETE CASCADE,
  ancestor_id UUID NOT NULL REFERENCES public.ancestor_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  document_title TEXT,
  era_label TEXT,
  document_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memory_chunks TO authenticated;
GRANT ALL ON public.memory_chunks TO service_role;
ALTER TABLE public.memory_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chunks" ON public.memory_chunks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX memory_chunks_ancestor_idx ON public.memory_chunks(ancestor_id);
CREATE INDEX memory_chunks_embedding_idx ON public.memory_chunks USING hnsw (embedding vector_cosine_ops);

-- Chat sessions
CREATE TABLE public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ancestor_id UUID NOT NULL REFERENCES public.ancestor_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_sessions TO authenticated;
GRANT ALL ON public.chat_sessions TO service_role;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions" ON public.chat_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX chat_sessions_ancestor_idx ON public.chat_sessions(ancestor_id);

-- Messages
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','ancestor')),
  content TEXT NOT NULL,
  retrieved_chunk_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages" ON public.chat_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX chat_messages_session_idx ON public.chat_messages(session_id, created_at);

-- Similarity search RPC
CREATE OR REPLACE FUNCTION public.match_memory_chunks(
  query_embedding vector(1536),
  target_ancestor_id UUID,
  match_count INT DEFAULT 8
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  document_title TEXT,
  era_label TEXT,
  document_date DATE,
  similarity FLOAT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.content, c.document_title, c.era_label, c.document_date,
         1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.memory_chunks c
  WHERE c.ancestor_id = target_ancestor_id
    AND c.user_id = auth.uid()
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;
GRANT EXECUTE ON FUNCTION public.match_memory_chunks(vector, UUID, INT) TO authenticated;

-- Storage RLS: users manage files under their own uid prefix in ancestor-documents bucket
CREATE POLICY "own upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ancestor-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ancestor-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ancestor-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
