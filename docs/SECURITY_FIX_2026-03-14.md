# Security Fix Log — 2026-03-14

**Author:** Bolt (Dev Agent)  
**Date:** March 14, 2026  
**Context:** Pre-payment integration security hardening  
**Priority:** CRITICAL — all issues below block Stripe integration

---

## Summary

Four critical security issues identified and fixed. All changes are surgical — no unrelated code touched.

---

## Fix 1: RLS Missing/Broken on 5 Tables

**Severity:** 🔴 CRITICAL  
**File:** `database/migrations/011_fix_rls_missing_tables.sql` (NEW)

### Problems fixed:

| Table | Issue | Fix |
|-------|-------|-----|
| `market_alerts` | RLS completely disabled — any user could read/write/delete market alert records via Supabase REST API | Enable RLS; public SELECT, service_role-only writes |
| `alert_subscriptions` | RLS completely disabled — any user could read ALL users' alert preferences | Enable RLS; users can only access own row |
| `activity_log` | RLS enabled but `USING (true)` policy — any authenticated user could SELECT all audit logs including other users' activity | Replace with service_role-only reads + users can see own entries |
| `sent_emails` | RLS enabled but `USING (true)` policy — any authenticated user could read all email campaign history | Replace with service_role-only (admin table, no user access) |
| `feedback` | INSERT policy existed but no SELECT restriction — any user could read all feedback including other users' reports | Add service_role-only SELECT/UPDATE/DELETE |

### How to apply:
Run `database/migrations/011_fix_rls_missing_tables.sql` in the Supabase SQL Editor.

---

## Fix 2: Tier Field Payment Bypass

**Severity:** 🔴 CRITICAL (payment bypass)  
**Files modified:**
- `database/migrations/011_fix_rls_missing_tables.sql` (Section 6)
- `backend/routes/auth.js` (PUT /api/auth/me)
- `backend/services/authService.js` (upsertProfile JSDoc)

### Problem:
The `user_profiles` table's `UPDATE` RLS policy (`auth.uid() = id`) let any authenticated user update any column in their own profile row via Supabase REST API — including the `tier` field:

```http
PATCH /rest/v1/user_profiles?id=eq.<user-uuid>
Authorization: Bearer <valid-token>
Content-Type: application/json

{"tier": "pro"}
```

This silently upgraded the user to Pro without payment.

### Fixes applied (3 layers, defense-in-depth):

**Layer A — Database column privilege revocation:**
```sql
REVOKE UPDATE (tier) ON public.user_profiles FROM anon;
REVOKE UPDATE (tier) ON public.user_profiles FROM authenticated;
```
Removes the column-level UPDATE privilege for `tier` from all non-superuser roles.

**Layer B — BEFORE UPDATE trigger:**
```sql
CREATE TRIGGER guard_tier_update
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_tier_update_by_user();
```
Raises an exception if any non-service_role session tries to change the `tier` field.

**Layer C — API endpoint guard:**
`PUT /api/auth/me` now explicitly checks for `tier` in the request body and returns `403 Forbidden` if present. Previously, `tier` was silently ignored (not in destructure), but the explicit rejection makes the policy clear and surfaceable.

### Tier can still be updated by (trusted callers only):
- Stripe webhook handler (uses service_role connection)
- Admin API (uses service_role connection)
- Backend signup flow (hardcodes `tier: 'free'` — correct)

---

## Fix 3: PATCH /api/alerts/read Missing Auth

**Severity:** 🟡 IMPORTANT (authentication bypass)  
**File modified:** `backend/routes/alerts.js`

### Problem:
```js
// Before — no auth:
router.patch('/read', async (req, res) => {
```

`PATCH /api/alerts/read` had no authentication middleware. Any unauthenticated request could mark arbitrary alert IDs as read, potentially allowing:
- Mass read-state manipulation (spam marking everything as read)
- Denial of service on alert notification badges
- Information confirmation (knowing which IDs exist)

### Fix:
```js
// After — requires valid JWT:
router.patch('/read', requireAuth, async (req, res) => {
```

Added `requireAuth` middleware (the same used by `/subscribe` and `/subscription` on the same router). `requireAuth` is already imported and defined in the file.

---

## Fix 4: authService.js Singleton Session Bleeding

**Severity:** 🔴 CRITICAL (user data cross-contamination)  
**File modified:** `backend/services/authService.js`

### Problem:
`signOut()` and `updatePassword()` called `setSession()` on the shared singleton Supabase client:

```js
// BEFORE — mutates global client state:
async function signOut(accessToken) {
  const supabase = getClient();  // shared singleton
  await supabase.auth.setSession({ access_token: accessToken, ... });
  // ⚠️ All subsequent requests on this client are now authed as this user!
  await supabase.auth.signOut();
}
```

Under concurrent load:
- Request A calls `setSession(tokenA)` → signs out UserA
- Request B calls `setSession(tokenB)` → BUT Request A's sign-out now runs against UserB's session
- Race condition causes one user to inadvertently sign out another user
- Same race in `updatePassword()` could change the wrong user's password

### Fix:
Both functions now create a **fresh per-request Supabase client** with the user's token scoped via `Authorization` header (same pattern already used in `userData.js`):

```js
// AFTER — fresh client per request, no shared state mutation:
async function signOut(accessToken) {
  const scopedClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { error } = await scopedClient.auth.signOut();
  return { error };
}
```

The shared singleton (`getClient()`) is still used for stateless operations (`signUp`, `signIn`, `getUser`, `resetPassword`, `refreshSession`) where no session state is set — those are safe.

---

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `database/migrations/011_fix_rls_missing_tables.sql` | **NEW** | RLS fixes for 5 tables + tier protection trigger |
| `backend/routes/alerts.js` | Modified | Added `requireAuth` to `PATCH /read` |
| `backend/services/authService.js` | Modified | Fixed `signOut` + `updatePassword` session bleeding |
| `backend/routes/auth.js` | Modified | Added `tier` update guard in `PUT /me` |

---

## Deployment Checklist

- [ ] Run `database/migrations/011_fix_rls_missing_tables.sql` in Supabase SQL Editor
- [ ] Verify `current_user_id()` function exists (from migration 010) — required by alert_subscriptions policies
- [ ] Deploy updated backend code
- [ ] Test: User cannot change `tier` via REST API
- [ ] Test: `PATCH /api/alerts/read` returns 401 without token
- [ ] Test: Concurrent sign-out/password-change requests don't bleed sessions
- [ ] Test: Users can only see their own alert subscriptions
