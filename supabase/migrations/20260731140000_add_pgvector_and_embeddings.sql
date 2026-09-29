-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create transaction_embeddings table
CREATE TABLE public.transaction_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  embedding vector(1536) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for similarity search
CREATE INDEX ON public.transaction_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Enable RLS
ALTER TABLE public.transaction_embeddings ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.transaction_embeddings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_embeddings TO authenticated;
CREATE POLICY "Users manage own embeddings" ON public.transaction_embeddings FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
