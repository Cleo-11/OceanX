-- Ensure player submarine tiers default correctly and audit updates
BEGIN;

ALTER TABLE players
  ALTER COLUMN submarine_tier SET DEFAULT 1;

UPDATE players
SET submarine_tier = 1
WHERE submarine_tier IS NULL OR submarine_tier < 1;

ALTER TABLE players
  ALTER COLUMN submarine_tier SET NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_players_set_updated_at()
RETURNS trigger AS
$$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_players_updated_at ON players;
CREATE TRIGGER set_players_updated_at
BEFORE UPDATE ON players
FOR EACH ROW
EXECUTE FUNCTION public.fn_players_set_updated_at();

COMMIT;
