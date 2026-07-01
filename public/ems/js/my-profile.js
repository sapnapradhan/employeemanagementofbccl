/* my-profile.js
 *
 * Employees NEVER write directly to employee_profiles anymore.
 * All edits are submitted to the profile_change_requests table as a diff
 * ({ field: {old, new} }), and applied by an admin via approve_change_request().
 *
 * Reads use the employee_self_view, which returns masked PAN, Aadhaar and
 * account number so the raw sensitive values never reach the employee.
 */
(async function () {
  const SUPA = window.SUPA;
  const BUCKET_DOCS   = window.BCCL.CONFIG.BUCKET_DOCS;
  const BUCKET_PHOTOS = window.BCCL.CONFIG.BUCKET_PHOTOS;

  const TEXT_FIELDS = [
    "employee_code","name","father_name","dob","address","phone","email",
    "qualification","designation","department","salary",
    "bank_name","account_number","ifsc",
    "emergency_contact_name","emergency_contact_phone",
    "pan_number","aadhaar_number",
  ];

  const el = (id) => document.getElementById(id);
  const banner   = el("statusBanner");
  const photoPrev = el("photoPreview");
  const photoInp  = el("photoInput");
  const photoBtn  = el("photoUploadBtn");
  const submitBtn = el("submitChangesBtn");

  const session = (await SUPA.auth.getSession()).data.session;
  if (!session) { location.href = "index.html"; return; }
  const userId = session.user.id;

  el("email").value = session.user.email || "";
  const meta = session.user.user_metadata || {};
  if (meta.full_name) el("name").value = meta.full_name;
  el("employee_code").value = "EMP-" + userId.slice(0, 6).toUpperCase();

  let selfRow = null;           // from employee_self_view (masked)
  let pendingReq = null;        // latest pending profile_change_request
  let pendingPhotoFile = null;
  let pendingPanFile = null;
  let pendingAadFrontFile = null;
  let pendingAadBackFile = null;

  photoInp.addEventListener("change", (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 5 * 1024 * 1024) return EMS.toast("Max 5 MB", "error");
    pendingPhotoFile = f;
    const r = new FileReader();
    r.onload = () => renderPhoto(r.result);
    r.readAsDataURL(f);
  });
  el("pan_file").addEventListener("change", (e) => pendingPanFile = e.target.files[0] || null);
  el("aad_front_file").addEventListener("change", (e) => pendingAadFrontFile = e.target.files[0] || null);
  el("aad_back_file").addEventListener("change", (e) => pendingAadBackFile = e.target.files[0] || null);

  submitBtn.addEventListener("click", submitChanges);

  await loadAll();

  /* ---------------- load ---------------- */
  async function loadAll() {
    const [{ data: rows, error: e1 }, { data: pend, error: e2 }] = await Promise.all([
      SUPA.from("employee_self_view").select("*").limit(1),
      SUPA.from("profile_change_requests")
        .select("*").eq("status", "pending")
        .order("submitted_at", { ascending: false }).limit(1),
    ]);
    if (e1) EMS.toast(e1.message, "error");
    if (e2) EMS.toast(e2.message, "error");
    selfRow = (rows && rows[0]) || null;
    pendingReq = (pend && pend[0]) || null;

    // Populate form with approved values (masked for sensitive)
    TEXT_FIELDS.forEach(f => {
      const inp = el(f); if (!inp) return;
      const v = selfRow ? selfRow[f] : null;
      if (v != null) inp.value = v;
    });
    // Masked previews
    el("panMask").textContent  = selfRow?.pan_masked      || "—";
    el("aadMask").textContent  = selfRow?.aadhaar_masked  || "—";
    el("acctMask").textContent = selfRow?.account_number_masked || "—";

    // Show masked value in the PAN/Aadhaar/account inputs (employee cannot see raw)
    if (selfRow?.pan_masked)     el("pan_number").value     = selfRow.pan_masked;
    if (selfRow?.aadhaar_masked) el("aadhaar_number").value = selfRow.aadhaar_masked;
    if (selfRow?.account_number_masked) el("account_number").value = selfRow.account_number_masked;

    // Verification badges
    setPill("panVerBadge", selfRow?.pan_verified_at, "PAN Verified");
    setPill("aadVerBadge", selfRow?.aadhaar_verified_at, "Aadhaar Verified");

    // Signed URLs for uploaded docs
    await attachSignedLink("panDl",       selfRow?.pan_front_url,     BUCKET_DOCS);
    await attachSignedLink("aadFrontDl",  selfRow?.aadhaar_front_url, BUCKET_DOCS);
    await attachSignedLink("aadBackDl",   selfRow?.aadhaar_back_url,  BUCKET_DOCS);

    // Photo
    if (selfRow?.photo_url) {
      const { data: signed } = await SUPA.storage.from(BUCKET_PHOTOS).createSignedUrl(selfRow.photo_url, 3600 * 24 * 7);
      renderPhoto(signed?.signedUrl || null);
    } else renderPhoto(null);

    renderBanner();
    lockForm(!!pendingReq);
  }

  function setPill(id, ts, label) {
    const p = el(id); if (!p) return;
    if (ts) { p.className = "pill ok"; p.textContent = label; p.style.display = ""; }
    else    { p.className = "pill warn"; p.textContent = "Unverified"; p.style.display = ""; }
  }

  async function attachSignedLink(id, path, bucket) {
    const a = el(id); if (!a) return;
    if (!path) { a.style.display = "none"; return; }
    const { data } = await SUPA.storage.from(bucket).createSignedUrl(path, 3600);
    if (data?.signedUrl) { a.href = data.signedUrl; a.target = "_blank"; a.style.display = ""; }
    else { a.style.display = "none"; }
  }

  function renderPhoto(src) {
    photoPrev.innerHTML = src
      ? `<img src="${src}" alt="photo" />`
      : `<i class="fa-solid fa-user"></i>`;
  }

  function renderBanner() {
    banner.style.display = "block";
    if (pendingReq) {
      banner.className = "status-banner warn";
      const fields = Object.keys(pendingReq.changes || {});
      banner.innerHTML = `<i class="fa-solid fa-hourglass-half"></i>
        <div><b>Pending admin approval.</b>
        You've submitted ${fields.length} change${fields.length === 1 ? "" : "s"}
        (${fields.slice(0, 6).map(escapeHtml).join(", ")}${fields.length > 6 ? "…" : ""}).
        Editing is locked until an admin reviews the request.</div>`;
      return;
    }
    if (!selfRow) {
      banner.className = "status-banner info";
      banner.innerHTML = `<i class="fa-solid fa-circle-info"></i>
        <div><b>Welcome!</b> Fill in your details below and submit — an admin will review and approve.</div>`;
      return;
    }
    if (selfRow.status === "approved") {
      banner.className = "status-banner ok";
      banner.innerHTML = `<i class="fa-solid fa-circle-check"></i>
        <div><b>Approved.</b> Your profile is live. Any change you submit will require admin re-approval.</div>`;
    } else if (selfRow.status === "rejected") {
      banner.className = "status-banner err";
      banner.innerHTML = `<i class="fa-solid fa-circle-xmark"></i>
        <div><b>Last submission rejected.</b> ${escapeHtml(selfRow.rejection_reason || "Please fix issues and resubmit.")}</div>`;
    } else {
      banner.className = "status-banner warn";
      banner.innerHTML = `<i class="fa-solid fa-hourglass-half"></i>
        <div><b>Awaiting admin review.</b></div>`;
    }
  }

  function lockForm(locked) {
    document.querySelectorAll("input, select, textarea").forEach(n => { n.disabled = locked; });
    submitBtn.disabled = locked;
    photoBtn.style.opacity = locked ? ".5" : "";
    photoBtn.style.pointerEvents = locked ? "none" : "";
  }

  /* ---------------- submit ---------------- */
  async function submitChanges() {
    if (pendingReq) return EMS.toast("You already have a pending request.", "error");

    // Collect new values from form
    const draft = {};
    TEXT_FIELDS.forEach(f => {
      let v = (el(f).value || "").trim();
      if (f === "salary") v = v === "" ? null : Number(v);
      if (f === "dob")    v = v === "" ? null : v;
      draft[f] = v === "" ? null : v;
    });

    // Do NOT accept the masked values as changes
    if (selfRow?.pan_masked && draft.pan_number === selfRow.pan_masked)             draft.pan_number = "__unchanged__";
    if (selfRow?.aadhaar_masked && draft.aadhaar_number === selfRow.aadhaar_masked) draft.aadhaar_number = "__unchanged__";
    if (selfRow?.account_number_masked && draft.account_number === selfRow.account_number_masked) draft.account_number = "__unchanged__";

    // Validation
    if (!draft.name) return EMS.toast("Name is required", "error");
    if (draft.phone && !/^[6-9]\d{9}$/.test(draft.phone)) return EMS.toast("Invalid 10-digit phone", "error");
    if (draft.emergency_contact_phone && !/^[6-9]\d{9}$/.test(draft.emergency_contact_phone))
      return EMS.toast("Invalid emergency contact phone", "error");
    if (draft.pan_number && draft.pan_number !== "__unchanged__" && !window.Masking.validPan(draft.pan_number))
      return EMS.toast("PAN must be like ABCDE1234F", "error");
    if (draft.aadhaar_number && draft.aadhaar_number !== "__unchanged__" && !window.Masking.validAadhaar(draft.aadhaar_number))
      return EMS.toast("Aadhaar must be 12 digits", "error");

    submitBtn.disabled = true;
    submitBtn.querySelector("i").className = "fa-solid fa-spinner fa-spin";

    try {
      // Upload documents first (private bucket, RLS lets user write to own folder)
      const changes = {};
      const addChange = (field, oldV, newV) => {
        if ((oldV ?? null) === (newV ?? null)) return;
        changes[field] = { old: oldV ?? null, new: newV ?? null };
      };

      if (pendingPhotoFile) {
        const path = `${userId}/photo-${Date.now()}.${extOf(pendingPhotoFile.name, "jpg")}`;
        const { error } = await SUPA.storage.from(BUCKET_PHOTOS)
          .upload(path, pendingPhotoFile, { contentType: pendingPhotoFile.type, upsert: true });
        if (error) throw error;
        addChange("photo_url", selfRow?.photo_url || null, path);
      }
      if (pendingPanFile) {
        const path = `${userId}/pan/${Date.now()}.${extOf(pendingPanFile.name, "pdf")}`;
        const { error } = await SUPA.storage.from(BUCKET_DOCS)
          .upload(path, pendingPanFile, { contentType: pendingPanFile.type, upsert: true });
        if (error) throw error;
        addChange("pan_front_url", selfRow?.pan_front_url || null, path);
      }
      if (pendingAadFrontFile) {
        const path = `${userId}/aadhaar-front/${Date.now()}.${extOf(pendingAadFrontFile.name, "pdf")}`;
        const { error } = await SUPA.storage.from(BUCKET_DOCS)
          .upload(path, pendingAadFrontFile, { contentType: pendingAadFrontFile.type, upsert: true });
        if (error) throw error;
        addChange("aadhaar_front_url", selfRow?.aadhaar_front_url || null, path);
      }
      if (pendingAadBackFile) {
        const path = `${userId}/aadhaar-back/${Date.now()}.${extOf(pendingAadBackFile.name, "pdf")}`;
        const { error } = await SUPA.storage.from(BUCKET_DOCS)
          .upload(path, pendingAadBackFile, { contentType: pendingAadBackFile.type, upsert: true });
        if (error) throw error;
        addChange("aadhaar_back_url", selfRow?.aadhaar_back_url || null, path);
      }

      // Diff text fields against the last known raw value (unavailable for masked fields)
      TEXT_FIELDS.forEach(f => {
        const newV = draft[f];
        if (["pan_number","aadhaar_number","account_number"].includes(f)) {
          if (newV === "__unchanged__") return;              // employee saw mask, didn't touch
          if (!newV) return;                                 // clearing sensitive not allowed here
          // We don't know the raw old value; mark old as masked hint.
          changes[f] = { old: selfRow?.[f + "_masked"] || null, new: normalizeSensitive(f, newV) };
          return;
        }
        const oldV = selfRow?.[f] ?? null;
        if ((oldV ?? null) !== (newV ?? null)) changes[f] = { old: oldV ?? null, new: newV ?? null };
      });

      if (Object.keys(changes).length === 0) {
        EMS.toast("No changes detected.", "error");
        submitBtn.disabled = false;
        submitBtn.querySelector("i").className = "fa-solid fa-paper-plane";
        return;
      }

      const { error } = await SUPA.from("profile_change_requests").insert({
        user_id: userId, changes, status: "pending",
      });
      if (error) throw error;

      // Also flip the profile status to pending if it exists (so admin dashboard shows it)
      if (selfRow) {
        // The employee cannot UPDATE employee_profiles directly (RLS blocks it),
        // so we rely on the request row alone. Admin queue reads change requests.
      }

      EMS.toast("Submitted for admin approval");
      pendingPhotoFile = pendingPanFile = pendingAadFrontFile = pendingAadBackFile = null;
      await loadAll();
    } catch (err) {
      EMS.toast(err.message || "Failed to submit changes", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.querySelector("i").className = "fa-solid fa-paper-plane";
    }
  }

  function normalizeSensitive(field, v) {
    if (field === "pan_number")     return String(v).toUpperCase().replace(/\s+/g, "");
    if (field === "aadhaar_number") return String(v).replace(/\s+/g, "");
    return v;
  }
  function extOf(name, fallback) {
    const p = (name || "").split(".").pop();
    return (p && p.length <= 5) ? p.toLowerCase() : fallback;
  }
  function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
})();
