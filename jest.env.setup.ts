// Jest environment setup - runs before test framework initialization
// Cast process.env to any to allow write during test setup (avoids readonly type error)
(process.env as any).NODE_ENV = 'test';
(process.env as any).NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
(process.env as any).NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key-12345';
(process.env as any).NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
