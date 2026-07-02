/* bulk-form16.js — smart bulk Form 16 uploader.
 *
 * Auto-matches each PDF using this priority:
 *   1. Filename is a PAN (e.g. ABCDE1234F.pdf) → employee_profiles.pan_number
 *   2. Filename is an Employee Code            → employee_profiles.employee_code
 *   3. Extract PAN from PDF text (pdf.js)      → employee_profiles.pan_number
 *
 * Only rows with status "ready" are uploaded. Duplicates and unmatched files
 * are surfaced in the preview with clear reasons and never uploaded.
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
  const summaryEl = document.getElementById("summary");
  const progressWrap = document.getElementById("progressWrap");
  const progressBar  = document.getElementById("progressBar");
  const progressLabel = document.getElementById("progressLabel");

  const PAN_RX  = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/;
  const PAN_STRICT = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

  /** items: { file, status, pan?, employee_code?, method?, match?, error?, fy? } */
  let items = [];

  ["dragover","dragenter"].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add("drag"); }));
  ["dragleave","drop"].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.remove("drag"); }));
  dropzone.addEventListener("drop", e => handleFiles(e.dataTransfer.files));
  input.addEventListener("change", e => handleFiles(e.target.files));
  document.getElementById("clearBtn").addEventListener("click", () => { items = []; render(); input.value = ""; });
  document.getElementById("uploadBtn").addEventListener("click", uploadAll);

  async function handleFiles(fileList) {
    const fresh = Array.from(fileList || []).filter(f =>
      f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    const start = items.length;
    fresh.forEach(f => items.push({ file: f, status: "queued" }));
    render();

    // Process sequentially with progress; PDF parsing is CPU-bound so batching keeps UI alive
    setProgress(0, `Analyzing 0 / ${fresh.length}`);
    for (let i = 0; i < fresh.length; i++) {
      const it = items[start + i];
      await analyze(it);
      setProgress(((i + 1) / fresh.length) * 100, `Analyzing ${i + 1} / ${fresh.length}`);
      render();
      // yield to browser
      await new Promise(r => setTimeout(r, 0));
    }
    hideProgress();
  }

  async function analyze(it) {
    const stem = it.file.name.replace(/\.pdf$/i, "").trim();
    const upper = stem.toUpperCase();

    // Method 1: filename is a PAN
    if (PAN_STRICT.test(upper)) {
      it.pan = upper;
      it.method = "Filename (PAN)";
      return lookupByPan(it);
    }

    // Method 2: filename is an Employee Code (alphanumeric, not a PAN)
    if (/^[A-Za-z0-9_-]{3,20}$/.test(stem)) {
      it.employee_code = stem;
      it.method = "Filename (Employee Code)";
      const ok = await lookupByCode(it);
      if (ok) return;
      // fall through to PDF extraction
    }

    // Method 3: extract PAN from PDF contents
    it.method = "Extracted from PDF";
    try {
      const pan = await extractPanFromPdf(it.file);
      if (!pan) { it.status = "no_pan_in_pdf"; return; }
      it.pan = pan;
      return lookupByPan(it);
    } catch (err) {
      it.status = "invalid_pdf";
      it.error = err.message;
    }
  }

  async function lookupByPan(it) {
    const { data, error } = await SUPA.rpc("bulk_form16_lookup", { _pan: it.pan });
    if (error) { it.status = "failed"; it.error = error.message; return; }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || row.match_status === "unmatched") { it.status = "unmatched"; return; }
    if (row.match_status === "duplicate") { it.status = "duplicate_pan"; return; }
    it.status = "ready";
    it.match = row;
  }

  /** returns true if lookup produced a terminal state (ready or duplicate) */
  async function lookupByCode(it) {
    const { data, error } = await SUPA.rpc("bulk_form16_lookup_code", { _code: it.employee_code });
    if (error) { it.status = "failed"; it.error = error.message; return true; }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || row.match_status === "unmatched") return false; // try PDF extraction
    if (row.match_status === "duplicate") { it.status = "duplicate_code"; return true; }
    it.status = "ready";
    it.match = row;
    it.pan = row.pan_number || null;
    return true;
  }

  async function extractPanFromPdf(file) {
    if (!window.pdfjsLib) throw new Error("PDF library not loaded");
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    const maxPages = Math.min(pdf.numPages, 5); // PAN typically on first pages
    for (let p = 1; p <= maxPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const text = content.items.map(i => i.str).join(" ").toUpperCase();
      const m = text.match(PAN_RX);
      if (m) return m[0];
    }
    return null;
  }

  async function uploadAll() {
    const fy = fyEl.value.trim();
    if (!fy) return EMS.toast("Financial Year is required (e.g. 2024-25)", "error");
    const toUpload = items.filter(i => i.status === "ready");
    if (!toUpload.length) return EMS.toast("No matched files to upload", "error");

    let ok = 0, fail = 0;
    setProgress(0, `Uploading 0 / ${toUpload.length}`);
    for (let i = 0; i < toUpload.length; i++) {
      const it = toUpload[i];
      it.status = "uploading"; render();
      try {
        const panTag = it.pan || it.employee_code || "file";
        const path = `${it.match.user_id}/${fy.replace(/[^0-9-]/g,"")}-bulk-${Date.now()}-${panTag}.pdf`;
        const { error: upErr } = await SUPA.storage.from(BUCKET_FORM16)
          .upload(path, it.file, { contentType: "application/pdf", upsert: true });
        if (upErr) throw upErr;
        if (!it.pan) throw new Error("Cannot finalize without PAN");
        const { error: rpcErr } = await SUPA.rpc("bulk_form16_upload_finalize", {
          _pan: it.pan, _financial_year: fy, _file_path: path, _notes: notesEl.value.trim() || null,
        });
        if (rpcErr) throw rpcErr;
        it.status = "uploaded"; ok++;
      } catch (err) {
        it.status = "failed"; it.error = err.message; fail++;
      }
      setProgress(((i + 1) / toUpload.length) * 100, `Uploading ${i + 1} / ${toUpload.length}`);
      render();
    }
    hideProgress();
    EMS.toast(`Uploaded ${ok}${fail ? `, ${fail} failed` : ""}`);
  }

  function setProgress(pct, label) {
    progressWrap.style.display = "block";
    progressBar.style.width = pct + "%";
    progressLabel.textContent = label;
  }
  function hideProgress(){ progressWrap.style.display = "none"; }

  function render() {
    renderSummary();
    if (!items.length) { listEl.innerHTML = ""; emptyEl.style.display = "block"; return; }
    emptyEl.style.display = "none";
    const header = `<div class="file-row header">
      <div>Filename</div><div>Status</div><div>PAN</div>
      <div>Employee</div><div>Emp Code</div><div>Match Method</div>
    </div>`;
    const rows = items.map((it, i) => {
      const pill = statusPill(it);
      const name = it.match ? esc(it.match.employee_name || "—") : (it.error ? `<span style="color:var(--danger,#e11)">${esc(it.error)}</span>` : "—");
      return `<div class="file-row">
        <div class="name">${esc(it.file.name)} <button class="rm" data-i="${i}" title="Remove"><i class="fa-solid fa-xmark"></i></button></div>
        <div>${pill}</div>
        <div>${esc(it.pan || "—")}</div>
        <div>${name}</div>
        <div>${esc(it.employee_code || (it.match && it.match.employee_code) || "—")}</div>
        <div>${esc(it.method || "—")}</div>
      </div>`;
    }).join("");
    listEl.innerHTML = header + rows;
    listEl.querySelectorAll(".rm").forEach(b => b.addEventListener("click", () => {
      items.splice(Number(b.dataset.i), 1); render();
    }));
  }

  function renderSummary() {
    if (!items.length) { summaryEl.innerHTML = ""; return; }
    const counts = items.reduce((a, it) => { a[it.status] = (a[it.status]||0)+1; return a; }, {});
    const entries = [
      ["ready", "ok", "Ready"],
      ["uploaded", "ok", "Uploaded"],
      ["unmatched", "warn", "Employee not found"],
      ["no_pan_in_pdf", "warn", "PAN not in PDF"],
      ["duplicate_pan", "err", "Duplicate PAN"],
      ["duplicate_code", "err", "Duplicate Emp Code"],
      ["invalid_pdf", "err", "Invalid PDF"],
      ["failed", "err", "Failed"],
    ];
    summaryEl.innerHTML = entries
      .filter(([k]) => counts[k])
      .map(([k, cls, label]) => `<span class="pill ${cls}">${label}: ${counts[k]}</span>`)
      .join("");
  }

  function statusPill(it) {
    const map = {
      queued:         ["warn", "Queued"],
      ready:          ["ok",   "✅ Ready"],
      uploading:      ["warn", "Uploading…"],
      uploaded:       ["ok",   "Uploaded"],
      unmatched:      ["warn", "❌ Employee not found"],
      duplicate_pan:  ["err",  "⚠ Duplicate PAN"],
      duplicate_code: ["err",  "⚠ Duplicate Emp Code"],
      no_pan_in_pdf:  ["warn", "⚠ PAN not in PDF"],
      invalid_pdf:    ["err",  "⚠ Invalid PDF"],
      failed:         ["err",  "Failed"],
    };
    const [cls, label] = map[it.status] || ["", it.status || "…"];
    return `<span class="pill ${cls}">${label}</span>`;
  }
  function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
})();
