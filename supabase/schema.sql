-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create a table to store marketing context (RAG)
create table if not exists marketing_context (
  id bigserial primary key,
  content text not null,
  source text not null, -- 'Dune', 'LunarCrush', 'Campaign'
  metadata jsonb, -- Store raw stats or extra info
  embedding vector(768), -- Dimension for Gemini text-embedding-004 is 768
  created_at timestamptz default now()
);

-- Create a search function for similarity
create or replace function match_marketing_context (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  content text,
  source text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    marketing_context.id,
    marketing_context.content,
    marketing_context.source,
    marketing_context.metadata,
    1 - (marketing_context.embedding <=> query_embedding) as similarity
  from marketing_context
  where 1 - (marketing_context.embedding <=> query_embedding) > match_threshold
  order by marketing_context.embedding <=> query_embedding
  limit match_count;
end;
$$;
