/* user-layout.js — sidebar/topbar for signed-in Supabase users */
EMS.applyTheme();

(async function () {
  const { data } = await window.SUPA.auth.getSession();
  if (!data?.session) { location.href = "index.html"; return; }
  const user = data.session.user;

  const name = (user.user_metadata && user.user_metadata.full_name) || (user.email || "User").split("@")[0];
  const el = (id) => document.getElementById(id);
  if (el("userName"))    el("userName").textContent = name;
  if (el("userEmail"))   el("userEmail").textContent = user.email || "";
  if (el("userInitial")) el("userInitial").textContent = (name || "U").trim().charAt(0).toUpperCase();

  const sb = el("sidebar");
  if (sb) {
    const path = location.pathname.split("/").pop() || "my-profile.html";
    const items = [
      { href: "my-profile.html", icon: "fa-id-card",             label: "My Profile" },
      { href: "form16.html",     icon: "fa-file-invoice-dollar", label: "My Form 16" },
    ];
    sb.innerHTML = `
      <div class="logo">
        <img src="assets/bccl-logo.jpeg" alt="BCCL" />
        <div><div class="t">BCCL EMS</div><div class="s">Employee Portal</div></div>
      </div>
      ${items.map(i => `<a class="nav-item ${path === i.href ? "active" : ""}" href="${i.href}"><i class="fa-solid ${i.icon}"></i><span>${i.label}</span></a>`).join("")}
      <div class="spacer"></div>
      <a class="nav-item" href="#" id="logoutBtn"><i class="fa-solid fa-right-from-bracket"></i><span>Logout</span></a>
      <div class="foot">© ${new Date().getFullYear()} Bharat Coking Coal Ltd.</div>
    `;
    document.getElementById("logoutBtn").addEventListener("click", async (e) => {
      e.preventDefault();
      await window.SUPA.auth.signOut();
      location.href = "index.html";
    });
  }

  el("menuToggle")?.addEventListener("click", () => el("sidebar").classList.toggle("open"));
  el("themeToggle")?.addEventListener("click", () => EMS.setTheme(EMS.getTheme() === "dark" ? "light" : "dark"));
})();
