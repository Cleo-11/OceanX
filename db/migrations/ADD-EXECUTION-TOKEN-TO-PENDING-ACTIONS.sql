-- ============================================================================
-- ADD EXECUTION TOKEN TO PENDING ACTIONS
-- ============================================================================
-- This migration adds race condition prevention to the pending_actions table.
-- Prevents duplicate execution of the same pending action via atomic updates.
--
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Add execution_token column for atomic race condition prevention
ALTER TABLE public.pending_actions 
ADD COLUMN IF NOT EXISTS execution_token TEXT UNIQUE;

-- Create index on execution_token for fast duplicate checks
CREATE INDEX IF NOT EXISTS idx_pending_actions_execution_token 
  ON public.pending_actions(execution_token) 
  WHERE execution_token IS NOT NULL;

-- Add index on status for fast pending action lookups
CREATE INDEX IF NOT EXISTS idx_pending_actions_status 
  ON public.pending_actions(status);

-- Add composite index for atomic operations (id + status + execution_token)
CREATE INDEX IF NOT EXISTS idx_pending_actions_atomic_check 
  ON public.pending_actions(id, status, execution_token);

COMMENT ON COLUMN public.pending_actions.execution_token IS 'Unique token set when action executes - prevents race conditions and duplicate execution';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check column was added
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pending_actions'
  AND column_name = 'execution_token';

-- Check indexes were created
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'pending_actions'
  AND indexname LIKE '%execution_token%'
ORDER BY indexname;

-- Check unique constraint
SELECT 
  conname as constraint_name,
  contype as constraint_type
FROM pg_constraint
WHERE conrelid = 'public.pending_actions'::regclass
  AND contype = 'u'
ORDER BY conname;
