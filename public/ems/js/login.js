/* login.js — Supabase auth for both Employees and the BCCL admin.
 * Admin role is granted by the database trigger on signup for BCCL.CONFIG.ADMIN_EMAIL.
 * No self-promotion / claim-admin flow exists.
 */
EMS.applyTheme();

const ADMIN_EMAIL = (window.BCCL?.CONFIG?.ADMIN_EMAIL) || "admin@bccl.com";

(async () => {
  try {
    const { data } = await window.SUPA.auth.getSession();
    if (data?.session) {
      const isAdmin = await checkIsAdmin();
      location.href = isAdmin ? "dashboard.html" : "my-profile.html";
    }
  } catch (_) {}
})();

async function checkIsAdmin() {
  try {
    const { data, error } = await window.SUPA.rpc("is_admin");
    if (error) return false;
    return !!data;
  } catch { return false; }
}

/* Tabs */
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".pane").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("pane" + btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1)).classList.add("active");
  });
});

/* USER (employee) */
let mode = "signin";
const fName = document.getElementById("fName");
const fConfirm = document.getElementById("fConfirm");
const submitLabel = document.querySelector("#userSubmit span");

document.querySelectorAll(".seg-btn").forEach(b => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".seg-btn").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    mode = b.dataset.mode;
    const signup = mode === "signup";
    fName.style.display    = signup ? "" : "none";
    fConfirm.style.display = signup ? "" : "none";
    submitLabel.textContent = signup ? "Create Account" : "Sign In";
    hideAlert("userAlert");
  });
});

document.getElementById("userForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert("userAlert");
  const email = document.getElementById("uEmail").value.trim();
  const pass  = document.getElementById("uPass").value;
  if (pass.length < 6) return showAlert("userAlert", "Password must be at least 6 characters.");
  if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    return showAlert("userAlert", "That email is reserved for the admin — please use the Admin tab.");
  }

  if (mode === "signup") {
    const name  = document.getElementById("uName").value.trim();
    const pass2 = document.getElementById("uPass2").value;
    if (!name)          return showAlert("userAlert", "Please enter your full name.");
    if (pass !== pass2) return showAlert("userAlert", "Passwords do not match.");
    const { data, error } = await window.SUPA.auth.signUp({
      email, password: pass,
      options: { data: { full_name: name }, emailRedirectTo: window.location.origin + "/ems/index.html" }
    });
    if (error) return showAlert("userAlert", error.message);
    if (!data.session) return showAlert("userAlert", "Check your email to confirm your account.");
    EMS.toast("Account created!");
    setTimeout(() => location.href = "my-profile.html", 400);
  } else {
    const { error } = await window.SUPA.auth.signInWithPassword({ email, password: pass });
    if (error) return showAlert("userAlert", error.message);
    const isAdmin = await checkIsAdmin();
    EMS.toast("Signed in");
    setTimeout(() => location.href = isAdmin ? "dashboard.html" : "my-profile.html", 300);
  }
});

/* ADMIN */
document.getElementById("adminForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert("adminAlert");
  const email = document.getElementById("aEmail").value.trim();
  const pass  = document.getElementById("aPass").value;
  const { error } = await window.SUPA.auth.signInWithPassword({ email, password: pass });
  if (error) return showAlert("adminAlert", error.message);
  const isAdmin = await checkIsAdmin();
  if (!isAdmin) {
    await window.SUPA.auth.signOut();
    return showAlert("adminAlert",
      "This account does not have admin access. Admin roles are granted only by the database.");
  }
  EMS.toast("Welcome, admin");
  setTimeout(() => location.href = "dashboard.html", 300);
});

/* One-time admin setup: only visible when NO admin exists in the DB.
   The password is whatever the user types into the admin password field —
   never a hardcoded value. */
async function refreshAdminSetupVisibility() {
  const wrap = document.getElementById("seedAdminWrap");
  const hint = document.getElementById("adminHint");
  try {
    const { data, error } = await window.SUPA.rpc("admin_exists");
    const exists = error ? true : !!data; // fail closed
    wrap.style.display  = exists ? "none" : "";
    hint.style.display  = exists ? "none" : "";
  } catch {
    wrap.style.display = "none";
    hint.style.display = "none";
  }
}
refreshAdminSetupVisibility();

document.getElementById("seedAdminBtn").addEventListener("click", async () => {
  hideAlert("adminAlert");
  const email = ADMIN_EMAIL;
  const pass  = document.getElementById("aPass").value;
  if (!pass || pass.length < 6) {
    return showAlert("adminAlert", "Enter a password (min 6 chars) in the field above — it becomes the permanent admin password.");
  }

  // Re-check server-side to prevent races / tampering.
  const { data: exists, error: chkErr } = await window.SUPA.rpc("admin_exists");
  if (chkErr) return showAlert("adminAlert", chkErr.message);
  if (exists) {
    await refreshAdminSetupVisibility();
    return showAlert("adminAlert", "Admin account already exists.");
  }

  const { data, error } = await window.SUPA.auth.signUp({
    email, password: pass,
    options: {
      data: { full_name: "BCCL Admin" },
      emailRedirectTo: window.location.origin + "/ems/index.html"
    }
  });
  if (error) return showAlert("adminAlert", error.message);
  await refreshAdminSetupVisibility();
  if (!data.session) {
    return showAlert("adminAlert", "Admin created — confirm the email (if required) then sign in with the password you just set.");
  }
  EMS.toast("Admin created — signing in…");
  setTimeout(() => location.href = "dashboard.html", 500);
});

function showAlert(id, msg) {
  const a = document.getElementById(id);
  a.querySelector("span").textContent = " " + msg;
  a.classList.add("show");
}
function hideAlert(id) { document.getElementById(id).classList.remove("show"); }
