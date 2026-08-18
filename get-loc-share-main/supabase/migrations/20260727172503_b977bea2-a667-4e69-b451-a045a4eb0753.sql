
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
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT c.id, c.content, c.document_title, c.era_label, c.document_date,
         1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.memory_chunks c
  WHERE c.ancestor_id = target_ancestor_id
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;
