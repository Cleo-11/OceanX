# Backend Server-Side Write Patterns

## Overview

Production RLS policies enforce strict user isolation. To perform privileged operations (like awarding mining rewards, admin actions, or batch updates), you must use the **service role key** in your backend code.

## Key Concepts

### Client-Side Operations (Anon/Authenticated Key)
- ✅ **Allowed:** Read own player profile, view leaderboards
- ✅ **Allowed:** Update own player data (last_login, username)
- ✅ **Allowed:** Manage own pending_actions
- ❌ **Blocked:** Read/write other users' data
- ❌ **Blocked:** Hard delete players

### Server-Side Operations (Service Role Key)
- ✅ **Bypasses RLS:** Can read/write all data
- ✅ **Privileged operations:** Award rewards, admin updates, batch processing
- ⚠️ **Security:** Never expose this key to the client

## Implementation Examples

### 1. Next.js API Route Setup

Create a server-only Supabase client:

```typescript
// lib/supabase-admin.ts
import { createClient } from '@supabase/supabase-js';

// NEVER import this in client components!
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Server-side only!
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);
```

### 2. Award Mining Rewards (Backend-Only)

```typescript
// app/api/mining/claim-rewards/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  // 1. Verify the user is authenticated (using anon key)
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Create client to verify user
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // 2. Parse request body
  const { resources_mined } = await request.json();

  // 3. Validate input
  if (!resources_mined || resources_mined <= 0 || resources_mined > 1000) {
    return NextResponse.json({ error: 'Invalid resources amount' }, { status: 400 });
  }

  // 4. Use admin client to update player data (bypasses RLS)
  const { data, error } = await supabaseAdmin
    .from('players')
    .update({
      total_resources_mined: supabaseAdmin.sql`total_resources_mined + ${resources_mined}`,
      total_ocx_earned: supabaseAdmin.sql`total_ocx_earned + ${resources_mined * 10}`,
      last_login: new Date().toISOString()
    })
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Mining reward error:', error);
    return NextResponse.json({ error: 'Failed to claim rewards' }, { status: 500 });
  }

  return NextResponse.json({ 
    success: true,
    player: data
  });
}
```

### 3. Submarine Upgrade (Client + Server Pattern)

Client-side component:

```typescript
// components/submarine-upgrade-button.tsx
'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

export function SubmarineUpgradeButton() {
  const [loading, setLoading] = useState(false);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleUpgrade() {
    setLoading(true);
    
    // Get current user's session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      alert('Please sign in first');
      setLoading(false);
      return;
    }

    // Call backend API (not direct DB update)
    const response = await fetch('/api/submarine/upgrade', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ target_tier: 2 })
    });

    const result = await response.json();
    
    if (result.success) {
      alert('Submarine upgraded!');
    } else {
      alert(result.error);
    }
    
    setLoading(false);
  }

  return (
    <button onClick={handleUpgrade} disabled={loading}>
      {loading ? 'Upgrading...' : 'Upgrade Submarine'}
    </button>
  );
}
```

Backend API route:

```typescript
// app/api/submarine/upgrade/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@supabase/supabase-js';

const UPGRADE_COSTS = {
  1: 0,
  2: 1000,
  3: 5000,
  4: 20000
};

export async function POST(request: NextRequest) {
  // 1. Verify authentication
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // 2. Parse and validate request
  const { target_tier } = await request.json();
  
  if (!target_tier || target_tier < 2 || target_tier > 4) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }

  // 3. Get current player state (using admin to bypass RLS for verification)
  const { data: player, error: fetchError } = await supabaseAdmin
    .from('players')
    .select('submarine_tier, total_resources_mined')
    .eq('user_id', user.id)
    .single();

  if (fetchError || !player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  // 4. Validate upgrade logic
  if (player.submarine_tier >= target_tier) {
    return NextResponse.json({ error: 'Already at or above target tier' }, { status: 400 });
  }

  const cost = UPGRADE_COSTS[target_tier as keyof typeof UPGRADE_COSTS];
  
  if (player.total_resources_mined < cost) {
    return NextResponse.json({ 
      error: 'Insufficient resources',
      required: cost,
      current: player.total_resources_mined
    }, { status: 400 });
  }

  // 5. Perform upgrade (using admin client)
  const { data, error } = await supabaseAdmin
    .from('players')
    .update({
      submarine_tier: target_tier,
      total_resources_mined: player.total_resources_mined - cost
    })
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Upgrade error:', error);
    return NextResponse.json({ error: 'Failed to upgrade' }, { status: 500 });
  }

  return NextResponse.json({ 
    success: true,
    player: data
  });
}
```

### 4. Admin Operations

```typescript
// app/api/admin/reset-player/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  // 1. Verify admin access (implement your own admin check)
  const adminKey = request.headers.get('x-admin-key');
  
  if (adminKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 2. Parse request
  const { user_id } = await request.json();

  // 3. Reset player (admin bypasses RLS)
  const { data, error } = await supabaseAdmin
    .from('players')
    .update({
      submarine_tier: 1,
      total_resources_mined: 0,
      total_ocx_earned: 0,
      is_active: true
    })
    .eq('user_id', user_id)
    .select()
    .single();

  if (error) {
    console.error('Reset error:', error);
    return NextResponse.json({ error: 'Failed to reset' }, { status: 500 });
  }

  return NextResponse.json({ 
    success: true,
    player: data
  });
}
```

## Security Checklist

- [ ] Service role key stored in `.env.local` (never `.env` or client code)
- [ ] Server-only imports (`lib/supabase-admin.ts`) never imported in client components
- [ ] All API routes validate user authentication before processing
- [ ] All inputs validated and sanitized
- [ ] Privileged operations logged for audit trail
- [ ] Rate limiting implemented on sensitive endpoints
- [ ] Error messages don't leak sensitive data

## Environment Variables

```bash
# .env.local (server-side only)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
ADMIN_API_KEY=your-admin-key-here

# .env (can be exposed to client)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## Testing Server-Side Logic

```typescript
// __tests__/api/mining/claim-rewards.test.ts
import { POST } from '@/app/api/mining/claim-rewards/route';
import { supabaseAdmin } from '@/lib/supabase-admin';

describe('POST /api/mining/claim-rewards', () => {
  it('should award rewards to authenticated user', async () => {
    // Mock request
    const request = new Request('http://localhost:3000/api/mining/claim-rewards', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer mock-token'
      },
      body: JSON.stringify({ resources_mined: 100 })
    });

    // Call route
    const response = await POST(request);
    const result = await response.json();

    // Assert
    expect(result.success).toBe(true);
    expect(result.player.total_resources_mined).toBeGreaterThan(0);
  });

  it('should reject unauthenticated requests', async () => {
    const request = new Request('http://localhost:3000/api/mining/claim-rewards', {
      method: 'POST',
      body: JSON.stringify({ resources_mined: 100 })
    });

    const response = await POST(request);
    
    expect(response.status).toBe(401);
  });
});
```

## Migration Path

If you have existing client-side write logic:

1. **Identify all direct DB writes** in client components
2. **Create API routes** for each operation
3. **Move validation logic** to the server
4. **Update client code** to call API routes instead of direct DB
5. **Test with production RLS policies** to ensure proper isolation

## Common Pitfalls

❌ **Don't:** Use service role key in client components
❌ **Don't:** Trust client-provided data without validation
❌ **Don't:** Expose internal error details to clients
❌ **Don't:** Skip authentication checks in API routes

✅ **Do:** Always verify user identity in API routes
✅ **Do:** Validate and sanitize all inputs
✅ **Do:** Use transactions for multi-step operations
✅ **Do:** Log privileged operations for auditing
