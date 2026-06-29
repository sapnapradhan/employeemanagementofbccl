/* my-profile.js — status banner, edit-lock when pending, photo upload */
(async function () {
  const SUPA = window.SUPA;
  const fields = ["employee_code","name","father_name","dob","address","phone","aadhaar","email","qualification","designation","department","salary"];
  const photoPreview = document.getElementById("photoPreview");
  const photoInput   = document.getElementById("photoInput");
  const removeBtn    = document.getElementById("removePhoto");
  const photoBtn     = document.getElementById("photoUploadBtn");
  const form         = document.getElementById("profileForm");
  const fieldset     = document.getElementById("profileFieldset");
  const deleteBtn    = document.getElementById("deleteProfile");
  const saveBtn      = document.getElementById("saveBtn");
  const saveLabel    = document.getElementById("saveLabel");
  const banner       = document.getElementById("statusBanner");

  const session = (await SUPA.auth.getSession()).data.session;
  if (!session) { location.href = "index.html"; return; }
  const userId = session.user.id;
  let currentRow = null;
  let currentPhotoPath = null;
  let pendingPhotoFile = null;
  let removePhotoFlag = false;

  document.getElementById("email").value = session.user.email || "";
  const meta = session.user.user_metadata || {};
  if (meta.full_name) document.getElementById("name").value = meta.full_name;
  document.getElementById("employee_code").value = "EMP-" + userId.slice(0, 6).toUpperCase();

  await loadProfile();

  photoInput.addEventListener("change", (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { EMS.toast("Max 5 MB", "error"); return; }
    pendingPhotoFile = file; removePhotoFlag = false;
    const r = new FileReader();
    r.onload = () => renderPhoto(r.result);
    r.readAsDataURL(file);
  });
  removeBtn.addEventListener("click", () => { pendingPhotoFile = null; removePhotoFlag = true; renderPhoto(null); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (currentRow && currentRow.status === "pending") {
      return EMS.toast("Your profile is awaiting admin approval. Edits are locked.", "error");
    }
    const data = { user_id: userId };
    fields.forEach(f => {
      let v = (document.getElementById(f).value || "").trim();
      if (f === "salary") v = v ? Number(v) : null;
      if (f === "dob")    v = v || null;
      data[f] = v === "" ? null : v;
    });
    if (!data.name)          return EMS.toast("Name is required", "error");
    if (!data.employee_code) return EMS.toast("Employee Code is required", "error");
    if (data.phone   && !/^[6-9]\d{9}$/.test(data.phone))    return EMS.toast("Invalid 10-digit phone", "error");
    if (data.aadhaar && !/^\d{12}$/.test(data.aadhaar))      return EMS.toast("Aadhaar must be 12 digits", "error");

    saveLabel.textContent = "Saving…";

    try {
      if (removePhotoFlag && currentPhotoPath) {
        await SUPA.storage.from("employee-photos").remove([currentPhotoPath]);
        data.photo_url = null; currentPhotoPath = null;
      } else if (pendingPhotoFile) {
        const ext = (pendingPhotoFile.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${userId}/photo-${Date.now()}.${ext}`;
        const { error: upErr } = await SUPA.storage.from("employee-photos").upload(path, pendingPhotoFile, { upsert: true, contentType: pendingPhotoFile.type });
        if (upErr) throw upErr;
        if (currentPhotoPath) await SUPA.storage.from("employee-photos").remove([currentPhotoPath]).catch(() => {});
        currentPhotoPath = path; data.photo_url = path;
      }
    } catch (err) {
      saveLabel.textContent = "Save Profile";
      return EMS.toast("Photo upload failed: " + err.message, "error");
    }

    // First save → submitted (pending). Subsequent edits also flip to pending via DB trigger.
    if (!currentRow) data.status = "pending";

    const { error } = currentRow
      ? await SUPA.from("employee_profiles").update(data).eq("user_id", userId)
      : await SUPA.from("employee_profiles").insert(data);

    saveLabel.textContent = "Save Profile";
    if (error) return EMS.toast(error.message, "error");
    EMS.toast(currentRow ? "Saved — pending admin re-approval" : "Submitted for admin approval");
    pendingPhotoFile = null; removePhotoFlag = false;
    await loadProfile();
  });

  deleteBtn.addEventListener("click", async () => {
    if (!confirm("Delete your employee profile? This cannot be undone.")) return;
    if (currentPhotoPath) await SUPA.storage.from("employee-photos").remove([currentPhotoPath]).catch(() => {});
    const { error } = await SUPA.from("employee_profiles").delete().eq("user_id", userId);
    if (error) return EMS.toast(error.message, "error");
    EMS.toast("Profile deleted");
    currentRow = null; currentPhotoPath = null;
    form.reset();
    document.getElementById("email").value = session.user.email || "";
    document.getElementById("employee_code").value = "EMP-" + userId.slice(0, 6).toUpperCase();
    renderPhoto(null);
    renderBanner();
    lockForm(false);
  });

  async function loadProfile() {
    const { data: row, error } = await SUPA.from("employee_profiles").select("*").eq("user_id", userId).maybeSingle();
    if (error) { EMS.toast(error.message, "error"); return; }
    currentRow = row;
    if (!row) {
      renderPhoto(null);
      renderBanner();
      lockForm(false);
      saveLabel.textContent = "Submit for Approval";
      return;
    }
    fields.forEach(f => { const el = document.getElementById(f); if (el && row[f] != null) el.value = row[f]; });
    currentPhotoPath = row.photo_url || null;
    if (currentPhotoPath) {
      const { data: signed } = await SUPA.storage.from("employee-photos").createSignedUrl(currentPhotoPath, 60 * 60 * 24 * 7);
      renderPhoto(signed?.signedUrl || null);
    } else { renderPhoto(null); }
    renderBanner();
    lockForm(row.status === "pending");
    saveLabel.textContent = row.status === "approved" ? "Update Profile" : "Resubmit";
  }

  function renderBanner() {
    if (!currentRow) {
      banner.style.display = "block";
      banner.className = "status-banner info";
      banner.innerHTML = `<i class="fa-solid fa-circle-info"></i> <div><b>No profile yet.</b> Fill in your details and submit — an admin will review and approve before it goes live.</div>`;
      return;
    }
    const s = currentRow.status;
    banner.style.display = "block";
    if (s === "approved") {
      banner.className = "status-banner ok";
      banner.innerHTML = `<i class="fa-solid fa-circle-check"></i> <div><b>Approved.</b> Your profile is live. Any edit will require admin re-approval.</div>`;
    } else if (s === "rejected") {
      banner.className = "status-banner err";
      banner.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> <div><b>Rejected.</b> ${escapeHtml(currentRow.rejection_reason || "Please fix the issues and resubmit.")}</div>`;
    } else {
      banner.className = "status-banner warn";
      banner.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> <div><b>Pending admin approval.</b> Your profile is locked for editing until an admin reviews it.</div>`;
    }
  }

  function lockForm(locked) {
    Array.from(fieldset.querySelectorAll("input, select, textarea")).forEach(el => { el.disabled = locked; });
    saveBtn.disabled = locked;
    photoInput.disabled = locked;
    if (photoBtn) photoBtn.style.opacity = locked ? ".5" : "";
    if (photoBtn) photoBtn.style.pointerEvents = locked ? "none" : "";
  }

  function renderPhoto(src) {
    if (src) { photoPreview.innerHTML = `<img src="${src}" alt="photo" />`; removeBtn.style.display = ""; }
    else     { photoPreview.innerHTML = `<i class="fa-solid fa-user"></i>`; removeBtn.style.display = "none"; }
  }
  function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
})();
