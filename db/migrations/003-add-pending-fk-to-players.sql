-- Migration: add foreign key from pending_actions.user_id -> players.user_id
-- This migration will add a constraint named fk_pending_players_user if it does not already exist.
-- The constraint uses ON DELETE CASCADE so pending actions are removed when their player is deleted.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_pending_players_user'
  ) THEN
    -- Ensure players table and column exist before adding the FK
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'players' AND column_name = 'user_id'
    ) THEN
      ALTER TABLE public.pending_actions
        ADD CONSTRAINT fk_pending_players_user
        FOREIGN KEY (user_id) REFERENCES public.players (user_id) ON DELETE CASCADE;
    ELSE
      RAISE NOTICE 'players.user_id not found; skipping foreign key creation';
    END IF;
  ELSE
    RAISE NOTICE 'Constraint fk_pending_players_user already exists; skipping';
  END IF;
END$$;
