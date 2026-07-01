/* bulk-form16.js — safe PAN-based bulk Form 16 upload.
 *
 * Rules (enforced client-side AND server-side by bulk_form16_upload_finalize):
 *  - Filename must be a PAN (e.g. ABCDE1234F.pdf)
 *  - Exactly one employee with that PAN → upload
 *  - Zero employees with that PAN       → Unmatched (skipped)
 *  - More than one employee with that PAN → Duplicate PAN error (blocked)
 */
(async function () {
  const SUPA = window.SUPA;
  const BUCKET_FORM16 = window.BCCL.CONFIG.BUCKET_FORM16;
  const dropzone = document.getElementById("dropzone");
  const input    = document.getElementById("pdfInput");
  const listEl   = document.getElementById("fileList");
  const emptyEl  = document.getElementById("listEmpty");
  const fyEl     = document.getElementById("fy");
  const notesEl  = document.getElementById("notes");

  let items = []; // { file, pan, status: 'matched'|'unmatched'|'duplicate'|'invalid_name'|'not_pdf'|'uploaded'|'failed', match?, error? }

  ["dragover","dragenter"].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add("drag"); }));
  ["dragleave","drop"].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.remove("drag"); }));
  dropzone.addEventListener("drop", e => handleFiles(e.dataTransfer.files));
  input.addEventListener("change", e => handleFiles(e.target.files));
  document.getElementById("clearBtn").addEventListener("click", () => { items = []; render(); input.value = ""; });
  document.getElementById("uploadBtn").addEventListener("click", uploadAll);

  async function handleFiles(fileList) {
    const fresh = Array.from(fileList || []);
    for (const f of fresh) {
      const item = { file: f, status: "pending" };
      if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
        item.status = "not_pdf";
      } else {
        const stem = f.name.replace(/\.pdf$/i, "").toUpperCase().trim();
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(stem)) {
          item.status = "invalid_name";
        } else {
          item.pan = stem;
        }
      }
      items.push(item);
    }
    render();
    // Look up matches for every pending item with a PAN
    for (const it of items) {
      if (it.status !== "pending") continue;
      const { data, error } = await SUPA.rpc("bulk_form16_lookup", { _pan: it.pan });
      if (error) { it.status = "failed"; it.error = error.message; continue; }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) { it.status = "unmatched"; }
      else if (row.match_status === "matched") { it.status = "matched"; it.match = row; }
      else if (row.match_status === "duplicate") { it.status = "duplicate"; }
      else { it.status = "unmatched"; }
      render();
    }
  }

  async function uploadAll() {
    const fy = fyEl.value.trim();
    if (!fy) return EMS.toast("Financial Year is required (e.g. 2024-25)", "error");
    const toUpload = items.filter(i => i.status === "matched");
    if (!toUpload.length) return EMS.toast("No matched files to upload", "error");

    for (const it of toUpload) {
      it.status = "uploading"; render();
      try {
        const path = `${it.match.user_id}/${fy.replace(/[^0-9-]/g,"")}-bulk-${Date.now()}-${it.pan}.pdf`;
        const { error: upErr } = await SUPA.storage.from(BUCKET_FORM16)
          .upload(path, it.file, { contentType: "application/pdf", upsert: true });
        if (upErr) throw upErr;
        const { error: rpcErr } = await SUPA.rpc("bulk_form16_upload_finalize", {
          _pan: it.pan, _financial_year: fy, _file_path: path, _notes: notesEl.value.trim() || null,
        });
        if (rpcErr) throw rpcErr;
        it.status = "uploaded";
      } catch (err) {
        it.status = "failed"; it.error = err.message;
      }
      render();
    }
    EMS.toast("Bulk upload finished");
  }

  function render() {
    if (!items.length) { listEl.innerHTML = ""; emptyEl.style.display = "block"; return; }
    emptyEl.style.display = "none";
    listEl.innerHTML = items.map((it, i) => {
      const pill = statusPill(it);
      const label = it.pan ? `PAN: <b>${esc(it.pan)}</b>` : "—";
      const detail = it.match ? esc(it.match.employee_name || "") : (it.error ? esc(it.error) : "");
      return `<div class="file-row">
        <div class="name">${esc(it.file.name)}</div>
        <div>${pill}</div>
        <div>${label}${detail ? ` &middot; ${detail}` : ""}</div>
        <button class="icon-act del" data-i="${i}" title="Remove"><i class="fa-solid fa-xmark"></i></button>
      </div>`;
    }).join("");
    listEl.querySelectorAll("[data-i]").forEach(b => b.addEventListener("click", () => {
      items.splice(Number(b.dataset.i), 1); render();
    }));
  }

  function statusPill(it) {
    const map = {
      pending:      ["warn", "Checking…"],
      matched:      ["ok",   "Matched"],
      uploading:    ["warn", "Uploading…"],
      uploaded:     ["ok",   "Uploaded"],
      unmatched:    ["warn", "Unmatched"],
      duplicate:    ["err",  "Duplicate PAN — blocked"],
      invalid_name: ["err",  "Invalid filename"],
      not_pdf:      ["err",  "Not a PDF"],
      failed:       ["err",  "Failed"],
    };
    const [cls, label] = map[it.status] || ["", it.status];
    return `<span class="pill ${cls}">${label}</span>`;
  }
  function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
})();
