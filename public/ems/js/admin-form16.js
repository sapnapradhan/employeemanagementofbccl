/* admin-form16.js — admin upload/generate Form 16 records */
(async function () {
  const SUPA = window.SUPA;
  const sel = document.getElementById("profileId");
  const sourceEl = document.getElementById("source");
  const fileField = document.getElementById("fileField");
  const rowsEl = document.getElementById("rows");
  const emptyEl = document.getElementById("emptyState");

  await new Promise(r => setTimeout(r, 200));

  // Load approved profiles
  const { data: profiles, error: pErr } = await SUPA.from("employee_profiles")
    .select("id,user_id,employee_code,name,department,designation,salary,email").eq("status", "approved").order("name");
  if (pErr) EMS.toast(pErr.message, "error");
  const byId = {};
  (profiles || []).forEach(p => { byId[p.id] = p; });
  sel.innerHTML = (profiles || []).length
    ? profiles.map(p => `<option value="${p.id}">${esc(p.name)} — ${esc(p.employee_code || "")} (${esc(p.department || "")})</option>`).join("")
    : `<option value="">No approved profiles yet</option>`;

  sourceEl.addEventListener("change", () => {
    fileField.style.display = sourceEl.value === "uploaded" ? "" : "none";
  });

  document.getElementById("issueForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const profile_id = sel.value;
    if (!profile_id) return EMS.toast("Pick an approved employee first", "error");
    const profile = byId[profile_id];
    const fy = document.getElementById("fy").value.trim();
    if (!fy) return EMS.toast("Financial Year is required", "error");
    const gross = Number(document.getElementById("gross").value || 0);
    const tds = Number(document.getElementById("tds").value || 0);
    const deductions = {
      "80c": Number(document.getElementById("d80c").value || 0),
      standard: Number(document.getElementById("std").value || 0),
      professional_tax: Number(document.getElementById("ptax").value || 0),
    };
    const notes = document.getElementById("notes").value.trim();
    const source = sourceEl.value;

    let file_path = null;
    try {
      if (source === "uploaded") {
        const f = document.getElementById("pdfFile").files[0];
        if (!f) return EMS.toast("Pick a PDF file", "error");
        if (f.type !== "application/pdf") return EMS.toast("File must be PDF", "error");
        file_path = `${profile.user_id}/${fy.replace(/[^0-9-]/g, "")}-${Date.now()}.pdf`;
        const { error: upErr } = await SUPA.storage.from("form16-documents")
          .upload(file_path, f, { contentType: "application/pdf", upsert: true });
        if (upErr) throw upErr;
      } else {
        // Auto-generate PDF and upload it too so the employee can download
        const doc = Form16.generatePdf({ profile, fy, gross, tds, deductions, notes });
        const blob = doc.output("blob");
        file_path = `${profile.user_id}/${fy.replace(/[^0-9-]/g, "")}-generated-${Date.now()}.pdf`;
        const { error: upErr } = await SUPA.storage.from("form16-documents")
          .upload(file_path, blob, { contentType: "application/pdf", upsert: true });
        if (upErr) throw upErr;
      }
    } catch (err) {
      return EMS.toast("Upload failed: " + err.message, "error");
    }

    const { data: u } = await SUPA.auth.getUser();
    const payload = {
      user_id: profile.user_id,
      employee_profile_id: profile_id,
      financial_year: fy,
      source, file_path,
      gross_salary: gross, tds, deductions, notes,
      uploaded_by: u?.user?.id || null,
    };
    const { error } = await SUPA.from("form16_documents")
      .upsert(payload, { onConflict: "employee_profile_id,financial_year" });
    if (error) return EMS.toast(error.message, "error");
    EMS.toast("Form 16 saved");
    document.getElementById("issueForm").reset();
    document.getElementById("std").value = "50000";
    fileField.style.display = "none";
    await loadRows();
  });

  await loadRows();

  async function loadRows() {
    const { data, error } = await SUPA.from("form16_documents")
      .select("*, employee_profiles!inner(name,employee_code,department)")
      .order("created_at", { ascending: false });
    if (error) { EMS.toast(error.message, "error"); return; }
    if (!data?.length) { rowsEl.innerHTML = ""; emptyEl.style.display = "block"; return; }
    emptyEl.style.display = "none";
    rowsEl.innerHTML = data.map(r => `
      <tr>
        <td><b>${esc(r.employee_profiles?.name || "—")}</b><br><span class="badge">${esc(r.employee_profiles?.employee_code || "")}</span></td>
        <td>${esc(r.financial_year)}</td>
        <td><span class="pill ${r.source === "uploaded" ? "ok" : "warn"}">${r.source}</span></td>
        <td>${EMS.inr(r.gross_salary)}</td>
        <td>${EMS.inr(r.tds)}</td>
        <td>${new Date(r.created_at).toLocaleDateString()}</td>
        <td style="text-align:right">
          <div class="row-actions">
            <button class="icon-act" title="Download" data-act="dl" data-path="${esc(r.file_path || "")}"><i class="fa-solid fa-download"></i></button>
            <button class="icon-act del" title="Delete" data-act="del" data-id="${r.id}" data-path="${esc(r.file_path || "")}"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>`).join("");

    rowsEl.querySelectorAll("[data-act='dl']").forEach(b => b.addEventListener("click", async () => {
      const url = await Form16.signedUrl(b.dataset.path);
      if (url) window.open(url, "_blank"); else EMS.toast("No file attached", "error");
    }));
    rowsEl.querySelectorAll("[data-act='del']").forEach(b => b.addEventListener("click", async () => {
      if (!confirm("Delete this Form 16 record?")) return;
      if (b.dataset.path) await SUPA.storage.from("form16-documents").remove([b.dataset.path]).catch(()=>{});
      const { error } = await SUPA.from("form16_documents").delete().eq("id", b.dataset.id);
      if (error) return EMS.toast(error.message, "error");
      EMS.toast("Deleted");
      loadRows();
    }));
  }

  function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
})();
