-- ============================================================
-- Migration 002: Vector Store (pgvector)
-- Creates the health_embeddings table and search function
-- for Layer 3 semantic search over health narratives.
-- ============================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Health data embeddings for semantic search
CREATE TABLE IF NOT EXISTS health_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id VARCHAR(100) NOT NULL UNIQUE, -- e.g. 'day_2026-04-08', 'lab_2026-02-19'
  content_type VARCHAR(30) NOT NULL,       -- daily_log, lab_result, appointment, imaging, document
  content_date DATE NOT NULL,
  narrative TEXT NOT NULL,                  -- human-readable text chunk
  embedding vector(1536),                  -- OpenAI-compatible dimension

  -- Metadata for filtered search
  cycle_phase VARCHAR(20),
  pain_level INTEGER,
  has_period BOOLEAN DEFAULT FALSE,
  symptom_categories TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast metadata filtering
CREATE INDEX IF NOT EXISTS idx_health_embeddings_date ON health_embeddings(content_date DESC);
CREATE INDEX IF NOT EXISTS idx_health_embeddings_type ON health_embeddings(content_type);
CREATE INDEX IF NOT EXISTS idx_health_embeddings_phase ON health_embeddings(cycle_phase);
CREATE INDEX IF NOT EXISTS idx_health_embeddings_pain ON health_embeddings(pain_level);

-- Full-text search index on narrative (fallback when embeddings unavailable)
-- Use GIN index with english text search config
ALTER TABLE health_embeddings ADD COLUMN IF NOT EXISTS narrative_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', narrative)) STORED;
CREATE INDEX IF NOT EXISTS idx_health_embeddings_fts ON health_embeddings USING GIN(narrative_tsv);

-- NOTE: The IVFFlat vector index should be created AFTER initial data load
-- for optimal performance. Run this manually after syncing data:
--
-- CREATE INDEX IF NOT EXISTS idx_health_embeddings_vector ON health_embeddings
--   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Function for semantic search with metadata filtering
CREATE OR REPLACE FUNCTION search_health_data(
  query_embedding vector(1536),
  match_count INT DEFAULT 10,
  filter_date_start DATE DEFAULT NULL,
  filter_date_end DATE DEFAULT NULL,
  filter_type VARCHAR DEFAULT NULL,
  filter_phase VARCHAR DEFAULT NULL,
  filter_min_pain INT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content_id VARCHAR,
  content_type VARCHAR,
  content_date DATE,
  narrative TEXT,
  cycle_phase VARCHAR,
  pain_level INT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    he.id,
    he.content_id,
    he.content_type,
    he.content_date,
    he.narrative,
    he.cycle_phase,
    he.pain_level,
    1 - (he.embedding <=> query_embedding) AS similarity
  FROM health_embeddings he
  WHERE
    (filter_date_start IS NULL OR he.content_date >= filter_date_start)
    AND (filter_date_end IS NULL OR he.content_date <= filter_date_end)
    AND (filter_type IS NULL OR he.content_type = filter_type)
    AND (filter_phase IS NULL OR he.cycle_phase = filter_phase)
    AND (filter_min_pain IS NULL OR he.pain_level >= filter_min_pain)
    AND he.embedding IS NOT NULL
  ORDER BY he.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function for full-text search fallback (when no embeddings available)
CREATE OR REPLACE FUNCTION search_health_text(
  query_text TEXT,
  match_count INT DEFAULT 10,
  filter_date_start DATE DEFAULT NULL,
  filter_date_end DATE DEFAULT NULL,
  filter_type VARCHAR DEFAULT NULL,
  filter_phase VARCHAR DEFAULT NULL,
  filter_min_pain INT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content_id VARCHAR,
  content_type VARCHAR,
  content_date DATE,
  narrative TEXT,
  cycle_phase VARCHAR,
  pain_level INT,
  relevance FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
  plain_q tsquery;
  or_q_text text;
  tsq tsquery;
BEGIN
  -- W3.9: Run plainto_tsquery first for stopword removal + stemming, then
  -- swap '&' for '|' to get an OR-joined tsquery. plainto_tsquery by itself
  -- AND-joins every lexeme, which made multi-token queries miss unless every
  -- term appeared in the same row. OR-joining trades strict AND semantics
  -- for recall, which is the right default for a retrieval fallback.
  plain_q := plainto_tsquery('english', query_text);
  or_q_text := replace(plain_q::text, ' & ', ' | ');

  -- Empty query (all stopwords or blank): return no rows
  IF or_q_text = '' OR or_q_text IS NULL THEN
    RETURN;
  END IF;

  tsq := or_q_text::tsquery;

  RETURN QUERY
  SELECT
    he.id,
    he.content_id,
    he.content_type,
    he.content_date,
    he.narrative,
    he.cycle_phase,
    he.pain_level,
    -- W3.4: recency boost. Multiply base rank by exp(-age_days/365) so a
    -- match from today counts roughly e^1 = 2.7x a match from one year ago.
    -- Keeps the ranking continuous instead of a hard cutoff.
    (ts_rank_cd(he.narrative_tsv, tsq) *
      exp(- ((CURRENT_DATE - he.content_date)::float / 365.0))
    )::FLOAT AS relevance
  FROM health_embeddings he
  WHERE
    he.narrative_tsv @@ tsq
    AND (filter_date_start IS NULL OR he.content_date >= filter_date_start)
    AND (filter_date_end IS NULL OR he.content_date <= filter_date_end)
    AND (filter_type IS NULL OR he.content_type = filter_type)
    AND (filter_phase IS NULL OR he.cycle_phase = filter_phase)
    AND (filter_min_pain IS NULL OR he.pain_level >= filter_min_pain)
  ORDER BY
    ts_rank_cd(he.narrative_tsv, tsq) *
      exp(- ((CURRENT_DATE - he.content_date)::float / 365.0))
    DESC
  LIMIT match_count;
END;
$$;
