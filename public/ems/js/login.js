/* login.js - Supabase email/password sign in & sign up */
EMS.applyTheme();

(async () => {
  const s = await EMS.getSession();
  if (s) location.href = "dashboard.html";
})();

const form = document.getElementById("loginForm");
const alertBox = document.getElementById("loginAlert");
const showAlert = (msg, type = "error") => {
  alertBox.querySelector("span").textContent = " " + msg;
  alertBox.className = "alert show " + type;
};

let mode = "signin"; // or "signup"
const modeBtns = document.querySelectorAll("[data-mode]");
const submitBtn = document.getElementById("submitBtn");
modeBtns.forEach(b => b.addEventListener("click", () => {
  mode = b.dataset.mode;
  modeBtns.forEach(x => x.classList.toggle("active", x === b));
  submitBtn.innerHTML = mode === "signin"
    ? '<i class="fa-solid fa-right-to-bracket"></i> Sign In'
    : '<i class="fa-solid fa-user-plus"></i> Create Account';
  alertBox.classList.remove("show");
}));

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  if (password.length < 6) return showAlert("Password must be at least 6 characters.");
  submitBtn.disabled = true;
  try {
    if (mode === "signin") {
      await EMS.signIn(email, password);
      EMS.seedIfEmpty();
      location.href = "dashboard.html";
    } else {
      const data = await EMS.signUp(email, password);
      if (data.session) {
        EMS.seedIfEmpty();
        location.href = "dashboard.html";
      } else {
        showAlert("Account created. Check your email to confirm, then sign in.", "info");
      }
    }
  } catch (err) {
    showAlert(err?.message || "Authentication failed.");
  } finally {
    submitBtn.disabled = false;
  }
});
