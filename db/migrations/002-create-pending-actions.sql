-- Migration: create pending_actions table for resume-after-linking
-- Run this in your Supabase SQL editor or with psql against your DATABASE_URL

CREATE TABLE IF NOT EXISTS public.pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  tx_hash text,
  tx_receipt jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz
);

-- Index for lookups by user
CREATE INDEX IF NOT EXISTS idx_pending_actions_user_id ON public.pending_actions (user_id);
-- Index for tx_hash if you need to search by transaction
CREATE INDEX IF NOT EXISTS idx_pending_actions_tx_hash ON public.pending_actions (tx_hash);

-- Note: If you're using Supabase Postgres without the pgcrypto extension,
-- gen_random_uuid() may not exist. Use uuid_generate_v4() if your DB uses the uuid-ossp extension,
-- or omit DEFAULT and set UUID client-side.
