/* dashboard.js */
window.addEventListener("ems:ready", function () {
  const list = EMS.all();
  const total = list.length;
  const salaries = list.map(e => Number(e.salary || 0));
  const max = salaries.length ? Math.max(...salaries) : 0;
  const avg = salaries.length ? Math.round(salaries.reduce((a, b) => a + b, 0) / salaries.length) : 0;
  const byDept = {};
  list.forEach(e => { byDept[e.department || "Unassigned"] = (byDept[e.department || "Unassigned"] || 0) + 1; });

  document.getElementById("kpiTotal").textContent = total;
  document.getElementById("kpiMax").textContent = EMS.inr(max);
  document.getElementById("kpiAvg").textContent = EMS.inr(avg);
  document.getElementById("kpiDept").textContent = Object.keys(byDept).length;

  /* Recent */
  const recent = [...list].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 5);
  const rl = document.getElementById("recentList");
  if (!recent.length) {
    rl.innerHTML = `<div class="empty">No employees yet. <a href="add-employee.html" style="color:var(--primary-2)">Add your first employee →</a></div>`;
  } else {
    rl.innerHTML = recent.map(e => `
      <div class="item">
        <div class="av">${EMS.initial(e.name)}</div>
        <div class="meta">
          <div class="n">${e.name} <span class="badge">${e.employeeId}</span></div>
          <div class="d">${e.designation || ""} · ${e.department || ""}</div>
        </div>
        <div style="font-weight:700">${EMS.inr(e.salary)}</div>
      </div>`).join("");
  }

  /* Charts */
  const css = getComputedStyle(document.documentElement);
  const text = css.getPropertyValue("--text").trim() || "#fff";
  const grid = "rgba(148,163,184,.25)";
  Chart.defaults.color = text;
  Chart.defaults.font.family = "Segoe UI, Roboto, system-ui, sans-serif";

  const top = [...list].sort((a, b) => Number(b.salary) - Number(a.salary)).slice(0, 10);
  new Chart(document.getElementById("salaryChart"), {
    type: "bar",
    data: {
      labels: top.map(e => e.name),
      datasets: [{
        label: "Salary (₹)",
        data: top.map(e => Number(e.salary || 0)),
        backgroundColor: "rgba(59,130,246,.65)",
        borderColor: "rgba(59,130,246,1)",
        borderWidth: 1,
        borderRadius: 8,
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
});
