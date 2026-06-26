/* dashboard.js — merges local employees + cloud profiles for admin overview */
(async function () {
  let cloud = [];
  try { cloud = await EMS.cloud.list(); }
  catch (err) { EMS.toast("Cloud: " + err.message, "error"); }

  const local = EMS.all().map(e => ({
    name: e.name, department: e.department, designation: e.designation,
    salary: Number(e.salary || 0), createdAt: e.createdAt || 0, employeeId: e.employeeId,
    _src: "local", status: "local",
  }));
  const cloudRows = cloud.map(r => ({
    name: r.name || "(no name)", department: r.department || "Unassigned",
    designation: r.designation || "", salary: Number(r.salary || 0),
    createdAt: r.created_at ? new Date(r.created_at).getTime() : 0,
    employeeId: r.employee_code || ("EMP-" + (r.id || "").slice(0, 6)),
    _src: "cloud", status: r.status || "pending",
  }));
  const list = [...local, ...cloudRows];

  const total = list.length;
  const pending = cloudRows.filter(r => r.status === "pending").length;
  const salaried = list.filter(e => e.salary > 0);
  const avg = salaried.length ? Math.round(salaried.reduce((a, b) => a + b.salary, 0) / salaried.length) : 0;
  const byDept = {};
  list.forEach(e => { const d = e.department || "Unassigned"; byDept[d] = (byDept[d] || 0) + 1; });

  document.getElementById("kpiTotal").textContent = total;
  document.getElementById("kpiPending").textContent = pending;
  document.getElementById("kpiAvg").textContent = EMS.inr(avg);
  document.getElementById("kpiDept").textContent = Object.keys(byDept).length;

  /* Recent */
  const recent = [...list].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 6);
  const rl = document.getElementById("recentList");
  if (!recent.length) {
    rl.innerHTML = `<div class="empty">No employees yet. <a href="add-employee.html" style="color:var(--primary-2)">Add your first employee →</a></div>`;
  } else {
    rl.innerHTML = recent.map(e => {
      const tag = e._src === "cloud"
        ? `<span class="badge" style="background:#3b82f622;color:#3b82f6;border:1px solid #3b82f655;margin-left:6px">Cloud · ${e.status}</span>`
        : "";
      return `
      <div class="item">
        <div class="av">${EMS.initial(e.name)}</div>
        <div class="meta">
          <div class="n">${e.name} <span class="badge">${e.employeeId}</span> ${tag}</div>
          <div class="d">${e.designation || ""} · ${e.department || ""}</div>
        </div>
        <div style="font-weight:700">${e.salary ? EMS.inr(e.salary) : "—"}</div>
      </div>`;
    }).join("");
  }

  /* Charts */
  const css = getComputedStyle(document.documentElement);
  const text = css.getPropertyValue("--text").trim() || "#fff";
  const grid = "rgba(148,163,184,.25)";
  Chart.defaults.color = text;
  Chart.defaults.font.family = "Segoe UI, Roboto, system-ui, sans-serif";

  const top = [...list].filter(e => e.salary > 0).sort((a, b) => b.salary - a.salary).slice(0, 10);
  new Chart(document.getElementById("salaryChart"), {
    type: "bar",
    data: {
      labels: top.map(e => e.name),
      datasets: [{
        label: "Salary (₹)",
        data: top.map(e => e.salary),
        backgroundColor: "rgba(59,130,246,.65)",
        borderColor: "rgba(59,130,246,1)",
        borderWidth: 1, borderRadius: 8,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: grid } },
        y: { grid: { color: grid }, ticks: { callback: v => "₹" + v.toLocaleString("en-IN") } },
      },
    },
  });

  const palette = ["#3b82f6","#f59e0b","#10b981","#a855f7","#ef4444","#06b6d4","#eab308","#ec4899","#22c55e"];
  new Chart(document.getElementById("deptChart"), {
    type: "doughnut",
    data: {
      labels: Object.keys(byDept),
      datasets: [{
        data: Object.values(byDept),
        backgroundColor: palette.slice(0, Object.keys(byDept).length),
        borderColor: "rgba(255,255,255,.1)", borderWidth: 2,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      cutout: "60%",
    },
  });
})();
