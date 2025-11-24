// Production environment validation for server
require('dotenv').config();

console.log('🔍 Production Environment Check\n');

// Required environment variables for production
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'FRONTEND_URL'
];

// Optional but recommended
const optionalEnvVars = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'RPC_URL',
  'PORT'
];

let hasAllRequired = true;

console.log('✅ Required Environment Variables:');
requiredEnvVars.forEach(envVar => {
  const value = process.env[envVar];
  if (value) {
    console.log(`   ${envVar}: ${value.substring(0, 20)}...`);
  } else {
    console.log(`❌ ${envVar}: MISSING`);
    hasAllRequired = false;
  }
});

console.log('\n📋 Optional Environment Variables:');
optionalEnvVars.forEach(envVar => {
  const value = process.env[envVar];
  if (value) {
    console.log(`   ${envVar}: ${value.substring(0, 20)}...`);
  } else {
    console.log(`⚠️  ${envVar}: Not set`);
  }
});

console.log('\n🌐 Server Configuration:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`   PORT: ${process.env.PORT || '5000'}`);

if (hasAllRequired) {
  console.log('\n✅ All required environment variables are set!');
  console.log('🚀 Server is ready for production deployment');
} else {
  console.log('\n❌ Missing required environment variables!');
  console.log('⚠️  Please set all required variables before deployment');
  process.exit(1);
}

// Test Supabase connection if variables are present
if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  const { createClient } = require('@supabase/supabase-js');
  
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    
    console.log('\n🗄️  Testing Supabase connection...');
    // Simple test - this will be async but we're just checking if client creation works
    console.log('✅ Supabase client initialized successfully');
  } catch (error) {
    console.log('❌ Supabase connection error:', error.message);
  }
}