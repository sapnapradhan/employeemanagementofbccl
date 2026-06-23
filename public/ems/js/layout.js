/* layout.js - sidebar, theme toggle, auth guard (shared across app pages) */
EMS.requireAuth();
EMS.applyTheme();
EMS.seedIfEmpty();

(function buildSidebar() {
  const sb = document.getElementById("sidebar");
  if (!sb) return;
  const path = location.pathname.split("/").pop() || "dashboard.html";
  const items = [
    { href: "dashboard.html",     icon: "fa-gauge-high", label: "Dashboard" },
    { href: "add-employee.html",  icon: "fa-user-plus",  label: "Add Employee" },
    { href: "view-employee.html", icon: "fa-users",      label: "All Employees" },
  ];
  sb.innerHTML = `
    <div class="logo">
      <img src="assets/bccl-logo.jpeg" alt="BCCL" />
      <div><div class="t">BCCL EMS</div><div class="s">Employee Portal</div></div>
    </div>
    ${items.map(i => `
      <a class="nav-item ${path === i.href ? "active" : ""}" href="${i.href}">
        <i class="fa-solid ${i.icon}"></i><span>${i.label}</span>
      </a>`).join("")}
    <div class="spacer"></div>
    <a class="nav-item" href="#" id="logoutBtn"><i class="fa-solid fa-right-from-bracket"></i><span>Logout</span></a>
    <div class="foot">© ${new Date().getFullYear()} Bharat Coking Coal Ltd.</div>
  `;
  document.getElementById("logoutBtn").addEventListener("click", (e) => { e.preventDefault(); EMS.logout(); });
})();

document.getElementById("menuToggle")?.addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

document.getElementById("themeToggle")?.addEventListener("click", () => {
  EMS.setTheme(EMS.getTheme() === "dark" ? "light" : "dark");
});
