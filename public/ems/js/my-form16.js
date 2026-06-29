/* my-form16.js — employee view of own Form 16 records */
(async function () {
  const SUPA = window.SUPA;
  const rowsEl = document.getElementById("rows");
  const empty = document.getElementById("emptyState");
  const banner = document.getElementById("banner");

  const { data: sess } = await SUPA.auth.getSession();
  if (!sess?.session) { location.href = "index.html"; return; }
  const userId = sess.session.user.id;

  const { data: profile } = await SUPA.from("employee_profiles").select("status").eq("user_id", userId).maybeSingle();
  if (!profile || profile.status !== "approved") {
    banner.style.display = "block";
    banner.className = "status-banner warn";
    banner.innerHTML = `<i class="fa-solid fa-lock"></i> <div>Form 16 records become visible after your profile is approved by an admin.</div>`;
    empty.style.display = "block";
    return;
  }

  const { data, error } = await SUPA.from("form16_documents")
    .select("*").eq("user_id", userId).order("financial_year", { ascending: false });
  if (error) { EMS.toast(error.message, "error"); return; }

  if (!data?.length) { empty.style.display = "block"; return; }
  empty.style.display = "none";
  rowsEl.innerHTML = data.map(r => `
    <tr>
      <td><b>${esc(r.financial_year)}</b></td>
      <td><span class="pill ${r.source === "uploaded" ? "ok" : "warn"}">${r.source}</span></td>
      <td>${EMS.inr(r.gross_salary)}</td>
      <td>${EMS.inr(r.tds)}</td>
      <td>${new Date(r.created_at).toLocaleDateString()}</td>
      <td style="text-align:right">
        <button class="btn ghost" data-path="${esc(r.file_path || "")}"><i class="fa-solid fa-download"></i> Download</button>
      </td>
    </tr>`).join("");
  rowsEl.querySelectorAll("button[data-path]").forEach(b => b.addEventListener("click", async () => {
    const url = await Form16.signedUrl(b.dataset.path);
    if (url) window.open(url, "_blank"); else EMS.toast("No PDF attached", "error");
  }));

  function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
})();
