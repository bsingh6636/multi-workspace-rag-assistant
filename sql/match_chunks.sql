-- Workspace-scoped vector search. Spec: docs/DESIGN.md §2.
--
-- The workspace filter is INSIDE the vector query: Postgres only ranks rows
-- that already belong to ws_id. We never search globally and filter afterwards.
-- Similarity is cosine similarity (1 - cosine distance); the server applies
-- SIMILARITY_THRESHOLD to the results.

create or replace function match_chunks(
  ws_id            uuid,
  query_embedding  vector(768),
  k                int default 5
)
returns table (
  id           uuid,
  document_id  uuid,
  chunk_index  int,
  content      text,
  section      text,
  filename     text,
  similarity   float
)
language sql stable
as $$
  select c.id, c.document_id, c.chunk_index, c.content, c.section, d.filename,
         1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  join documents d on d.id = c.document_id
  where c.workspace_id = ws_id               -- isolation: inside the vector query
  order by c.embedding <=> query_embedding
  limit k;
$$;

-- Only the server (service role) may call it.
revoke execute on function match_chunks(uuid, vector, int) from public, anon, authenticated;
grant  execute on function match_chunks(uuid, vector, int) to service_role;
