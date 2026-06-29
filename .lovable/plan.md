
## Goal

Add two linked features to the BCCL EMS portal: an admin approval workflow that locks employees out of editing until approved (with re-approval after every change), and a Form 16 system that supports both admin-uploaded PDFs and client-side auto-generated PDFs.

## 1. Database changes (migration)

`employee_profiles` already has `status` and `approved_at` — reuse them. Add:

- `rejection_reason text` on `employee_profiles`
- `submitted_at timestamptz` (set on insert / on every employee edit)
- New table `form16_documents`:
  - `id`, `user_id` (auth.users), `employee_profile_id` (fk), `financial_year text` (e.g. `2025-26`), `source text` ('uploaded' | 'generated'), `file_path text` (storage path; nullable for generated-on-the-fly), `gross_salary numeric`, `tds numeric`, `deductions jsonb`, `uploaded_by uuid`, timestamps
  - Unique `(employee_profile_id, financial_year)`
  - RLS: employee can SELECT own rows (only when their profile `status='approved'`); admin can do everything. INSERT/UPDATE/DELETE for admin only (uploads + generated metadata are admin-driven; auto-generate also persists a row when admin clicks "Generate").
- Trigger on `employee_profiles` BEFORE UPDATE: if any non-status field changes and the row was `approved`, flip `status='pending'`, clear `approved_at`, set `submitted_at=now()`. Admin updates (when `has_role(auth.uid(),'admin')`) skip the flip.
- New storage bucket `form16-documents` (private) with RLS: admin full access; user can read own files.

GRANTs and RLS follow the standard pattern (authenticated + service_role; no anon).

## 2. Employee portal (`public/ems/`)

- `my-profile.html` / `my-profile.js`:
  - Header banner showing status: Pending / Approved / Rejected (with reason).
  - Form inputs disabled when `status='pending'` AFTER first submission; first-time users can fill and submit. After approval, edits re-enable but a notice warns "Saving will require admin re-approval".
  - On save, set `submitted_at=now()`; the DB trigger handles status flip.
- New page `form16.html` + `js/form16.js`:
  - Lists Form 16 entries by financial year for the signed-in user.
  - Each row: FY, source badge, Download button (signed URL for uploaded; client-side jsPDF render for generated using stored salary/tds/deductions).
  - Hidden / disabled when profile `status != 'approved'` with a "Available after approval" message.
- Sidebar (`user-layout.js`): add "Form 16" nav item.

## 3. Admin portal (`public/ems/`)

- `dashboard.html` / `dashboard.js`:
  - New "Pending Approvals" stat card + a widget listing pending employee profiles (name, designation, submitted date, View / Approve / Reject buttons). Reject opens a small modal for reason.
- `view-employee.html` / `employee.js`:
  - New `Status` column with colored badge.
  - Inline Approve / Reject buttons on pending rows.
  - Filter chip: All / Pending / Approved / Rejected.
- New page `admin-form16.html` + `js/admin-form16.js`:
  - Pick employee → list their Form 16s → Upload PDF (to `form16-documents` bucket) for a FY, OR "Auto-generate" which opens a small form (FY, gross salary prefilled from profile salary×12, TDS, deduction lines) and saves a `source='generated'` row. Employee then downloads it from their portal (rendered with jsPDF on demand).
- Admin sidebar (`layout.js`): add "Form 16" link.

## 4. Form 16 PDF generation

Use jsPDF (CDN script tag, no bundler changes) to render a minimal Form 16 Part B style document client-side using the profile + form16 row data. BCCL logo + employee name, PAN/Aadhaar, FY, salary breakup table, TDS, net taxable income, signature block. Used both by employee download (for `source='generated'`) and an admin preview button.

## 5. Files to add / edit

Add:
- `public/ems/form16.html`, `public/ems/admin-form16.html`
- `public/ems/js/form16.js`, `public/ems/js/admin-form16.js`
- migration SQL file

Edit:
- `public/ems/my-profile.html`, `js/my-profile.js` (lock + status banner + re-approval notice)
- `public/ems/dashboard.html`, `js/dashboard.js` (pending widget + approve/reject)
- `public/ems/view-employee.html`, `js/employee.js` (status column + actions + filter)
- `public/ems/js/layout.js`, `js/user-layout.js` (sidebar entries)
- `public/ems/css/style.css` (status badges, modal tweaks)

No TanStack/React route changes — everything lives under the static `public/ems/` portal and talks to Supabase via the existing `js/supa.js` client.

## Out of scope

- Email notifications on approve/reject.
- Multi-admin audit log (we'll just stamp `approved_at`/`approved_by` later if needed).
- Real Form 16 Part A (TRACES) digital signature — auto-generated PDF is a styled summary, not a legal tax document; we'll label it "BCCL internal Form 16 statement".
