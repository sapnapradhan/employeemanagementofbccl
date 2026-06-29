/* form16.js — shared helpers: PDF generation + signed URL */
window.Form16 = (function () {
  const FY_BCCL = "Bharat Coking Coal Limited (A subsidiary of Coal India Limited)";

  function calcTax(taxableIncome) {
    // FY 2024-25 New regime slabs (simplified, ignores cess/surcharge for clarity)
    let t = 0, x = Math.max(0, taxableIncome);
    const slabs = [
      [300000, 0.00],
      [300000, 0.05],
      [300000, 0.10],
      [300000, 0.15],
      [300000, 0.20],
      [Infinity, 0.30],
    ];
    let remaining = x;
    for (const [width, rate] of slabs) {
      const take = Math.min(remaining, width);
      t += take * rate;
      remaining -= take;
      if (remaining <= 0) break;
    }
    return Math.round(t * 1.04); // + 4% cess
  }

  function inr(n) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }

  function generatePdf({ profile, fy, gross, tds, deductions, notes }) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    let y = 40;

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, W, 70, "F");
    doc.setTextColor(255);
    doc.setFontSize(16).setFont("helvetica", "bold");
    doc.text("FORM 16 — Part B (Salary Certificate)", 40, 35);
    doc.setFontSize(9).setFont("helvetica", "normal");
    doc.text(FY_BCCL, 40, 55);
    doc.text(`Financial Year: ${fy}`, W - 40, 55, { align: "right" });

    doc.setTextColor(20);
    y = 100;
    doc.setFontSize(11).setFont("helvetica", "bold");
    doc.text("Employee Details", 40, y); y += 16;
    doc.setFont("helvetica", "normal").setFontSize(10);
    const rows = [
      ["Employee Code", profile.employee_code || "—"],
      ["Name", profile.name || "—"],
      ["Father's Name", profile.father_name || "—"],
      ["PAN / Aadhaar", profile.aadhaar || "—"],
      ["Designation", profile.designation || "—"],
      ["Department", profile.department || "—"],
      ["Email", profile.email || "—"],
      ["Phone", profile.phone || "—"],
    ];
    rows.forEach(([k, v]) => { doc.text(k, 40, y); doc.text(String(v), 200, y); y += 16; });

    y += 10;
    doc.setFont("helvetica", "bold").setFontSize(11);
    doc.text("Earnings & Deductions", 40, y); y += 16;
    doc.setFont("helvetica", "normal").setFontSize(10);

    const std = Number(deductions?.standard || 0);
    const ptax = Number(deductions?.professional_tax || 0);
    const d80c = Math.min(150000, Number(deductions?.["80c"] || 0));
    const taxable = Math.max(0, Number(gross || 0) - std - ptax - d80c);
    const computedTax = calcTax(taxable);

    const lines = [
      ["Gross Salary",                 inr(gross)],
      ["Less: Standard Deduction",     inr(std)],
      ["Less: Professional Tax",       inr(ptax)],
      ["Less: Deductions u/s 80C",     inr(d80c)],
      ["Taxable Income",               inr(taxable)],
      ["Tax on Taxable Income (incl. cess)", inr(computedTax)],
      ["TDS Deducted by Employer",     inr(tds)],
      ["Net Tax Payable / (Refund)",   inr(computedTax - Number(tds || 0))],
    ];
    lines.forEach(([k, v]) => {
      doc.text(k, 40, y);
      doc.text(v, W - 40, y, { align: "right" });
      y += 16;
    });

    if (notes) {
      y += 10;
      doc.setFont("helvetica", "bold").text("Notes", 40, y); y += 14;
      doc.setFont("helvetica", "normal");
      doc.text(doc.splitTextToSize(notes, W - 80), 40, y);
    }

    doc.setFontSize(8).setTextColor(120);
    doc.text("This is a system-generated Form 16 issued by BCCL EMS. For official tax filing, please use the signed copy from your employer.", 40, doc.internal.pageSize.getHeight() - 30, { maxWidth: W - 80 });

    return doc;
  }

  async function signedUrl(path) {
    if (!path) return null;
    const { data } = await window.SUPA.storage.from("form16-documents").createSignedUrl(path, 60 * 10);
    return data?.signedUrl || null;
  }

  return { calcTax, generatePdf, signedUrl, inr };
})();
