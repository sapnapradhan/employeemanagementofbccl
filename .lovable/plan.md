## Two bugs to fix

### 1. "duplicate key value violates unique constraint employee_profiles_user_id_key"
The save handler decides INSERT vs UPDATE from an in-memory `currentRow` variable. On a fresh page load where the row already exists but `loadProfile()` hasn't finished (or the user saves before the state syncs), it tries INSERT against a `user_id` that already has a row → unique violation.

**Fix:** Replace the insert/update branching in `public/ems/js/my-profile.js` with a single `upsert(payload, { onConflict: 'user_id' })`. This makes save idempotent and removes the race entirely.

### 2. "permission denied for function has_role" when deleting
The RLS policy `Admins can view all employee profiles` calls `public.has_role(...)`. Postgres evaluates that policy for every authenticated query (including DELETE), but the `authenticated` role was never granted EXECUTE on `public.has_role`, so the whole statement fails.

**Fix (migration):**
```sql
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon;
```

### Files changed
- `supabase/migrations/<new>.sql` — grant EXECUTE on `has_role`.
- `public/ems/js/my-profile.js` — switch save to `upsert` on `user_id`; remove the insert/update branch.

No UI or schema changes beyond the grant.
