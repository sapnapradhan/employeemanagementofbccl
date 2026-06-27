/* pending.js — polls employee_profiles.status; advances to my-profile when approved */
EMS.applyTheme();

(async function () {
  const SUPA = window.SUPA;
  const { data } = await SUPA.auth.getSession();
  if (!data?.session) { location.href = "index.html"; return; }
  const user = data.session.user;
  document.getElementById("pendEmail").textContent = user.email || "(your account)";

  async function check() {
    const row = document.getElementById("statusRow");
    const txt = document.getElementById("statusText");
    row.className = "status-row pending";
    txt.textContent = "Checking status…";
    const { data: profile, error } = await SUPA
      .from("employee_profiles")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) { row.className = "status-row error"; txt.textContent = "Could not check status: " + error.message; return; }
    const status = profile?.status || "pending";
    if (status === "approved") {
      row.className = "status-row approved";
      txt.textContent = "Approved! Redirecting…";
      setTimeout(() => location.href = "my-profile.html", 600);
    } else if (status === "rejected") {
      row.className = "status-row error";
      txt.textContent = "Your request was rejected. Please contact the administrator.";
    } else {
      row.className = "status-row pending";
      txt.textContent = "Status: Pending administrator approval";
    }
  }

  document.getElementById("refreshBtn").addEventListener("click", check);
  document.getElementById("signOutBtn").addEventListener("click", async () => {
    await SUPA.auth.signOut();
    location.href = "index.html";
  });

  await check();
  setInterval(check, 15000);
})();
