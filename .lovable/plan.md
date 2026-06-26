# Plan: Admin approval + full admin visibility over employee profiles

## What changes for the user

1. **Sign-up stays open**, but new profiles start as **Pending** and don't appear in the main employee directory until the admin approves them.
2. **Admin** keeps its own separate login (username + password, no Cloud auth). The demo hint "admin / admin123" is removed from the login screen. Username stays `admin`; password stays `admin123` under the hood unless you want a different one — tell me and I'll change it.
3. **Admin dashboard** now shows every user-submitted profile (with photo) alongside the local employees, and admin can **view, edit, approve, reject, and delete** any of them.
4. **User side**: after saving the profile, the user sees a "Pending approval" badge until admin approves it.

## Screens

- `index.html` — remove the "Admin demo — admin / admin123" hint line.
- `dashboard.html` — add a **Pending Approvals** card (count) + table section.
- `view-employee.html` — add a **Source** column (Local / Cloud) and a **Status** badge (Pending / Approved). Edit + Delete buttons work for Cloud profiles too.
- `add-employee.html` — unchanged (admin-created local employees are auto-approved).
- `my-profile.html` — show a status banner ("Pending admin approval" / "Approved").

## Data changes

Add two columns to `employee_profiles`:
- `status` — `'pending' | 'approved' | 'rejected'`, default `'pending'`.
- `approved_at` — timestamp, nullable.

RLS:
- Keep existing user-owns-own-row policies.
- Admin already has a SELECT-all policy via `has_role(auth.uid(),'admin')`. Add matching UPDATE-all and DELETE-all policies for admin.

Because admin sign-in is **local-only (sessionStorage)** and not a Supabase session, the admin browser has no `auth.uid()`. To let the local admin read/update/delete every profile without giving anon broad access, I'll add one server function `adminListProfiles` / `adminUpdateProfile` / `adminDeleteProfile` that:
- Verifies a shared `ADMIN_PASSWORD` secret sent from the admin page (matches the local admin password).
- Uses the service-role client to read/update/delete.

This keeps the existing local-admin model working without forcing you to migrate admin to Cloud auth. If you'd rather sign admin in via Cloud auth and use the `admin` role + RLS directly, say the word and I'll switch to that instead — it's cleaner long-term.

## Files touched

- `supabase/migrations/...` — add `status`, `approved_at`, admin UPDATE/DELETE policies.
- `src/lib/admin-profiles.functions.ts` — new server functions (list/update/delete/approve, password-gated).
- `public/ems/index.html` — remove demo credentials hint.
- `public/ems/js/login.js` — no behavior change beyond hint removal.
- `public/ems/js/dashboard.js` — fetch pending count from server fn, render pending card.
- `public/ems/js/employee.js` — merge Cloud profiles into the table, add Status column, wire approve/reject/edit/delete to admin server fns.
- `public/ems/view-employee.html` — column header + filter for Status.
- `public/ems/my-profile.html` + `my-profile.js` — show status banner.
- `public/ems/css/style.css` — badge styles for Pending / Approved / Rejected.

## Open question

Keep admin password as `admin123`, or change it? (It'll also become the `ADMIN_PASSWORD` secret the server fns check.)
