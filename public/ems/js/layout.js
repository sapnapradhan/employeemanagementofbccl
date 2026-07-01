/* layout.js — admin shell: Supabase-only guard, sidebar, theme, logout. */
EMS.applyTheme();

(async function guard() {
  let isAdmin = false;
  try {
    const { data } = await window.SUPA.auth.getSession();
    if (data?.session) {
      const r = await window.SUPA.rpc("is_admin");
      isAdmin = !!r.data;
    }
  } catch (_) {}
  if (!isAdmin) {
    location.href = "index.html";
    return;
  }
  window.__IS_ADMIN = true;
})();

(function buildSidebar() {
  const sb = document.getElementById("sidebar");
  if (!sb) return;
  const path = location.pathname.split("/").pop() || "dashboard.html";
  const items = [
    { href: "dashboard.html",     icon: "fa-gauge-high",          label: "Dashboard" },
    { href: "approvals.html",     icon: "fa-user-check",          label: "Approvals" },
    { href: "view-employee.html", icon: "fa-users",               label: "Employees" },
    { href: "admin-form16.html",  icon: "fa-file-invoice-dollar", label: "Form 16" },
    { href: "bulk-form16.html",   icon: "fa-file-arrow-up",       label: "Bulk Form 16" },
  ];
  sb.innerHTML = `
    <div class="logo">
      <img src="assets/bccl-logo.jpeg" alt="BCCL" />
      <div><div class="t">BCCL EMS</div><div class="s">Admin Portal</div></div>
    </div>
    ${items.map(i => `
      <a class="nav-item ${path === i.href ? "active" : ""}" href="${i.href}">
        <i class="fa-solid ${i.icon}"></i><span>${i.label}</span>
      </a>`).join("")}
    <div class="spacer"></div>
    <a class="nav-item" href="#" id="logoutBtn"><i class="fa-solid fa-right-from-bracket"></i><span>Logout</span></a>
    <div class="foot">© ${new Date().getFullYear()} Bharat Coking Coal Ltd.</div>
  `;
  document.getElementById("logoutBtn").addEventListener("click", async (e) => {
    e.preventDefault();
    try { await window.SUPA.auth.signOut(); } catch (_) {}
    location.href = "index.html";
  });
})();

document.getElementById("menuToggle")?.addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});
document.getElementById("themeToggle")?.addEventListener("click", () => {
  EMS.setTheme(EMS.getTheme() === "dark" ? "light" : "dark");
});
