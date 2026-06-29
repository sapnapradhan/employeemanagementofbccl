/* login.js — Employee (Supabase) + Admin (Supabase + admin role) */
EMS.applyTheme();

(async () => {
  // If already signed in to Supabase, send admins to dashboard, users to profile
  try {
    const { data } = await window.SUPA.auth.getSession();
    if (data?.session) {
      const isAdmin = await checkIsAdmin();
      location.href = isAdmin ? "dashboard.html" : "my-profile.html";
      return;
    }
  } catch (_) {}
  // Legacy local-admin session
  if (EMS.isAuthed()) { location.href = "dashboard.html"; }
})();

async function checkIsAdmin() {
  try {
    const { data, error } = await window.SUPA.rpc("is_admin");
    if (error) return false;
    return !!data;
  } catch { return false; }
}

/* ---------- Tabs ---------- */
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".pane").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("pane" + btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1)).classList.add("active");
  });
});

/* ---------- USER ---------- */
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
    fName.style.display = signup ? "" : "none";
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

/* ---------- ADMIN ---------- */
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
    return showAlert("adminAlert", "This account does not have admin access. Use the Claim admin link below if no admin exists yet.");
  }
  // Also mark legacy local-admin so existing pages work
  sessionStorage.setItem("bccl_ems_auth", "1");
  EMS.seedIfEmpty();
  EMS.toast("Welcome, admin");
  setTimeout(() => location.href = "dashboard.html", 300);
});

document.getElementById("claimAdminLink").addEventListener("click", async (e) => {
  e.preventDefault();
  hideAlert("adminAlert");
  const { data: sess } = await window.SUPA.auth.getSession();
  if (!sess?.session) {
    return showAlert("adminAlert", "Sign in first (Employee tab) using the account you want to promote, then return here and click again.");
  }
  const { data, error } = await window.SUPA.rpc("claim_admin_if_none");
  if (error) return showAlert("adminAlert", error.message);
  if (data === true) {
    sessionStorage.setItem("bccl_ems_auth", "1");
    EMS.seedIfEmpty();
    EMS.toast("You are now admin");
    setTimeout(() => location.href = "dashboard.html", 400);
  } else {
    showAlert("adminAlert", "An admin already exists. Ask them to grant you the admin role.");
  }
});

function showAlert(id, msg) {
  const a = document.getElementById(id);
  a.querySelector("span").textContent = " " + msg;
  a.classList.add("show");
}
function hideAlert(id) { document.getElementById(id).classList.remove("show"); }
