-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;
create extension if not exists pgcrypto;

-- Create a table to store marketing context (RAG)
create table if not exists marketing_context (
  id bigserial primary key,
  content text not null,
  source text not null, -- 'Dune', 'LunarCrush', 'Campaign'
  metadata jsonb, -- Store raw stats or extra info
  embedding vector(768), -- Dimension for Gemini text-embedding-004 is 768
  created_at timestamptz default now()
);

-- Canonical brand registry (multi-tenant ready)
create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  owner_id text,
  name text not null,
  slug text,
  website_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists brands_name_unique on brands (lower(name));
create index if not exists brands_owner_idx on brands (owner_id);

-- Brand source inputs (domains, social handles, etc.)
create table if not exists brand_sources (
  id bigserial primary key,
  brand_id uuid references brands(id) on delete cascade,
  source_type text not null, -- domain | x_handle | youtube | other
  value text not null,
  normalized_value text,
  metadata jsonb,
  created_at timestamptz default now()
);

create index if not exists brand_sources_brand_idx on brand_sources (brand_id);
create index if not exists brand_sources_type_idx on brand_sources (source_type);
create unique index if not exists brand_sources_unique on brand_sources (brand_id, source_type, normalized_value);

-- Enrichment artifacts + versioning
create table if not exists brand_enrichments (
  id bigserial primary key,
  brand_id uuid references brands(id) on delete cascade,
  version integer not null default 1,
  mode text, -- collector | fallback
  summary text,
  raw_profile jsonb,
  created_at timestamptz default now()
);

create index if not exists brand_enrichments_brand_idx on brand_enrichments (brand_id);

-- Structured brand configs (versioned)
create table if not exists brand_configs (
  id bigserial primary key,
  brand_id uuid references brands(id) on delete cascade,
  version integer not null default 1,
  config jsonb not null,
  created_at timestamptz default now()
);

create index if not exists brand_configs_brand_idx on brand_configs (brand_id);

-- External integration settings per brand
create table if not exists brand_integrations (
  id bigserial primary key,
  brand_id uuid references brands(id) on delete cascade,
  dune_query_ids jsonb,
  apify_handle text,
  lunarcrush_symbol text,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists brand_integrations_brand_unique on brand_integrations (brand_id);

-- Persistent decisions from agent cycles
create table if not exists agent_decisions (
  id bigserial primary key,
  brand_id uuid references brands(id) on delete cascade,
  action text,
  target_id text,
  reason text,
  draft text,
  status text default 'pending', -- pending | approved | rejected
  metadata jsonb,
  created_at timestamptz default now()
);

create index if not exists agent_decisions_brand_idx on agent_decisions (brand_id);
create index if not exists agent_decisions_created_idx on agent_decisions (created_at);

-- Automation preferences scoped to brand + user
create table if not exists automation_policies (
  id bigserial primary key,
  brand_id uuid references brands(id) on delete cascade,
  owner_id text,
  enabled boolean default true,
  schedule_window jsonb,
  posting_limits jsonb,
  risk_thresholds jsonb,
  updated_at timestamptz default now()
);

create unique index if not exists automation_policies_brand_owner_unique on automation_policies (brand_id, owner_id);

-- Brand-scoped memory for RAG
create table if not exists brand_memory (
  id bigserial primary key,
  brand_id uuid references brands(id) on delete cascade,
  owner_id text,
  content text not null,
  source text,
  metadata jsonb,
  embedding vector(768),
  created_at timestamptz default now()
);

create index if not exists brand_memory_brand_idx on brand_memory (brand_id);
create index if not exists brand_memory_owner_idx on brand_memory (owner_id);

create or replace function match_brand_memory (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_brand_id uuid
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
    brand_memory.id,
    brand_memory.content,
    brand_memory.source,
    brand_memory.metadata,
    1 - (brand_memory.embedding <=> query_embedding) as similarity
  from brand_memory
  where (filter_brand_id is null or brand_memory.brand_id = filter_brand_id)
    and 1 - (brand_memory.embedding <=> query_embedding) > match_threshold
  order by brand_memory.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Generated asset registry (for CDN-backed storage)
create table if not exists brand_assets (
  id bigserial primary key,
  brand_id uuid references brands(id) on delete cascade,
  asset_type text, -- image | pdf | other
  storage_path text,
  public_url text,
  metadata jsonb,
  created_at timestamptz default now()
);

create index if not exists brand_assets_brand_idx on brand_assets (brand_id);

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

-- Key-value store for app state (cloud sync)
create table if not exists app_storage (
  id bigserial primary key,
  key text not null,
  value jsonb,
  updated_at timestamptz default now()
);

create unique index if not exists app_storage_key_unique on app_storage (key);

-- Content publication logs
create table if not exists content_logs (
  id bigserial primary key,
  brand_id text,
  platform text,       -- twitter | telegram
  content text,
  metrics jsonb,
  url text,
  media_url text,
  posted_at timestamptz default now()
);

create index if not exists content_logs_brand_idx on content_logs (brand_id);

-- Campaign performance analytics
create table if not exists campaign_performance (
  id bigserial primary key,
  name text,
  channel text,
  spend numeric,
  attributed_wallets integer,
  cpa numeric,
  retention numeric,
  value_created numeric,
  roi numeric,
  status_label text,
  trend_signal text,
  confidence text,
  ai_summary jsonb,
  anomalies jsonb,
  priority_score numeric,
  campaign_type text,
  expected_impact text,
  recommendation jsonb,
  media_url text
);

-- Strategy documents for pulse analysis
create table if not exists strategy_docs (
  id bigserial primary key,
  content text,
  metadata jsonb,
  created_at timestamptz default now()
);

-- Stripe subscription records
create table if not exists subscriptions (
  id text primary key,                        -- Stripe subscription ID
  user_id uuid references auth.users(id),
  brand_id uuid references brands(id),
  stripe_customer_id text not null,
  stripe_price_id text not null,
  plan_tier text not null,                    -- starter | growth | enterprise
  status text not null default 'active',      -- active | canceled | past_due | trialing
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists subscriptions_user_idx on subscriptions (user_id);
create index if not exists subscriptions_brand_idx on subscriptions (brand_id);
create index if not exists subscriptions_stripe_customer_idx on subscriptions (stripe_customer_id);

-- Telegram bot: links between Telegram group chats and Defia brands
create table if not exists telegram_links (
  id bigserial primary key,
  brand_id text not null,
  chat_id bigint not null,
  chat_title text,
  chat_type text,                  -- 'group' | 'supergroup' | 'private'
  linked_by text,                  -- Telegram username who ran /link
  link_code text,
  notifications_enabled boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists telegram_links_brand_chat_unique on telegram_links (brand_id, chat_id);
create index if not exists telegram_links_brand_idx on telegram_links (brand_id);
create index if not exists telegram_links_chat_idx on telegram_links (chat_id);
