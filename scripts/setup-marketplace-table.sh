/bin/bash

# Script to create marketplace_resources table in Supabase
# This enables the Ocean Trading Hub to display resources from the database

echo "🚀 Creating marketplace_resources table in Supabase..."
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if migration file exists
MIGRATION_FILE="db/migrations/012-create-marketplace-resources.sql"
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "📋 Migration file found: $MIGRATION_FILE"
echo ""

# Apply the migration
echo "Applying migration..."
supabase db push

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration applied successfully!"
    echo ""
    echo "📊 The marketplace_resources table has been created with:"
    echo "   - 4 core resources (Nickel, Cobalt, Copper, Manganese)"
    echo "   - Exchange rates configured"
    echo "   - RLS policies enabled"
    echo ""
    echo "🎮 Your Ocean Trading Hub should now display resources from Supabase!"
else
    echo ""
    echo "❌ Migration failed. Please check your Supabase connection."
    echo ""
    echo "Alternative: You can run the SQL manually:"
    echo "1. Go to Supabase Dashboard > SQL Editor"
    echo "2. Copy the contents of: $MIGRATION_FILE"
    echo "3. Paste and run the SQL"
fi
