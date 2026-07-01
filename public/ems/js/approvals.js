/* approvals.js — admin reviews profile change requests and approves/rejects
 * via SECURITY DEFINER RPCs. Employee profiles are NEVER updated directly here.
 */
(async function () {
  const SUPA = window.SUPA;
  const list = document.getElementById("reqList");
  const empty = document.getElementById("emptyState");
  const modal = document.getElementById("rejectModal");
  const reasonEl = document.getElementById("rejectReason");
  const state = { filter: "pending", rows: [], profiles: {}, rejectId: null };

  await new Promise(r => setTimeout(r, 150)); // let admin guard settle

  document.querySelectorAll("#filterSeg .seg-btn").forEach(b => {
    b.addEventListener("click", () => {
      document.querySelectorAll("#filterSeg .seg-btn").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      state.filter = b.dataset.f;
      render();
    });
  });
  document.getElementById("refreshBtn").addEventListener("click", load);
  document.getElementById("rejectCancel").addEventListener("click", () => { modal.classList.remove("open"); state.rejectId = null; });
  document.getElementById("rejectConfirm").addEventListener("click", async () => {
    if (!state.rejectId) return;
    const reason = reasonEl.value.trim();
    if (reason.length < 5) return EMS.toast("Reason must be at least 5 characters", "error");
    const { error } = await SUPA.rpc("reject_change_request", { _req_id: state.rejectId, _reason: reason });
    if (error) return EMS.toast(error.message, "error");
    EMS.toast("Rejected");
    modal.classList.remove("open"); state.rejectId = null; reasonEl.value = "";
    load();
  });

  await load();

  async function load() {
    const [{ data: reqs, error: e1 }, { data: profs, error: e2 }] = await Promise.all([
      SUPA.from("profile_change_requests").select("*").order("submitted_at", { ascending: false }),
      SUPA.from("employee_profiles").select("user_id, name, employee_code, email"),
    ]);
    if (e1) return EMS.toast(e1.message, "error");
    if (e2) EMS.toast(e2.message, "error");
    state.rows = reqs || [];
    state.profiles = {};
    (profs || []).forEach(p => state.profiles[p.user_id] = p);

    const c = { pending: 0, approved: 0, rejected: 0 };
    state.rows.forEach(r => { c[r.status] = (c[r.status] || 0) + 1; });
    document.getElementById("kPending").textContent  = c.pending;
    document.getElementById("kApproved").textContent = c.approved;
    document.getElementById("kRejected").textContent = c.rejected;
    document.getElementById("kTotal").textContent    = state.rows.length;
    render();
  }

  function render() {
    const rows = state.filter === "all" ? state.rows : state.rows.filter(r => r.status === state.filter);
    if (!rows.length) { list.innerHTML = ""; empty.style.display = "block"; return; }
    empty.style.display = "none";
    list.innerHTML = rows.map(r => cardHtml(r)).join("");
    list.querySelectorAll("[data-act='approve']").forEach(b => b.addEventListener("click", () => approve(b.dataset.id)));
    list.querySelectorAll("[data-act='reject']").forEach(b => b.addEventListener("click", () => { state.rejectId = b.dataset.id; reasonEl.value = ""; modal.classList.add("open"); }));
  }

  function cardHtml(r) {
    const p = state.profiles[r.user_id] || {};
    const changes = r.changes || {};
    const fieldRows = Object.entries(changes).map(([k, v]) => `
      <tr>
        <td style="color:var(--text-muted)">${esc(k)}</td>
        <td>${renderVal(k, v.old, true)}</td>
        <td><b>${renderVal(k, v.new, false)}</b></td>
      </tr>`).join("");
    const badge = { pending: ["warn","Pending"], approved: ["ok","Approved"], rejected: ["err","Rejected"] }[r.status] || ["",""];
    return `
      <div class="card">
        <div class="head">
          <h3>
            <i class="fa-solid fa-user"></i>&nbsp;${esc(p.name || "(no profile)")}
            <span class="badge">${esc(p.employee_code || r.user_id.slice(0,6))}</span>
            <span class="pill ${badge[0]}" style="margin-left:6px">${badge[1]}</span>
          </h3>
          <div style="font-size:12px;color:var(--text-muted)">${fmtDate(r.submitted_at)}</div>
        </div>
        <div style="padding:0 4px 12px;color:var(--text-muted);font-size:13px">${esc(p.email || "")}</div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Field</th><th>Current</th><th>Requested</th></tr></thead>
            <tbody>${fieldRows || `<tr><td colspan="3" class="empty">No field changes</td></tr>`}</tbody>
          </table>
        </div>
        ${r.status === "rejected" && r.rejection_reason ? `<div class="status-banner err" style="display:flex;margin-top:8px"><i class="fa-solid fa-circle-info"></i><div><b>Rejection reason:</b> ${esc(r.rejection_reason)}</div></div>` : ""}
        ${r.status === "pending" ? `
          <div class="form-actions" style="margin-top: 12px">
            <button class="btn danger" data-act="reject"  data-id="${r.id}"><i class="fa-solid fa-xmark"></i> Reject</button>
            <button class="btn"        data-act="approve" data-id="${r.id}"><i class="fa-solid fa-check"></i> Approve &amp; apply</button>
          </div>` : ""}
      </div>`;
  }

  function renderVal(field, v, isOld) {
    if (v === null || v === undefined) return `<span style="color:var(--text-muted)">—</span>`;
    // Admin can see raw new values (they must, to verify PAN/Aadhaar). Old sensitive values are already masked hints.
    if (field === "salary") return EMS.inr(v);
    return esc(String(v));
  }

  async function approve(id) {
    const { error } = await SUPA.rpc("approve_change_request", { _req_id: id });
    if (error) return EMS.toast(error.message, "error");
    EMS.toast("Approved");
    load();
  }

  function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function fmtDate(d){ if(!d) return "—"; const x=new Date(d); return x.toLocaleDateString()+" "+x.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}); }
})();
