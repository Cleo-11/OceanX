-- Migration: Create marketplace_resources table
-- Date: 2026-01-31
-- Description: Creates the marketplace_resources table to store resource definitions,
--              exchange rates, and metadata for the Ocean Trading Hub

-- Create marketplace_resources table
CREATE TABLE IF NOT EXISTS marketplace_resources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  category TEXT NOT NULL CHECK (category IN ('mineral', 'organic', 'energy', 'artifact')),
  base_ocx_rate NUMERIC NOT NULL CHECK (base_ocx_rate > 0),
  description TEXT,
  is_tradable BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_marketplace_resources_category ON marketplace_resources(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_resources_rarity ON marketplace_resources(rarity);

-- Insert the 4 core mineable resources
INSERT INTO marketplace_resources (id, name, icon, rarity, category, base_ocx_rate, description, is_tradable) VALUES
('nickel', 'Nickel', '⚪', 'common', 'mineral', 10, 'Common nickel deposits found on the ocean floor', true),
('cobalt', 'Cobalt', '🔵', 'uncommon', 'mineral', 25, 'Valuable cobalt-rich mineral nodules from deep waters', true),
('copper', 'Copper', '🟠', 'rare', 'mineral', 50, 'Rare copper ore deposits from volcanic vents', true),
('manganese', 'Manganese', '⚫', 'epic', 'mineral', 100, 'Premium manganese nodules from the abyssal plains', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  rarity = EXCLUDED.rarity,
  category = EXCLUDED.category,
  base_ocx_rate = EXCLUDED.base_ocx_rate,
  description = EXCLUDED.description,
  is_tradable = EXCLUDED.is_tradable,
  updated_at = NOW();

-- Enable RLS
ALTER TABLE marketplace_resources ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Allow all users to read marketplace resources
CREATE POLICY "Allow public read access to marketplace_resources"
  ON marketplace_resources
  FOR SELECT
  TO public
  USING (true);

-- Only service role can modify marketplace resources
CREATE POLICY "Only service role can modify marketplace_resources"
  ON marketplace_resources
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON marketplace_resources TO authenticated;
GRANT SELECT ON marketplace_resources TO anon;
GRANT ALL ON marketplace_resources TO service_role;

-- Add comment
COMMENT ON TABLE marketplace_resources IS 'Catalog of tradable resources in the Ocean Trading Hub marketplace with exchange rates and metadata';
