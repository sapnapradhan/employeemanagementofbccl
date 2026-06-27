## Goal
1. Sign-ups go into a **pending** state and can't access the employee area until an admin approves them.
2. Once approved, the user automatically shows up in the admin's **All Employees** list (and dashboard counts/charts).
3. Admin UI is untouched visually — same pages, same layout. Only the data source for the admin table is extended to merge in approved cloud users.

## User flow

1. User signs up on `index.html` (Employee tab) → Lovable Cloud account created.
2. Right after sign-up, a row is inserted into `employee_profiles` with `status='pending'` (RLS already allows `auth.uid() = user_id` inserts).
3. User is redirected to a new **`pending-approval.html`** page showing "Awaiting admin approval", auto-polling every 15s, with a Sign out button.
4. On any sign-in, status is checked:
   - `pending` → `pending-approval.html`
   - `approved` → `my-profile.html` (existing flow)
5. Approval happens in the backend (Users / Table editor) by flipping `status` to `approved`. No admin UI changes, as you asked.

## Admin "All Employees" merge

The admin table today reads from local storage only. We'll extend `view-employee.html` so it also fetches **approved** cloud profiles and merges them into the same table — same columns, same styling, same search/pagination. Admin pages stay visually identical.

- `employee.js` `initTable()` will:
  - Load local employees as today.
  - Also call a small helper that runs `SUPA.from('employee_profiles').select('*').eq('status','approved')`.
  - Map each cloud row to the same shape used in the table (`employeeId`, `name`, `department`, `designation`, `salary`, `phone`, `email`, `photo` — photo via signed URL from the `employee-photos` bucket).
  - Merge + dedupe and render.
- Approved cloud users are **read-only** in the admin table (edit/delete icons hidden for them) to keep "admin side unchanged" — admin keeps full control over local entries only. If you'd rather admin can also edit/delete cloud users, say so and I'll wire that in.
- Dashboard counts/charts (`dashboard.js`) get the same merge so totals reflect approved cloud users too.

### RLS requirement

For the admin (signed in as the local `admin` / `admin123` account, which is **not** a Cloud auth user) to read all approved profiles, we need a public read path:

- Add an RLS policy: `SELECT` on `employee_profiles` `TO anon` `USING (status = 'approved')`.
- Grant `SELECT` on `employee_profiles` to `anon`.
- This exposes only approved rows' columns publicly. If that's not acceptable, the alternative is to make the admin a real Cloud user with the `admin` role (which already has a "view all" policy). Tell me which you prefer; default in this plan is the anon-read policy scoped to `status='approved'`.

Photos in the `employee-photos` bucket stay private; admin gets short-lived signed URLs via the anon client.

## Files

**New**
- `public/ems/pending-approval.html`
- `public/ems/js/pending.js`

**Edited (employee/user side)**
- `public/ems/js/login.js` — insert pending profile after signup; route by status on signin and on auto-redirect.
- `public/ems/js/user-layout.js` / `my-profile.js` — gate `my-profile.html` on `status='approved'`.
- `public/ems/css/style.css` — small styles for pending card.

**Edited (admin side, data only — no visual changes)**
- `public/ems/js/employee.js` — merge approved cloud profiles into `initTable()` render; hide edit/delete on cloud rows.
- `public/ems/js/dashboard.js` — include approved cloud profiles in counts/charts.
- Include `<script src="js/supa.js">` (and the Supabase UMD) on `view-employee.html` and `dashboard.html` so the admin pages can read the cloud.

**Database (migration)**
- Add anon SELECT policy on `employee_profiles` limited to `status='approved'` + `GRANT SELECT ... TO anon`.
- (No schema change — `status` and `approved_at` already exist.)

## Out of scope
- Admin in-app "Pending requests" screen (you said don't change admin UI).
- Email on approval.
- Rejection workflow.

Confirm and I'll build it.
