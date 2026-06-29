/* approvals.js — admin reviews pending/approved/rejected employee profiles */
(async function () {
  const SUPA = window.SUPA;
  const rowsEl = document.getElementById("rows");
  const emptyEl = document.getElementById("emptyState");
  const modal = document.getElementById("rejectModal");
  const reasonEl = document.getElementById("rejectReason");
  let state = { filter: "pending", all: [], rejectId: null };

  // wait for admin guard
  await new Promise(r => setTimeout(r, 150));

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
    const reason = reasonEl.value.trim() || "Rejected by admin";
    const { error } = await SUPA.from("employee_profiles")
      .update({ status: "rejected", rejection_reason: reason, approved_at: null })
      .eq("id", state.rejectId);
    if (error) return EMS.toast(error.message, "error");
    EMS.toast("Profile rejected");
    modal.classList.remove("open"); state.rejectId = null; reasonEl.value = "";
    load();
  });

  await load();

  async function load() {
    const { data, error } = await SUPA.from("employee_profiles")
      .select("*").order("submitted_at", { ascending: false });
    if (error) { EMS.toast(error.message, "error"); return; }
    state.all = data || [];
    const counts = { pending: 0, approved: 0, rejected: 0 };
    state.all.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
    document.getElementById("kPending").textContent  = counts.pending  || 0;
    document.getElementById("kApproved").textContent = counts.approved || 0;
    document.getElementById("kRejected").textContent = counts.rejected || 0;
    document.getElementById("kTotal").textContent    = state.all.length;
    render();
  }

  function render() {
    const list = state.filter === "all" ? state.all : state.all.filter(r => r.status === state.filter);
    if (!list.length) { rowsEl.innerHTML = ""; emptyEl.style.display = "block"; return; }
    emptyEl.style.display = "none";
    rowsEl.innerHTML = list.map(r => `
      <tr>
        <td><div class="photo-thumb" style="display:inline-grid;place-items:center;background:var(--glass-strong)"><i class="fa-solid fa-user" style="font-size:14px;color:var(--text-muted)"></i></div></td>
        <td><span class="badge">${esc(r.employee_code || "")}</span></td>
        <td><b>${esc(r.name || "—")}</b></td>
        <td>${esc(r.email || "")}</td>
        <td>${esc(r.department || "")}</td>
        <td>${esc(r.designation || "")}</td>
        <td>${EMS.inr(r.salary || 0)}</td>
        <td>${statusBadge(r.status)}</td>
        <td>${fmtDate(r.submitted_at)}</td>
        <td style="text-align:right">
          <div class="row-actions">
            ${r.status !== "approved" ? `<button class="icon-act ok" title="Approve" data-act="approve" data-id="${r.id}"><i class="fa-solid fa-check"></i></button>` : ""}
            ${r.status !== "rejected" ? `<button class="icon-act del" title="Reject"  data-act="reject"  data-id="${r.id}"><i class="fa-solid fa-xmark"></i></button>` : ""}
          </div>
        </td>
      </tr>`).join("");

    rowsEl.querySelectorAll("[data-act='approve']").forEach(b => b.addEventListener("click", () => approve(b.dataset.id)));
    rowsEl.querySelectorAll("[data-act='reject']").forEach(b => b.addEventListener("click", () => { state.rejectId = b.dataset.id; reasonEl.value = ""; modal.classList.add("open"); }));
  }

  async function approve(id) {
    const { error } = await SUPA.from("employee_profiles")
      .update({ status: "approved", approved_at: new Date().toISOString(), rejection_reason: null })
      .eq("id", id);
    if (error) return EMS.toast(error.message, "error");
    EMS.toast("Profile approved");
    load();
  }

  function statusBadge(s) {
    const map = { pending: ["warn","Pending"], approved: ["ok","Approved"], rejected: ["err","Rejected"] };
    const [cls, label] = map[s] || ["", s || ""];
    return `<span class="pill ${cls}">${label}</span>`;
  }
  function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function fmtDate(d){ if(!d) return "—"; const x=new Date(d); return x.toLocaleDateString()+" "+x.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}); }
})();
