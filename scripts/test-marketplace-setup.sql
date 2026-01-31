-- Test script to verify marketplace_resources table setup
-- Run this in Supabase SQL Editor after running the migration

-- 1. Verify table exists
SELECT 
    table_name, 
    table_type
FROM information_schema.tables 
WHERE table_name = 'marketplace_resources';

-- Expected: 1 row showing the table exists

-- 2. Check all resources are loaded
SELECT 
    id,
    name,
    icon,
    rarity,
    category,
    base_ocx_rate,
    is_tradable
FROM marketplace_resources
ORDER BY base_ocx_rate ASC;

-- Expected: 4 rows
-- nickel   | Nickel    | ⚪ | common   | mineral | 10  | true
-- cobalt   | Cobalt    | 🔵 | uncommon | mineral | 25  | true
-- copper   | Copper    | 🟠 | rare     | mineral | 50  | true
-- manganese| Manganese | ⚫ | epic     | mineral | 100 | true

-- 3. Verify RLS is enabled
SELECT 
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'marketplace_resources';

-- Expected: rowsecurity = true

-- 4. Check RLS policies exist
SELECT 
    policyname,
    cmd,
    roles
FROM pg_policies 
WHERE tablename = 'marketplace_resources';

-- Expected: 2 policies
-- Allow public read access to marketplace_resources | SELECT | {public}
-- Only service role can modify marketplace_resources | ALL    | {service_role}

-- 5. Test query that the app uses
SELECT 
    id, 
    name, 
    icon, 
    base_ocx_rate, 
    description,
    rarity,
    category,
    is_tradable
FROM marketplace_resources
WHERE is_tradable = true;

-- Expected: 4 rows with all resource data

-- 6. Simulate combining with player resources (using a test player_id)
-- Replace 'YOUR_PLAYER_ID' with an actual player UUID from your players table
-- SELECT 
--     mr.id,
--     mr.name,
--     mr.icon,
--     mr.base_ocx_rate,
--     pr.nickel,
--     pr.cobalt,
--     pr.copper,
--     pr.manganese
-- FROM marketplace_resources mr
-- CROSS JOIN get_player_resources('YOUR_PLAYER_ID') pr
-- WHERE mr.is_tradable = true;

COMMENT ON COLUMN marketplace_resources.id IS 'Unique identifier matching resource types (nickel, cobalt, copper, manganese)';
COMMENT ON COLUMN marketplace_resources.base_ocx_rate IS 'Base exchange rate: OCX tokens per 1 unit of resource';
COMMENT ON COLUMN marketplace_resources.is_tradable IS 'Whether this resource can be traded in the marketplace';
