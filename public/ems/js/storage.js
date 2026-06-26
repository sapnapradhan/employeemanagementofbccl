/* storage.js - LocalStorage helpers + shared utilities */
const EMS = (() => {
  const KEY_EMP = "bccl_ems_employees";
  const KEY_SEQ = "bccl_ems_seq";
  const KEY_AUTH = "bccl_ems_auth";
  const KEY_THEME = "bccl_ems_theme";

  const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY_EMP)) || []; }
    catch { return []; }
  };
  const write = (list) => localStorage.setItem(KEY_EMP, JSON.stringify(list));

  const nextId = () => {
    const list = read();
    let max = parseInt(localStorage.getItem(KEY_SEQ) || "0", 10);
    list.forEach(e => {
      const n = parseInt((e.employeeId || "").replace(/\D/g, ""), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    const next = max + 1;
    return "EMP" + String(next).padStart(3, "0");
  };
  const commitId = (id) => {
    const n = parseInt((id || "").replace(/\D/g, ""), 10);
    if (!isNaN(n)) localStorage.setItem(KEY_SEQ, String(n));
  };

  const all = () => read();
  const get = (id) => read().find(e => e.employeeId === id);
  const add = (emp) => {
    const list = read();
    if (list.some(e => e.employeeId === emp.employeeId)) {
      throw new Error("Duplicate Employee ID");
    }
    list.push(emp);
    write(list);
    commitId(emp.employeeId);
  };
  const update = (id, emp) => {
    const list = read();
    const i = list.findIndex(e => e.employeeId === id);
    if (i === -1) throw new Error("Employee not found");
    list[i] = { ...list[i], ...emp, employeeId: id };
    write(list);
  };
  const remove = (id) => write(read().filter(e => e.employeeId !== id));

  const seedIfEmpty = () => {
    if (read().length) return;
    const samples = [
      { name: "Rahul Kumar", fatherName: "Ramesh Kumar", department: "IT", designation: "Software Engineer", salary: 65000, phone: "9876543210", email: "rahul.kumar@bccl.in", aadhaar: "123412341234", qualification: "B.Tech CSE", dob: "1995-04-12", address: "Dhanbad, Jharkhand" },
      { name: "Priya Sharma", fatherName: "Suresh Sharma", department: "HR", designation: "HR Manager", salary: 82000, phone: "9876501234", email: "priya.sharma@bccl.in", aadhaar: "234523452345", qualification: "MBA HR", dob: "1990-08-22", address: "Dhanbad, Jharkhand" },
      { name: "Amit Singh", fatherName: "Vikas Singh", department: "Mining", designation: "Mine Engineer", salary: 95000, phone: "9123456780", email: "amit.singh@bccl.in", aadhaar: "345634563456", qualification: "B.Tech Mining", dob: "1988-01-09", address: "Jharia, Dhanbad" },
      { name: "Neha Verma", fatherName: "Arun Verma", department: "Finance", designation: "Accountant", salary: 58000, phone: "9988776655", email: "neha.verma@bccl.in", aadhaar: "456745674567", qualification: "M.Com", dob: "1993-11-30", address: "Bokaro" },
      { name: "Sanjay Patel", fatherName: "Hari Patel", department: "Safety", designation: "Safety Officer", salary: 72000, phone: "9001122334", email: "sanjay.patel@bccl.in", aadhaar: "567856785678", qualification: "Diploma Safety", dob: "1985-07-19", address: "Dhanbad" },
    ];
    samples.forEach(s => add({ employeeId: nextId(), createdAt: Date.now() - Math.random()*1e9, ...s }));
  };

  /* Auth — admin password is whatever the server's ADMIN_PASSWORD secret is.
     We accept it client-side then verify via the Cloud API on first use. */
  const KEY_PASS = "bccl_ems_admin_pass";
  const login = (u, p) => {
    if (u !== "admin" || !p) return false;
    sessionStorage.setItem(KEY_AUTH, "1");
    sessionStorage.setItem(KEY_PASS, p);
    return true;
  };
  const adminPass = () => sessionStorage.getItem(KEY_PASS) || "";
  const isAuthed = () => sessionStorage.getItem(KEY_AUTH) === "1";
  const logout = () => { sessionStorage.removeItem(KEY_AUTH); sessionStorage.removeItem(KEY_PASS); location.href = "index.html"; };
  const requireAuth = () => { if (!isAuthed()) location.href = "index.html"; };

  /* Cloud admin API (calls /api/public/admin-profiles with x-admin-password) */
  const cloud = {
    async list() {
      const r = await fetch("/api/public/admin-profiles", { headers: { "x-admin-password": adminPass() } });
      if (r.status === 401) throw new Error("Admin password rejected by server");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed");
      return j.rows || [];
    },
    async act(action, id, patch) {
      const r = await fetch("/api/public/admin-profiles", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-password": adminPass() },
        body: JSON.stringify({ action, id, patch }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Failed");
      return j;
    },
  };

  /* Theme */
  const getTheme = () => localStorage.getItem(KEY_THEME) || "dark";
  const setTheme = (t) => {
    localStorage.setItem(KEY_THEME, t);
    document.documentElement.setAttribute("data-theme", t);
    const btn = document.getElementById("themeToggle");
    if (btn) btn.innerHTML = t === "dark" ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
  };
  const applyTheme = () => setTheme(getTheme());

  /* Utils */
  const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
  const initial = (s) => (s || "?").trim().charAt(0).toUpperCase();
  const toast = (msg, type = "success") => {
    const t = document.getElementById("toast");
    if (!t) return;
    t.className = "toast " + type;
    t.innerHTML = `<i class="fa-solid ${type === "success" ? "fa-circle-check" : "fa-circle-exclamation"}"></i> ${msg}`;
    requestAnimationFrame(() => t.classList.add("show"));
    clearTimeout(window.__toastT);
    window.__toastT = setTimeout(() => t.classList.remove("show"), 2400);
  };

  return { all, get, add, update, remove, nextId, seedIfEmpty,
    login, isAuthed, logout, requireAuth, adminPass, cloud,
    getTheme, setTheme, applyTheme,
    inr, initial, toast };
})();
