# BCCL EMS — Phase 1 Refactor Plan (Revised)

Scope: approval workflow, notifications, PAN/Aadhaar, admin management, bulk Form 16, security hardening. **Not in this phase:** Attendance, Leave, Salary, Reports, dashboard redesign — those belong to Phase 2.

Guiding rule for this pass: **build new before deleting old.** Every legacy page and helper survives until its Supabase-backed replacement is wired, navigated to, and verified. Nothing gets removed as a side effect.

---

## 1. Remove "Claim Admin" and self-promotion (immediate)

- DB migration: `DROP FUNCTION claim_admin_if_none`, `DROP FUNCTION employee_profile_resubmit` + its trigger.
- `public/ems/index.html`: remove the "Claim admin" link and helper copy.
- `js/login.js`: remove the `claimAdminLink` handler and every "Sign in first…" / "No admin exists yet" string.
- No UI ever grants admin. Additional admins are created only via a direct `insert into public.user_roles` by an existing admin (documented in README).

## 2. Permanent admin account (dev)

- You sign up `admin@bccl.com` / `admin123` once from the login page.
- Migration adds `grant_bccl_admin_on_signup()` trigger on `auth.users`: whenever the new email is `admin@bccl.com`, inserts `('admin')` into `user_roles` (idempotent). Also backfills the role now if the account already exists.
- Credentials live in one place: a single `config.js` constant `BCCL_ADMIN_EMAIL = "admin@bccl.com"` used only for pre-filling the login form placeholder — never hardcoded across multiple JS files, never used for auth logic.
- Login label: the admin tab accepts either `admin` (auto-expanded to `admin@bccl.com`) or the full email. Password is entered normally; Supabase Auth is the sole verifier.
- README documents: change this password immediately in production, remove the default, rely on DB-granted admins only.

## 3. Role-based auth guards (Supabase-only, no LocalStorage fallback)

- `layout.js` (admin pages): `await supabase.auth.getUser()` then `supabase.rpc('is_admin')`. Fail → redirect to `/ems/index.html`.
- `user-layout.js` (employee pages): require session; if `is_admin` is true, redirect to `dashboard.html`.
- URL-typing bypass is impossible — every page verifies via the server RPC before rendering.
- Admin sidebar (Phase 1): Dashboard, Employees, Approvals, PAN/Aadhaar Verification, Form 16, Notifications.
- Employee sidebar (Phase 1): My Profile, My Documents, Form 16, Notifications.

## 4. Do NOT delete `storage.js` — trim it

Keep the file; strip only legacy CRUD and auth:

- **Remove:** `EMS.all`, `add`, `update`, `remove`, `nextId`, `commitId`, `seedIfEmpty`, `login`, `logout`, `isAuthed`, `requireAuth`, and the LocalStorage seed samples/keys tied to them.
- **Keep:** `EMS.toast`, `applyTheme`, `setTheme`, `getTheme`, `inr`, `initial`, and any other pure UI/format helper. All pages continue to import `storage.js` unchanged.
- The file may be renamed later, but not in this phase.

## 5. Do NOT delete legacy admin pages yet

`add-employee.html`, `view-employee.html`, `js/employee.js` stay on disk and functional throughout Phase 1.

Migration order:

1. Build the new Supabase-backed screens (§6) alongside the legacy ones.
2. Point every sidebar/menu link at the new screens.
3. Manually verify the new screens end-to-end.
4. Only in a **follow-up cleanup pass at the very end of Phase 1** (after everything else is green) do we remove the three legacy files. If anything breaks, the legacy pages remain a working fallback.

## 6. New Supabase-backed admin Employee Management

- `admin-employees.html` + `js/admin-employees.js` — paginated, searchable table backed by `employee_profiles`. Columns: photo, code, name, department, designation, status pill, actions.
- `admin-employee-edit.html` + `js/admin-employee-edit.js` — full form. Admin edits write directly to `employee_profiles` (bypasses approval) and emit an `admin_edit` notification to the employee.
- Both pages call the same `is_admin` guard as everything else.

## 7. Profile approval workflow

RLS on `employee_profiles`:

- Employee: `SELECT` own row; `INSERT` own row once (initial creation). **No UPDATE** — employees cannot write directly.
- Admin: full CRUD.

New table `profile_change_requests`:

```
id, user_id, submitted_at, status ('pending'|'approved'|'rejected'),
reviewed_by, reviewed_at, rejection_reason,
changes jsonb,      -- { field: { old, new } }
file_moves jsonb    -- [{ field, from_path, to_path }]
```

Protected fields (route through approval): name, father_name, phone, address, department, designation, pan_number, aadhaar_number, bank_name, account_number, ifsc, photo_url, pan_front_url, aadhaar_front_url, aadhaar_back_url, emergency_contact_name, emergency_contact_phone.

Non-protected (admin-only writable, read-only for employee): dob, email, salary, employee_code, status.

Employee "Save" on `my-profile.html`:

1. Diffs form vs. current row.
2. File inputs upload to `pending/<user_id>/<field>-<uuid>.<ext>`.
3. Inserts one row into `profile_change_requests` with the diff and staged file paths.
4. Locks the form and shows an orange "Pending approval" banner until resolved.

Admin RPCs (SECURITY DEFINER, `is_admin` guarded):

- `approve_change_request(req_id)` — applies the diff, promotes staged files to final paths, emits `profile_approved` notification.
- `reject_change_request(req_id, reason)` — records reason, deletes staged files, emits `profile_rejected` notification.

## 8. Pending Requests module

Rebuild `approvals.html` + `js/approvals.js`. Columns: Employee, Field(s) Changed, Old, New, Submitted, Status pill (green/orange/red). Filters: All / Pending / Approved / Rejected. Row actions: View Details modal (all fields + photo previews), Approve, Reject (dialog requires reason ≥ 5 chars).

## 9. Notifications

New table `notifications` (id, user_id, title, body, type, related_id, read_at, created_at). RLS: user reads/updates own; admin can insert for any user; SECURITY DEFINER functions insert directly.

Phase 1 emitted types: `profile_approved`, `profile_rejected`, `pan_verified`, `aadhaar_verified`, `form16_uploaded`, `admin_edit`.

New `notifications.html` + `js/notifications.js` — list with unread badges, "Mark all as read", type filter.

Shared `js/notify.js` — bell icon with unread count in both topbars, polled every 15 s.

## 10. PAN & Aadhaar (Documents)

Columns added to `employee_profiles`: `pan_number`, `aadhaar_number`, `pan_front_url`, `aadhaar_front_url`, `aadhaar_back_url`, `pan_verified_at`, `aadhaar_verified_at`, `pan_verified_by`, `aadhaar_verified_by`, plus `bank_name`, `account_number`, `ifsc`, `emergency_contact_name`, `emergency_contact_phone`, `deleted_at`.

Unique index on `pan_number` (partial, where not null) — enforces one employee per PAN, which powers the bulk Form 16 safety check.

New private bucket `employee-documents`. RLS: users read/write only under `<their uid>/…`; admins read/write everything.

- `my-documents.html` + `js/my-documents.js` — employees upload PAN Front, Aadhaar Front, Aadhaar Back and edit PAN/Aadhaar numbers. All changes go through `profile_change_requests`. Values render masked only:
  - PAN → `******234F`
  - Aadhaar → `XXXX XXXX 9012`
  Masking is done client-side via `js/masking.js`, and an `employee_self_view` DB view returns already-masked strings so raw values never traverse the network to employees.
- `admin-documents.html` + `js/admin-documents.js` — verification queue: full unmasked values, signed-URL image previews, per-doc Verify / Reject buttons stamping `*_verified_at` and emitting notifications.

## 11. Form 16 — preserve everything, add bulk upload

Untouched: `form16.html`, `my-form16.html`, `admin-form16.html`, `js/form16.js`, `js/my-form16.js`, `js/admin-form16.js`, the `form16_documents` table, the `form16-documents` bucket. Single-file upload and auto-generation keep working exactly as they do today.

Additive: a **Bulk Upload** panel on `admin-form16.html` with drag-and-drop for multiple PDFs.

Strict safety rules (per your revision):

- Filename must equal PAN + `.pdf` and match `^[A-Z]{5}[0-9]{4}[A-Z]\.pdf$`. Invalid filenames → rejected with reason.
- File type must be `application/pdf`, size ≤ configurable limit (default 10 MB).
- For each valid file, call admin RPC `bulk_form16_lookup(pan)` which returns:
  - `matched` — exactly one employee: upload proceeds to `form16-documents/<user_id>/<financial_year>/<PAN>.pdf`, upserts `form16_documents` (unique on `(user_id, financial_year)`), emits `form16_uploaded` notification.
  - `unmatched` — zero employees: file listed under **Unmatched Files** with a manual-assign dropdown (does not upload).
  - `duplicate` — more than one employee shares the PAN: file listed under **Duplicate PAN Errors**, upload **blocked** — never auto-attached, admin must resolve the duplicate PAN before the file can be processed. (In practice the new unique index prevents this state going forward, but the RPC still checks defensively for any pre-existing duplicates.)
- Financial Year is one dropdown applied to the whole batch.
- If a Form 16 already exists for `(user_id, FY)`: per-row Replace / Skip / Keep Both (versioned filename with timestamp), plus an "Apply to all duplicates" checkbox.
- Progress dashboard: Total, Matched, Unmatched, Duplicate PAN, Failed, plus a per-file progress bar.

Security: private bucket unchanged. Uploads happen through a `bulk_form16_upload_finalize(pan, financial_year, storage_path)` admin RPC that re-checks `is_admin` and re-verifies the PAN → single-employee mapping before inserting the `form16_documents` row.

## 12. Dashboard — additive only

Keep existing charts and KPIs. Add four widgets to `dashboard.html`:

- Pending Profile Requests
- Pending PAN Verifications
- Pending Aadhaar Verifications
- Recent Notifications (last 10)

No redesign in this phase.

## 13. UI/UX

- Keep glassmorphism and BCCL branding.
- Status pills: `.pill--approved` green, `.pill--pending` orange, `.pill--rejected` red.
- Consistent confirmation modal, toast on every mutation, empty states, skeleton rows during load, fade-in on route content.
- Bell icon with unread badge in both topbars.

## 14. Cleanup at the end of Phase 1 (last step, gated on verification)

Only after the new screens are confirmed working end-to-end:

- Delete `add-employee.html`, `view-employee.html`, `js/employee.js`.
- Remove any CSS rules exclusive to those pages.
- Leave `storage.js` in place (trimmed per §4).

---

## Technical section

### Single migration outline

```sql
-- 1. Drop legacy
drop trigger if exists trg_employee_profile_resubmit on public.employee_profiles;
drop function if exists public.employee_profile_resubmit();
drop function if exists public.claim_admin_if_none();

-- 2. Extend employee_profiles
alter table public.employee_profiles
  add column if not exists pan_number text,
  add column if not exists aadhaar_number text,
  add column if not exists pan_front_url text,
  add column if not exists aadhaar_front_url text,
  add column if not exists aadhaar_back_url text,
  add column if not exists pan_verified_at timestamptz,
  add column if not exists aadhaar_verified_at timestamptz,
  add column if not exists pan_verified_by uuid,
  add column if not exists aadhaar_verified_by uuid,
  add column if not exists bank_name text,
  add column if not exists account_number text,
  add column if not exists ifsc text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists deleted_at timestamptz;

create unique index if not exists ux_employee_profiles_pan
  on public.employee_profiles(pan_number) where pan_number is not null;

-- 3. Lock down RLS: employees cannot UPDATE
drop policy if exists "users update own profile" on public.employee_profiles;
create policy "admin full access profiles" on public.employee_profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- 4. profile_change_requests + notifications tables
--    with GRANT to authenticated + service_role, RLS enabled, policies.

-- 5. Admin RPCs (SECURITY DEFINER, is_admin() guard):
--    approve_change_request, reject_change_request,
--    bulk_form16_lookup, bulk_form16_upload_finalize,
--    verify_pan, verify_aadhaar.

-- 6. employee_self_view (returns masked pan/aadhaar to employees).

-- 7. Admin seed trigger + backfill
create or replace function public.grant_bccl_admin_on_signup()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.email = 'admin@bccl.com' then
    insert into public.user_roles(user_id, role) values (new.id, 'admin')
    on conflict do nothing;
  end if;
  return new;
end $$;
create trigger on_auth_user_created_grant_bccl_admin
  after insert on auth.users
  for each row execute function public.grant_bccl_admin_on_signup();

insert into public.user_roles(user_id, role)
select id, 'admin' from auth.users where email='admin@bccl.com'
on conflict do nothing;
```

### Storage buckets

- Keep `employee-photos`, `form16-documents` (both private) unchanged.
- Add `employee-documents` (private) with per-user folder RLS + admin-all policy.

### File map

**New:** `admin-employees.html`, `admin-employee-edit.html`, `admin-documents.html`, `my-documents.html`, `notifications.html`, `js/admin-employees.js`, `js/admin-employee-edit.js`, `js/admin-documents.js`, `js/my-documents.js`, `js/notifications.js`, `js/notify.js`, `js/masking.js`, `js/config.js`.

**Edited:** `index.html`, `js/login.js`, `js/layout.js`, `js/user-layout.js`, `my-profile.html`, `js/my-profile.js`, `approvals.html`, `js/approvals.js`, `dashboard.html`, `js/dashboard.js`, `admin-form16.html`, `js/admin-form16.js`, `css/style.css`, `js/storage.js` (trimmed per §4), `README.md`.

**Kept until final cleanup step (§14):** `add-employee.html`, `view-employee.html`, `js/employee.js`.

**Untouched:** `form16.html`, `my-form16.html`, `js/form16.js`, `js/my-form16.js`, existing single-file Form 16 upload/generate.

The bulk uploader must identify employees solely by the PDF filename, where the filename (without the `.pdf` extension) is the employee's PAN number (e.g., `ABCDE1234F.pdf`). No manual employee selection should be required during upload.

### Out of scope (Phase 2)

Attendance, Leave, Salary, Reports, employee dashboard build-out, admin dashboard redesign, Form 16 version history, activity log, exports.