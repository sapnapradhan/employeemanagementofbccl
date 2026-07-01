/* masking.js — client-side masking helpers (defense in depth; DB also masks). */
window.Masking = (() => {
  const maskPan = (s) => {
    if (!s) return "";
    const t = String(s).trim().toUpperCase();
    if (t.length < 4) return "******";
    return "******" + t.slice(-4);
  };
  const maskAadhaar = (s) => {
    if (!s) return "";
    const t = String(s).replace(/\s+/g, "");
    if (t.length < 4) return "XXXX XXXX XXXX";
    return "XXXX XXXX " + t.slice(-4);
  };
  const maskAccount = (s) => {
    if (!s) return "";
    const t = String(s).trim();
    if (t.length < 4) return "XXXX";
    return "X".repeat(Math.max(t.length - 4, 0)) + t.slice(-4);
  };
  const validPan = (s) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(String(s || "").toUpperCase());
  const validAadhaar = (s) => /^\d{12}$/.test(String(s || "").replace(/\s+/g, ""));
  return { maskPan, maskAadhaar, maskAccount, validPan, validAadhaar };
})();
