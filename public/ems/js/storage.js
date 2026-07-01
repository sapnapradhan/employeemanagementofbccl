/* storage.js — SHARED UI HELPERS ONLY.
 *
 * Phase 1 refactor: All authentication, role, and employee CRUD now lives in
 * Supabase. The legacy LocalStorage employee directory has been removed. This
 * file keeps only the small UI helpers (theme, toast, formatting) that every
 * page in the app still depends on.
 *
 * DO NOT reintroduce EMS.login / EMS.isAuthed / EMS.add / EMS.all / etc.
 * Auth belongs to window.SUPA. Employees live in the employee_profiles table.
 */
const EMS = (() => {
  const KEY_THEME = "bccl_ems_theme";

  /* Theme */
  const getTheme = () => localStorage.getItem(KEY_THEME) || "dark";
  const setTheme = (t) => {
    localStorage.setItem(KEY_THEME, t);
    document.documentElement.setAttribute("data-theme", t);
    const btn = document.getElementById("themeToggle");
    if (btn) btn.innerHTML = t === "dark"
      ? '<i class="fa-solid fa-moon"></i>'
      : '<i class="fa-solid fa-sun"></i>';
  };
  const applyTheme = () => setTheme(getTheme());

  /* Formatting */
  const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
  const initial = (s) => (s || "?").trim().charAt(0).toUpperCase();

  /* Toast */
  const toast = (msg, type = "success") => {
    const t = document.getElementById("toast");
    if (!t) return;
    t.className = "toast " + type;
    t.innerHTML = `<i class="fa-solid ${type === "success" ? "fa-circle-check" : "fa-circle-exclamation"}"></i> ${msg}`;
    requestAnimationFrame(() => t.classList.add("show"));
    clearTimeout(window.__toastT);
    window.__toastT = setTimeout(() => t.classList.remove("show"), 2400);
  };

  return { getTheme, setTheme, applyTheme, inr, initial, toast };
})();
