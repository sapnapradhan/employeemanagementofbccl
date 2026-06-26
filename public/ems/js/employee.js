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
    const statusFilter = document.getElementById("statusFilter");
    const modal = document.getElementById("confirmModal");
    const confirmOk = document.getElementById("confirmOk");
    const confirmCancel = document.getElementById("confirmCancel");

    const state = { q: "", source: "", page: 1, perPage: 8, pendingDelete: null, cloud: [] };

    // Load cloud profiles (signed-up users) for the admin view
    (async () => {
      try {
        state.cloud = await EMS.cloud.list();
        render();
      } catch (err) {
        EMS.toast("Cloud profiles: " + err.message, "error");
      }
    })();

    function combined() {
      const local = EMS.all().map(e => ({
        _src: "local",
        _key: "L:" + e.employeeId,
        employeeId: e.employeeId,
        name: e.name,
        department: e.department,
        designation: e.designation,
        salary: e.salary,
        phone: e.phone,
        email: e.email,
        photo: e.photo || null,
        status: "local",
        createdAt: e.createdAt || 0,
        _raw: e,
      }));
      const cloud = state.cloud.map(r => ({
        _src: "cloud",
        _key: "C:" + r.id,
        employeeId: r.employee_code || ("EMP-" + (r.id || "").slice(0, 6)),
        name: r.name || "(no name)",
        department: r.department || "",
        designation: r.designation || "",
        salary: r.salary,
        phone: r.phone || "",
        email: r.email || "",
        photo: r.photo_signed_url || null,
        status: r.status || "pending",
        createdAt: r.created_at ? new Date(r.created_at).getTime() : 0,
        _raw: r,
      }));
      return [...local, ...cloud];
    }

    function getFiltered() {
      const q = state.q.toLowerCase();
      const src = state.source;
      return combined().filter(e => {
        if (src === "local"    && e._src !== "local")    return false;
        if (src === "pending"  && !(e._src === "cloud" && e.status === "pending"))  return false;
        if (src === "approved" && !(e._src === "cloud" && e.status === "approved")) return false;
        if (src === "rejected" && !(e._src === "cloud" && e.status === "rejected")) return false;
        if (!q) return true;
        return (e.name || "").toLowerCase().includes(q) ||
               (e.employeeId || "").toLowerCase().includes(q) ||
               (e.email || "").toLowerCase().includes(q);
      }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    function statusBadge(e) {
      if (e._src === "local") return `<span class="badge" style="background:rgba(148,163,184,.2)">Local</span>`;
      const map = {
        pending:  { c: "#f59e0b", l: "Pending"  },
        approved: { c: "#10b981", l: "Approved" },
        rejected: { c: "#ef4444", l: "Rejected" },
      };
      const m = map[e.status] || map.pending;
      return `<span class="badge" style="background:${m.c}22;color:${m.c};border:1px solid ${m.c}55">${m.l}</span>`;
    }

    function render() {
      const list = getFiltered();
      const pages = Math.max(1, Math.ceil(list.length / state.perPage));
      if (state.page > pages) state.page = pages;
      const start = (state.page - 1) * state.perPage;
      const slice = list.slice(start, start + state.perPage);

      if (!list.length) { empty.style.display = "block"; body.innerHTML = ""; pager.innerHTML = ""; return; }
      empty.style.display = "none";

      body.innerHTML = slice.map(e => {
        const photo = e.photo
          ? `<img class="photo-thumb" src="${e.photo}" alt="" />`
          : `<div class="photo-thumb" style="display:inline-grid;place-items:center;background:var(--glass-strong)"><i class="fa-solid fa-user" style="font-size:14px;color:var(--text-muted)"></i></div>`;
        let actions = "";
        if (e._src === "local") {
          actions = `
            <a class="icon-act" title="Edit" href="add-employee.html?id=${encodeURIComponent(e.employeeId)}"><i class="fa-solid fa-pen"></i></a>
            <button class="icon-act del" title="Delete" data-key="${e._key}" data-id="${e.employeeId}" data-name="${escapeHtml(e.name)}"><i class="fa-solid fa-trash"></i></button>`;
        } else {
          const pendingApprove = e.status !== "approved"
            ? `<button class="icon-act" title="Approve" data-act="approve" data-cid="${e._raw.id}" style="color:#10b981"><i class="fa-solid fa-check"></i></button>` : "";
          const pendingReject  = e.status !== "rejected"
            ? `<button class="icon-act" title="Reject" data-act="reject" data-cid="${e._raw.id}" style="color:#f59e0b"><i class="fa-solid fa-ban"></i></button>` : "";
          actions = `
            ${pendingApprove}${pendingReject}
            <button class="icon-act del" title="Delete" data-key="${e._key}" data-cid="${e._raw.id}" data-name="${escapeHtml(e.name)}"><i class="fa-solid fa-trash"></i></button>`;
        }
        return `
          <tr>
            <td>${photo}</td>
            <td><span class="badge">${escapeHtml(e.employeeId)}</span></td>
            <td><b>${escapeHtml(e.name)}</b></td>
            <td>${escapeHtml(e.department || "")}</td>
            <td>${escapeHtml(e.designation || "")}</td>
            <td>${e.salary != null ? EMS.inr(e.salary) : "—"}</td>
            <td>${escapeHtml(e.phone || "")}</td>
            <td>${escapeHtml(e.email || "")}</td>
            <td>${statusBadge(e)}</td>
            <td style="text-align:right"><div class="row-actions">${actions}</div></td>
          </tr>`;
      }).join("");

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
          state.pendingDelete = { key: btn.dataset.key, id: btn.dataset.id, cid: btn.dataset.cid };
          document.getElementById("confirmText").textContent =
            `Delete "${btn.dataset.name}"? This cannot be undone.`;
          modal.classList.add("open");
        });
      });
      body.querySelectorAll('[data-act="approve"], [data-act="reject"]').forEach(btn => {
        btn.addEventListener("click", async () => {
          const act = btn.dataset.act;
          btn.disabled = true;
          try {
            await EMS.cloud.act(act, btn.dataset.cid);
            EMS.toast("Profile " + (act === "approve" ? "approved" : "rejected"));
            state.cloud = await EMS.cloud.list();
            render();
          } catch (err) {
            EMS.toast(err.message, "error");
            btn.disabled = false;
          }
        });
      });
    }

    searchInput.addEventListener("input", (e) => { state.q = e.target.value; state.page = 1; render(); });
    statusFilter.addEventListener("change", (e) => { state.source = e.target.value; state.page = 1; render(); });
    confirmCancel.addEventListener("click", () => { modal.classList.remove("open"); state.pendingDelete = null; });
    confirmOk.addEventListener("click", async () => {
      const pd = state.pendingDelete;
      if (!pd) return;
      try {
        if (pd.key && pd.key.startsWith("L:")) {
          EMS.remove(pd.id);
        } else if (pd.cid) {
          await EMS.cloud.act("delete", pd.cid);
          state.cloud = await EMS.cloud.list();
        }
        EMS.toast("Deleted");
      } catch (err) {
        EMS.toast(err.message, "error");
      }
      state.pendingDelete = null;
      modal.classList.remove("open");
      render();
    });
    modal.addEventListener("click", (e) => { if (e.target === modal) confirmCancel.click(); });

    render();
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  }
})();
