#!/usr/bin/env node
/**
 * Environment Variable Checker
 * 
 * Validates that all required environment variables are set before starting the server.
 * This prevents runtime errors and provides clear feedback about missing configuration.
 */

const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
];

const optionalEnvVars = [
  'PORT',
  'NODE_ENV',
  'FRONTEND_URL',
  'RPC_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET',
];

console.log('🔍 Checking environment variables...\n');

let hasErrors = false;

// Check required variables
console.log('Required variables:');
requiredEnvVars.forEach(varName => {
  if (process.env[varName]) {
    console.log(`  ✅ ${varName}: Set`);
  } else {
    console.error(`  ❌ ${varName}: MISSING`);
    hasErrors = true;
  }
});

// Check optional variables
console.log('\nOptional variables:');
optionalEnvVars.forEach(varName => {
  if (process.env[varName]) {
    console.log(`  ✅ ${varName}: Set`);
  } else {
    console.log(`  ⚠️  ${varName}: Not set (using defaults)`);
  }
});

if (hasErrors) {
  console.error('\n❌ Missing required environment variables!');
  console.error('Please check your .env file or environment configuration.\n');
  process.exit(1);
}

console.log('\n✅ Environment check passed!\n');
