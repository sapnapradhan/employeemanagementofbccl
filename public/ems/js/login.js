/* login.js */
EMS.applyTheme();
if (EMS.isAuthed()) location.href = "dashboard.html";

const form = document.getElementById("loginForm");
const alertBox = document.getElementById("loginAlert");

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const u = document.getElementById("username").value.trim();
  const p = document.getElementById("password").value;
  if (EMS.login(u, p)) {
    EMS.seedIfEmpty();
    location.href = "dashboard.html";
  } else {
    alertBox.querySelector("span").textContent = " Invalid username or password.";
    alertBox.classList.add("show");
  }
});
