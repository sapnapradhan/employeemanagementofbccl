/* login.js — handles Admin (localStorage) and Employee (Supabase) auth */
EMS.applyTheme();

async function routeByStatus(userId) {
  try {
    const { data: profile } = await window.SUPA
      .from("employee_profiles")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle();
    const status = profile?.status || "pending";
    location.href = status === "approved" ? "my-profile.html" : "pending-approval.html";
  } catch {
    location.href = "pending-approval.html";
  }
}

// If already authed (admin or user), bounce to the right page
(async () => {
  if (EMS.isAuthed()) { location.href = "dashboard.html"; return; }
  try {
    const { data } = await window.SUPA.auth.getSession();
    if (data?.session) { await routeByStatus(data.session.user.id); return; }
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
      return showAlert("userAlert", "Check your email to confirm your account, then sign in.");
    }

    // Create the pending profile row (RLS allows: auth.uid() = user_id)
    const uid = data.session.user.id;
    const code = "EMP-" + uid.slice(0, 6).toUpperCase();
    const { error: insErr } = await window.SUPA.from("employee_profiles").insert({
      user_id: uid,
      employee_code: code,
      name,
      email,
      status: "pending",
    });
    if (insErr && !/duplicate|unique/i.test(insErr.message)) {
      return showAlert("userAlert", "Account created but profile setup failed: " + insErr.message);
    }
    EMS.toast("Account created — pending approval");
    setTimeout(() => location.href = "pending-approval.html", 500);
  } else {
    const { data, error } = await window.SUPA.auth.signInWithPassword({ email, password: pass });
    if (error) return showAlert("userAlert", error.message);
    EMS.toast("Signed in");
    setTimeout(() => routeByStatus(data.user.id), 300);
  }
});

/* ---------- ADMIN ---------- */
const adminForm = document.getElementById("adminForm");
adminForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const u = document.getElementById("aUser").value.trim();
  const p = document.getElementById("aPass").value;
  if (EMS.login(u, p)) {
    EMS.seedIfEmpty();
    location.href = "dashboard.html";
  } else {
    showAlert("adminAlert", "Invalid admin credentials.");
  }
});

function showAlert(id, msg) {
  const a = document.getElementById(id);
  a.querySelector("span").textContent = " " + msg;
  a.classList.add("show");
}
function hideAlert(id) { document.getElementById(id).classList.remove("show"); }
