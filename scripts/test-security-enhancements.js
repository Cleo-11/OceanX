// Test script to verify security enhancements
import 'dotenv/config';

console.log('🧪 Testing Security Enhancements...\n');

// Test 1: Helmet
console.log('1. Testing Helmet import...');
try {
  const helmet = await import('helmet');
  console.log('   ✅ Helmet imported successfully');
} catch (err) {
  console.log('   ❌ Helmet import failed:', err.message);
}

// Test 2: Pino
console.log('\n2. Testing Pino import and initialization...');
try {
  const pino = (await import('pino')).default;
  const logger = pino({
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      }
    }
  });
  console.log('   ✅ Pino imported and initialized');
  logger.info({ test: 'data' }, 'Test log message');
  console.log('   ✅ Pino logging works');
} catch (err) {
  console.log('   ❌ Pino test failed:', err.message);
}

// Test 3: Sentry
console.log('\n3. Testing Sentry import...');
try {
  const Sentry = await import('@sentry/node');
  console.log('   ✅ Sentry imported successfully');
  
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: 'test',
      beforeSend: () => null, // Don't actually send in test
    });
    console.log('   ✅ Sentry initialized with DSN');
  } else {
    console.log('   ℹ️  SENTRY_DSN not set (optional)');
  }
} catch (err) {
  console.log('   ❌ Sentry test failed:', err.message);
}

// Test 4: Check server/index.js for required imports
console.log('\n4. Testing server/index.js imports...');
try {
  const fs = await import('fs');
  const content = fs.readFileSync('server/index.js', 'utf-8');
  
  const checks = [
    { name: 'helmet import', pattern: /import helmet from ["']helmet["']/ },
    { name: 'pino import', pattern: /import pino from ["']pino["']/ },
    { name: 'pino-http import', pattern: /import pinoHttp from ["']pino-http["']/ },
    { name: 'Sentry import', pattern: /import \* as Sentry from ["']@sentry\/node["']/ },
    { name: 'logger export', pattern: /export \{ logger \}/ },
    { name: 'Sentry.init', pattern: /Sentry\.init\(/ },
    { name: 'helmet middleware', pattern: /app\.use\(helmet\(/ },
    { name: 'Sentry error handler', pattern: /Sentry\.Handlers\.errorHandler/ },
  ];
  
  let allPassed = true;
  for (const check of checks) {
    if (check.pattern.test(content)) {
      console.log(`   ✅ ${check.name}`);
    } else {
      console.log(`   ❌ ${check.name} not found`);
      allPassed = false;
    }
  }
  
  if (allPassed) {
    console.log('   ✅ All server/index.js checks passed');
  }
} catch (err) {
  console.log('   ❌ Server file check failed:', err.message);
}

console.log('\n🎉 Security enhancements verification complete!\n');
