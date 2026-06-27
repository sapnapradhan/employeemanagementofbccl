/* employee.js - drives add/edit form AND the view table (page-detected) */

(function () {
  const form = document.getElementById("empForm");
  const table = document.getElementById("empTable");

  if (form) initForm();
  if (table) initTable();

  /* ---------------- FORM (add / edit) ---------------- */
  function initForm() {
    const qs = new URLSearchParams(location.search);
    const editId = qs.get("id");
    const isEdit = !!editId;

    const fields = ["name","fatherName","dob","address","phone","aadhaar","email","qualification","designation","department","salary"];
    const idEl = document.getElementById("employeeId");

    const photoPreview = document.getElementById("photoPreview");
    const photoInput   = document.getElementById("photoInput");
    const removeBtn    = document.getElementById("removePhoto");
    let photoData = null; // base64 dataURL or null

    const renderPhoto = (src) => {
      if (src) { photoPreview.innerHTML = `<img src="${src}" alt="photo" />`; removeBtn.style.display = ""; }
      else { photoPreview.innerHTML = `<i class="fa-solid fa-user"></i>`; removeBtn.style.display = "none"; }
    };
    photoInput?.addEventListener("change", (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (f.size > 2 * 1024 * 1024) { EMS.toast("Max 2 MB", "error"); return; }
      const r = new FileReader();
      r.onload = () => { photoData = r.result; renderPhoto(photoData); };
      r.readAsDataURL(f);
    });
    removeBtn?.addEventListener("click", () => { photoData = null; renderPhoto(null); });

    if (isEdit) {
      const emp = EMS.get(editId);
      if (!emp) { EMS.toast("Employee not found", "error"); setTimeout(() => location.href = "view-employee.html", 800); return; }
      idEl.value = emp.employeeId;
      fields.forEach(f => { if (document.getElementById(f)) document.getElementById(f).value = emp[f] ?? ""; });
      photoData = emp.photo || null;
      renderPhoto(photoData);
      document.getElementById("pageTitle").textContent = "Edit Employee";
      document.getElementById("submitLabel").textContent = "Update Employee";
      document.title = "BCCL EMS — Edit Employee";
    } else {
      idEl.value = EMS.nextId();
    }

    const setErr = (id, on, msg) => {
      const wrap = document.getElementById(id).closest(".field");
      wrap.classList.toggle("invalid", on);
      if (msg) wrap.querySelector(".err").textContent = msg;
    };

    const validate = (data) => {
      let ok = true;
      const required = ["name","fatherName","dob","address","qualification","designation","department"];
      required.forEach(k => { const bad = !data[k] || !String(data[k]).trim(); if (bad) ok = false; setErr(k, bad); });

      const phoneOk = /^[6-9]\d{9}$/.test(data.phone || "");
      setErr("phone", !phoneOk, "Enter a valid 10-digit Indian phone");
      if (!phoneOk) ok = false;

      const aadhaarOk = /^\d{12}$/.test(data.aadhaar || "");
      setErr("aadhaar", !aadhaarOk, "Aadhaar must be 12 digits");
      if (!aadhaarOk) ok = false;

      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || "");
      setErr("email", !emailOk, "Enter a valid email address");
      if (!emailOk) ok = false;

      const salaryOk = Number(data.salary) > 0;
      setErr("salary", !salaryOk, "Enter a salary greater than 0");
      if (!salaryOk) ok = false;

      return ok;
    };

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = { employeeId: idEl.value, photo: photoData };
      fields.forEach(f => { data[f] = document.getElementById(f).value.trim(); });
      data.salary = Number(data.salary);
      if (!validate(data)) { EMS.toast("Please fix the highlighted fields", "error"); return; }

      try {
        if (isEdit) {
          EMS.update(editId, data);
          EMS.toast("Employee updated successfully");
        } else {
          data.createdAt = Date.now();
          EMS.add(data);
          EMS.toast("Employee added successfully");
          form.reset();
          idEl.value = EMS.nextId();
        }
        setTimeout(() => location.href = "view-employee.html", 700);
      } catch (err) {
        EMS.toast(err.message || "Save failed", "error");
      }
    });
  }

  /* ---------------- TABLE (view / search / paginate / delete) ---------------- */
  function initTable() {
    const body = document.getElementById("empBody");
    const empty = document.getElementById("emptyState");
    const pager = document.getElementById("pager");
    const searchInput = document.getElementById("searchInput");
    const modal = document.getElementById("confirmModal");
    const confirmOk = document.getElementById("confirmOk");
    const confirmCancel = document.getElementById("confirmCancel");

    const state = { q: "", page: 1, perPage: 8, pendingDelete: null, cloud: [] };

    function getFiltered() {
      const q = state.q.toLowerCase();
      const merged = EMS.all().concat(state.cloud);
      return merged.filter(e =>
        !q ||
        (e.name || "").toLowerCase().includes(q) ||
        (e.employeeId || "").toLowerCase().includes(q)
      ).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    // Load approved cloud profiles in the background and re-render
    if (window.EMSCloud) {
      window.EMSCloud.listApproved().then(rows => {
        state.cloud = rows || [];
        render();
      });
    }

    function render() {
      const list = getFiltered();
      const pages = Math.max(1, Math.ceil(list.length / state.perPage));
      if (state.page > pages) state.page = pages;
      const start = (state.page - 1) * state.perPage;
      const slice = list.slice(start, start + state.perPage);

      if (!list.length) { empty.style.display = "block"; body.innerHTML = ""; pager.innerHTML = ""; return; }
      empty.style.display = "none";

      body.innerHTML = slice.map(e => `
        <tr>
          <td>${e.photo ? `<img class="photo-thumb" src="${e.photo}" alt="" />` : `<div class="photo-thumb" style="display:inline-grid;place-items:center;background:var(--glass-strong)"><i class="fa-solid fa-user" style="font-size:14px;color:var(--text-muted)"></i></div>`}</td>
          <td><span class="badge">${e.employeeId}</span>${e.__cloud ? ` <span class="badge" style="background:rgba(16,185,129,.15);color:#10b981;border-color:rgba(16,185,129,.4)" title="Approved user account">User</span>` : ""}</td>
          <td><b>${escapeHtml(e.name)}</b></td>
          <td>${escapeHtml(e.fatherName || "")}</td>
          <td>${escapeHtml(e.department || "")}</td>
          <td>${escapeHtml(e.designation || "")}</td>
          <td>${EMS.inr(e.salary)}</td>
          <td>${escapeHtml(e.phone || "")}</td>
          <td>${escapeHtml(e.email || "")}</td>
          <td style="text-align:right">
            <div class="row-actions">
              ${e.__cloud
                ? `<span class="icon-act" title="Managed by user" style="opacity:.5;cursor:not-allowed"><i class="fa-solid fa-lock"></i></span>`
                : `<a class="icon-act" title="Edit" href="add-employee.html?id=${encodeURIComponent(e.employeeId)}"><i class="fa-solid fa-pen"></i></a>
                   <button class="icon-act del" title="Delete" data-id="${e.employeeId}" data-name="${escapeHtml(e.name)}"><i class="fa-solid fa-trash"></i></button>`}
            </div>
          </td>
        </tr>`).join("");

      // pager
      pager.innerHTML = "";
      const mk = (label, page, disabled, active) => {
        const b = document.createElement("button");
        b.innerHTML = label;
        b.disabled = !!disabled;
        if (active) b.classList.add("active");
        b.addEventListener("click", () => { state.page = page; render(); });
        return b;
      };
      pager.appendChild(mk('<i class="fa-solid fa-chevron-left"></i>', state.page - 1, state.page === 1));
      for (let p = 1; p <= pages; p++) pager.appendChild(mk(String(p), p, false, p === state.page));
      pager.appendChild(mk('<i class="fa-solid fa-chevron-right"></i>', state.page + 1, state.page === pages));

      body.querySelectorAll(".icon-act.del").forEach(btn => {
        btn.addEventListener("click", () => {
          state.pendingDelete = btn.dataset.id;
          document.getElementById("confirmText").textContent =
            `Delete "${btn.dataset.name}" (${btn.dataset.id})? This cannot be undone.`;
          modal.classList.add("open");
        });
      });
    }

    searchInput.addEventListener("input", (e) => { state.q = e.target.value; state.page = 1; render(); });
    confirmCancel.addEventListener("click", () => { modal.classList.remove("open"); state.pendingDelete = null; });
    confirmOk.addEventListener("click", () => {
      if (state.pendingDelete) {
        EMS.remove(state.pendingDelete);
        EMS.toast("Employee deleted");
        state.pendingDelete = null;
        modal.classList.remove("open");
        render();
      }
    });
    modal.addEventListener("click", (e) => { if (e.target === modal) confirmCancel.click(); });

    render();
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  }
})();
