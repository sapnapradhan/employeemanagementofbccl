/* employee.js — admin employee directory (Supabase). Shows raw PAN/Aadhaar
 * (admin only), lets admin verify PAN/Aadhaar via SECURITY DEFINER RPCs. */
(async function () {
  const SUPA = window.SUPA;
  const rowsEl = document.getElementById("rows");
  const emptyEl = document.getElementById("emptyState");
  const q = document.getElementById("q");
  let all = [];

  await new Promise(r => setTimeout(r, 150));

  document.getElementById("refreshBtn").addEventListener("click", load);
  q.addEventListener("input", render);
  await load();

  async function load() {
    const { data, error } = await SUPA.from("employee_profiles")
      .select("*").order("created_at",{ascending:false});
    if (error) { EMS.toast(error.message,"error"); return; }
    all = data || []; render();
  }

  function render() {
    const term = q.value.trim().toLowerCase();
    const list = !term ? all : all.filter(e =>
      (e.name||"").toLowerCase().includes(term) ||
      (e.employee_code||"").toLowerCase().includes(term) ||
      (e.pan_number||"").toLowerCase().includes(term) ||
      (e.department||"").toLowerCase().includes(term) ||
      (e.email||"").toLowerCase().includes(term)
    );
    if (!list.length) { rowsEl.innerHTML=""; emptyEl.style.display="block"; return; }
    emptyEl.style.display = "none";
    rowsEl.innerHTML = list.map(e => `
      <tr>
        <td><span class="badge">${esc(e.employee_code||"")}</span></td>
        <td><b>${esc(e.name||"—")}</b></td>
        <td>${esc(e.email||"")}</td>
        <td>${esc(e.department||"")}</td>
        <td>${EMS.inr(e.salary||0)}</td>
        <td>${e.pan_number ? esc(e.pan_number) : `<span style="color:var(--text-muted)">—</span>`}
            ${e.pan_number ? (e.pan_verified_at ? `<span class="pill ok" style="margin-left:4px">✓</span>` : `<span class="pill warn" style="margin-left:4px">unverified</span>`) : ""}
        </td>
        <td>${e.aadhaar_number ? esc(e.aadhaar_number) : `<span style="color:var(--text-muted)">—</span>`}
            ${e.aadhaar_number ? (e.aadhaar_verified_at ? `<span class="pill ok" style="margin-left:4px">✓</span>` : `<span class="pill warn" style="margin-left:4px">unverified</span>`) : ""}
        </td>
        <td>${statusPill(e.status)}</td>
        <td style="text-align:right">
          <div class="row-actions">
            ${e.pan_number && !e.pan_verified_at ? `<button class="icon-act ok" title="Verify PAN" data-act="vpan" data-u="${e.user_id}"><i class="fa-solid fa-id-card"></i></button>` : ""}
            ${e.aadhaar_number && !e.aadhaar_verified_at ? `<button class="icon-act ok" title="Verify Aadhaar" data-act="vaad" data-u="${e.user_id}"><i class="fa-solid fa-id-card-clip"></i></button>` : ""}
          </div>
        </td>
      </tr>`).join("");

    rowsEl.querySelectorAll("[data-act='vpan']").forEach(b => b.addEventListener("click", () => verify("verify_pan", b.dataset.u)));
    rowsEl.querySelectorAll("[data-act='vaad']").forEach(b => b.addEventListener("click", () => verify("verify_aadhaar", b.dataset.u)));
  }

  async function verify(fn, uid) {
    const { error } = await SUPA.rpc(fn, { _user_id: uid });
    if (error) return EMS.toast(error.message, "error");
    EMS.toast("Verified");
    load();
  }

  function statusPill(s) {
    const map = { pending:["warn","Pending"], approved:["ok","Approved"], rejected:["err","Rejected"] };
    const [c,l] = map[s] || ["","(none)"];
    return `<span class="pill ${c}">${l}</span>`;
  }
  function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
})();
