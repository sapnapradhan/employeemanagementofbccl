/* login.js — handles Admin (localStorage) and Employee (Supabase) auth */
EMS.applyTheme();

// If already authed (admin or user), bounce to the right page
(async () => {
  if (EMS.isAuthed()) { location.href = "dashboard.html"; return; }
  try {
    const { data } = await window.SUPA.auth.getSession();
    if (data?.session) { location.href = "my-profile.html"; return; }
  } catch (_) {}
})();

/* ---------- Tabs ---------- */
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".pane").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("pane" + btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1)).classList.add("active");
  });
});

/* ---------- USER: signin / signup toggle ---------- */
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

const userForm = document.getElementById("userForm");
userForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert("userAlert");
  const email = document.getElementById("uEmail").value.trim();
  const pass  = document.getElementById("uPass").value;

  if (pass.length < 6) return showAlert("userAlert", "Password must be at least 6 characters.");

  if (mode === "signup") {
    const name  = document.getElementById("uName").value.trim();
    const pass2 = document.getElementById("uPass2").value;
    if (!name)             return showAlert("userAlert", "Please enter your full name.");
    if (pass !== pass2)    return showAlert("userAlert", "Passwords do not match.");

    const { data, error } = await window.SUPA.auth.signUp({
      email, password: pass,
      options: { data: { full_name: name }, emailRedirectTo: window.location.origin + "/ems/index.html" }
    });
    if (error) return showAlert("userAlert", error.message);
    if (!data.session) {
      // Auto-confirm is on; this branch is unlikely but handle anyway.
      return showAlert("userAlert", "Check your email to confirm your account.", "info");
    }
    EMS.toast("Account created!");
    setTimeout(() => location.href = "my-profile.html", 500);
  } else {
    const { error } = await window.SUPA.auth.signInWithPassword({ email, password: pass });
    if (error) return showAlert("userAlert", error.message);
    EMS.toast("Signed in");
    setTimeout(() => location.href = "my-profile.html", 400);
  }
});

/* ---------- ADMIN ---------- */
const adminForm = document.getElementById("adminForm");
adminForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert("adminAlert");
  const u = document.getElementById("aUser").value.trim();
  const p = document.getElementById("aPass").value;
  if (u !== "admin" || !p) return showAlert("adminAlert", "Invalid admin credentials.");
  // Verify against server using the configured ADMIN_PASSWORD secret
  try {
    const r = await fetch("/api/public/admin-profiles", { headers: { "x-admin-password": p } });
    if (r.status === 401) return showAlert("adminAlert", "Invalid admin credentials.");
    if (!r.ok) return showAlert("adminAlert", "Server error. Try again.");
  } catch {
    return showAlert("adminAlert", "Network error. Try again.");
  }
  EMS.login(u, p);
  EMS.seedIfEmpty();
  location.href = "dashboard.html";
});

function showAlert(id, msg) {
  const a = document.getElementById(id);
  a.querySelector("span").textContent = " " + msg;
  a.classList.add("show");
}
function hideAlert(id) { document.getElementById(id).classList.remove("show"); }
