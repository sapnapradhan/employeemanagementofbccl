/* my-profile.js — load/save the signed-in user's own employee profile + photo */
(async function () {
  const SUPA = window.SUPA;
  const fields = ["employee_code","name","father_name","dob","address","phone","aadhaar","email","qualification","designation","department","salary"];
  const photoPreview = document.getElementById("photoPreview");
  const photoInput   = document.getElementById("photoInput");
  const removeBtn    = document.getElementById("removePhoto");
  const form         = document.getElementById("profileForm");
  const deleteBtn    = document.getElementById("deleteProfile");
  const saveLabel    = document.getElementById("saveLabel");

  let session = (await SUPA.auth.getSession()).data.session;
  if (!session) { location.href = "index.html"; return; }
  const userId = session.user.id;
  let currentRow = null;
  let currentPhotoPath = null; // storage object path
  let pendingPhotoFile = null; // File chosen but not yet uploaded (save together)
  let removePhotoFlag = false;

  // Default values
  document.getElementById("email").value = session.user.email || "";
  const meta = session.user.user_metadata || {};
  if (meta.full_name) document.getElementById("name").value = meta.full_name;
  document.getElementById("employee_code").value = "EMP-" + userId.slice(0, 6).toUpperCase();

  await loadProfile();

  /* ----- Photo handling ----- */
  photoInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { EMS.toast("Max 5 MB", "error"); return; }
    pendingPhotoFile = file;
    removePhotoFlag = false;
    const reader = new FileReader();
    reader.onload = () => renderPhoto(reader.result);
    reader.readAsDataURL(file);
  });
  removeBtn.addEventListener("click", () => {
    pendingPhotoFile = null;
    removePhotoFlag = true;
    renderPhoto(null);
  });

  /* ----- Submit ----- */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = { user_id: userId };
    fields.forEach(f => {
      const el = document.getElementById(f);
      let v = (el.value || "").trim();
      if (f === "salary") v = v ? Number(v) : null;
      if (f === "dob")    v = v || null;
      data[f] = v === "" ? null : v;
    });
    if (!data.name)          return EMS.toast("Name is required", "error");
    if (!data.employee_code) return EMS.toast("Employee Code is required", "error");
    if (data.phone   && !/^[6-9]\d{9}$/.test(data.phone))    return EMS.toast("Invalid 10-digit phone", "error");
    if (data.aadhaar && !/^\d{12}$/.test(data.aadhaar))      return EMS.toast("Aadhaar must be 12 digits", "error");

    saveLabel.textContent = "Saving…";

    // Photo upload/remove
    try {
      if (removePhotoFlag && currentPhotoPath) {
        await SUPA.storage.from("employee-photos").remove([currentPhotoPath]);
        data.photo_url = null;
        currentPhotoPath = null;
      } else if (pendingPhotoFile) {
        const ext = (pendingPhotoFile.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${userId}/photo-${Date.now()}.${ext}`;
        const { error: upErr } = await SUPA.storage.from("employee-photos").upload(path, pendingPhotoFile, { upsert: true, contentType: pendingPhotoFile.type });
        if (upErr) throw upErr;
        if (currentPhotoPath) await SUPA.storage.from("employee-photos").remove([currentPhotoPath]).catch(() => {});
        currentPhotoPath = path;
        data.photo_url = path;
      }
    } catch (err) {
      saveLabel.textContent = "Save Profile";
      return EMS.toast("Photo upload failed: " + err.message, "error");
    }

    // Upsert
    const payload = currentRow ? data : data;
    const { error } = currentRow
      ? await SUPA.from("employee_profiles").update(payload).eq("user_id", userId)
      : await SUPA.from("employee_profiles").insert(payload);

    saveLabel.textContent = "Save Profile";
    if (error) return EMS.toast(error.message, "error");
    EMS.toast("Profile saved");
    pendingPhotoFile = null;
    removePhotoFlag = false;
    await loadProfile();
  });

  /* ----- Delete ----- */
  deleteBtn.addEventListener("click", async () => {
    if (!confirm("Delete your employee profile? This cannot be undone.")) return;
    if (currentPhotoPath) await SUPA.storage.from("employee-photos").remove([currentPhotoPath]).catch(() => {});
    const { error } = await SUPA.from("employee_profiles").delete().eq("user_id", userId);
    if (error) return EMS.toast(error.message, "error");
    EMS.toast("Profile deleted");
    currentRow = null;
    currentPhotoPath = null;
    form.reset();
    document.getElementById("email").value = session.user.email || "";
    document.getElementById("employee_code").value = "EMP-" + userId.slice(0, 6).toUpperCase();
    renderPhoto(null);
  });

  /* ----- Helpers ----- */
  async function loadProfile() {
    const { data: row, error } = await SUPA.from("employee_profiles").select("*").eq("user_id", userId).maybeSingle();
    if (error) { EMS.toast(error.message, "error"); return; }
    currentRow = row;
    renderStatus(row?.status);
    if (!row) { renderPhoto(null); return; }
    fields.forEach(f => { const el = document.getElementById(f); if (el && row[f] != null) el.value = row[f]; });
    currentPhotoPath = row.photo_url || null;
    if (currentPhotoPath) {
      const { data: signed } = await SUPA.storage.from("employee-photos").createSignedUrl(currentPhotoPath, 60 * 60 * 24 * 7);
      renderPhoto(signed?.signedUrl || null);
    } else {
      renderPhoto(null);
    }
    saveLabel.textContent = "Update Profile";
  }

  function renderStatus(status) {
    const b = document.getElementById("statusBanner");
    if (!b) return;
    if (!status) { b.style.display = "none"; return; }
    const map = {
      pending:  { c: "#f59e0b", i: "fa-hourglass-half", t: "Pending approval", m: "Your profile has been submitted and is awaiting admin approval." },
      approved: { c: "#10b981", i: "fa-circle-check",   t: "Approved",         m: "Your profile is approved and visible to the admin team." },
      rejected: { c: "#ef4444", i: "fa-circle-xmark",   t: "Not approved",     m: "Your submission was not approved. Please update your details and save again." },
    };
    const s = map[status] || map.pending;
    b.style.display = "";
    b.style.borderLeft = `4px solid ${s.c}`;
    b.innerHTML = `<div style="display:flex;gap:14px;align-items:center"><i class="fa-solid ${s.i}" style="color:${s.c};font-size:24px"></i><div><div style="font-weight:700;color:${s.c}">${s.t}</div><div style="color:var(--text-muted);font-size:13px;margin-top:2px">${s.m}</div></div></div>`;
  }

  function renderPhoto(src) {
    if (src) {
      photoPreview.innerHTML = `<img src="${src}" alt="photo" />`;
      removeBtn.style.display = "";
    } else {
      photoPreview.innerHTML = `<i class="fa-solid fa-user"></i>`;
      removeBtn.style.display = "none";
    }
  }
})();
