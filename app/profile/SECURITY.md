# 🔒 Profile Page Security Implementation

## Overview

The `/profile` page is now **ONLY accessible** from the User Home page through a secure token-based authentication system. Direct URL access is blocked.

## 🛡️ How It Works

### 1. Token Generation (User Home Page)
When a user clicks the "View Profile" button:
1. The `useProfileNavigation` hook is triggered
2. A POST request is sent to `/api/profile/generate-token`
3. Server validates the user exists in the database
4. Server generates a secure HMAC-signed token (valid for 5 minutes)
5. Token is returned to the client

### 2. Secure Navigation
1. User is redirected to `/profile?wallet=ADDRESS&token=TOKEN`
2. Token is included in the URL as a query parameter
3. Navigation happens only after successful token generation

### 3. Token Validation (Profile Page)
When the profile page loads:
1. Server extracts `wallet` and `token` from URL parameters
2. Server verifies token signature using HMAC-SHA256
3. Server checks token expiration (must be < 5 minutes old)
4. Server verifies wallet address in token matches URL wallet
5. If any validation fails → redirect to `/home`
6. If validation succeeds → display profile data

## 🔐 Security Features

### ✅ Token-Based Access Control
- **No direct URL access**: Users cannot bookmark or share profile URLs
- **Time-limited tokens**: Tokens expire after 5 minutes
- **Single-use intention**: Each navigation generates a new token
- **HMAC signature**: Tokens are cryptographically signed and cannot be forged

### ✅ Server-Side Validation
- **All checks happen on server**: Client cannot bypass validation
- **Database verification**: User must exist in Supabase
- **Wallet matching**: Token wallet must match URL wallet
- **Signature verification**: Token must have valid HMAC signature

### ✅ Protection Against Attacks
- **Token tampering**: HMAC signature prevents modification
- **Replay attacks**: Short expiration limits token reuse
- **URL sharing**: Tokens expire, making shared URLs useless
- **Direct access**: Missing token redirects to home
- **Mismatched data**: Wallet/token mismatch blocks access

## 📁 File Structure

```
lib/
├── profile-access-token.ts    # Token generation and verification
└── profile-navigation.ts       # Navigation hook and utilities

app/
├── profile/
│   └── page.tsx               # Protected profile page
└── api/
    └── profile/
        └── generate-token/
            └── route.ts       # Token generation API

components/
└── user-home.tsx              # Secure navigation button
```

## 🔧 Implementation Details

### Token Structure

```typescript
interface ProfileAccessToken {
  walletAddress: string  // User's wallet address
  userId: string        // User's database ID
  timestamp: number     // Token creation time
  expiresAt: number    // Token expiration time (5 min)
}
```

### Token Format

```
BASE64_PAYLOAD.HMAC_SIGNATURE
```

Example:
```
eyJ3YWxsZXRBZGRyZXNzIjoiMHgxMjM0Li4uIn0=.a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2
```

### HMAC Signing Process

```typescript
// 1. Create payload
const payload = JSON.stringify({
  walletAddress: "0x1234...",
  userId: "uuid-...",
  timestamp: 1729234567000,
  expiresAt: 1729234867000
})

// 2. Generate signature
const signature = crypto
  .createHmac("sha256", SECRET_KEY)
  .update(payload)
  .digest("hex")

// 3. Combine into token
const token = base64(payload) + "." + signature
```

## 🚀 Usage

### From User Home Component

```tsx
import { useProfileNavigation } from "@/lib/profile-navigation"

function UserHome({ playerData }) {
  const { navigateToProfile, isNavigating } = useProfileNavigation()

  return (
    <button
      onClick={() => navigateToProfile(
        playerData.wallet_address,
        playerData.user_id
      )}
      disabled={isNavigating}
    >
      {isNavigating ? "Loading..." : "View Profile"}
    </button>
  )
}
```

### Navigation Flow

```
User clicks "View Profile"
        ↓
Generate token via API
        ↓
POST /api/profile/generate-token
{
  walletAddress: "0x1234...",
  userId: "uuid-..."
}
        ↓
Server validates user exists
        ↓
Server generates signed token
        ↓
Token returned to client
        ↓
Navigate to /profile?wallet=0x1234...&token=abc123...
        ↓
Profile page validates token
        ↓
✅ Display profile data
```

## 🔒 Security Best Practices

### ✅ Implemented
- [x] Token expiration (5 minutes)
- [x] HMAC signature verification
- [x] Server-side validation only
- [x] Database user verification
- [x] Wallet address matching
- [x] Redirect on invalid access
- [x] Loading states during navigation
- [x] Error handling for failed generation

### 🔜 Recommended Enhancements
- [ ] Add rate limiting on token generation API
- [ ] Log failed access attempts
- [ ] Add token revocation system
- [ ] Implement refresh token mechanism
- [ ] Add IP address validation (optional)
- [ ] Monitor for suspicious patterns

## ⚙️ Configuration

### Environment Variables

Add to `.env.local`:

```bash
# Profile Access Secret (REQUIRED)
# Use a strong, random string in production
PROFILE_ACCESS_SECRET=your-super-secret-key-change-this-in-production
```

### Generate a Secure Secret

```bash
# Generate a random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🧪 Testing

### Valid Access Flow
1. Navigate to user home page
2. Click "View Profile" button
3. Wait for token generation (< 1 second)
4. Profile page should load successfully
5. All data should display correctly

### Invalid Access Attempts

#### Test 1: Direct URL Access
```
Navigate to: http://localhost:3000/profile?wallet=0x1234...
Expected: Redirect to /home with error log
```

#### Test 2: Missing Token
```
Navigate to: http://localhost:3000/profile
Expected: Redirect to /home with error log
```

#### Test 3: Invalid Token
```
Navigate to: http://localhost:3000/profile?wallet=0x1234...&token=fake
Expected: Redirect to /home with error log
```

#### Test 4: Expired Token
```
1. Generate token
2. Wait 6+ minutes
3. Try to use token
Expected: Redirect to /home with "expired" error
```

#### Test 5: Mismatched Wallet
```
Navigate to: /profile?wallet=0x5678...&token=<token_for_0x1234>
Expected: Redirect to /home with "mismatch" error
```

## 📊 Monitoring

### Server Logs

```typescript
// Success
✅ [ProfileToken] Generated token for wallet: 0x1234...
✅ [Profile] Access granted for wallet: 0x1234...

// Failures
❌ [Profile] Access denied: Missing token or wallet address
❌ [Profile] Access denied: Invalid or expired token
❌ [Profile] Access denied: Wallet address mismatch
❌ [ProfileToken] Player not found
```

### Metrics to Track
- Token generation success rate
- Token validation success rate
- Failed access attempts per hour
- Average token generation time
- Token expiration rate

## 🐛 Troubleshooting

### Issue: "Access denied: Missing token"
**Cause**: User navigated directly to profile URL
**Solution**: Users must access profile via User Home button

### Issue: "Access denied: Invalid token"
**Cause**: Token signature verification failed
**Solution**: Check `PROFILE_ACCESS_SECRET` is set correctly

### Issue: "Access denied: Expired token"
**Cause**: Token older than 5 minutes
**Solution**: Generate new token by clicking profile button again

### Issue: Token generation fails
**Cause**: Database connection or missing user
**Solution**: 
1. Check Supabase connection
2. Verify user exists in database
3. Check API route logs

### Issue: "Player not found" error
**Cause**: User doesn't exist in database
**Solution**: User must complete onboarding/wallet connection

## 🔄 Token Lifecycle

```
Creation (User Home)
      ↓
  Valid (0-5 min)
      ↓
  Expiration (5 min)
      ↓
   Unusable
```

### Token States
- **Created**: Just generated, ready to use
- **Valid**: Within 5-minute window
- **Expired**: Older than 5 minutes
- **Invalid**: Failed signature verification
- **Revoked**: (Future feature)

## 📝 API Documentation

### POST /api/profile/generate-token

**Request Body:**
```json
{
  "walletAddress": "0x1234567890abcdef...",
  "userId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Success Response (200):**
```json
{
  "token": "eyJ3YWxsZXRBZGRyZXNzIjoiMHgxMjM0Li4uIn0=.a7b8c9d0e1f2...",
  "expiresIn": 300
}
```

**Error Responses:**

400 Bad Request:
```json
{
  "error": "Missing wallet address or user ID"
}
```

404 Not Found:
```json
{
  "error": "Player not found"
}
```

500 Internal Server Error:
```json
{
  "error": "Failed to generate access token"
}
```

## 🎯 Summary

The profile page is now fully secured with:

✅ **Token-based authentication**
✅ **Time-limited access (5 minutes)**
✅ **HMAC signature verification**
✅ **Server-side validation only**
✅ **Protection against direct URL access**
✅ **Database verification**
✅ **Comprehensive error handling**

Users can **ONLY** access their profile by clicking the button in the User Home page. All other access methods are blocked and redirect to the home page.

---

**Security Level**: 🔒🔒🔒🔒🔒 (High)
**Last Updated**: October 18, 2025
**Version**: 2.0.0
