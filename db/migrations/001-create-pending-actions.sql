-- Creates pending_actions table
CREATE TABLE IF NOT EXISTS public.pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  payload jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  executed_at timestamptz
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_pending_user_id ON public.pending_actions(user_id);
