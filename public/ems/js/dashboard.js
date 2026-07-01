/* dashboard.js — admin dashboard, Supabase-only. */
(async function () {
  const SUPA = window.SUPA;

  /* KPI + widgets */
  const [profs, pendingReqs, pendingPan, pendingAad, notifs] = await Promise.all([
    SUPA.from("employee_profiles").select("id,name,employee_code,department,designation,salary,pan_number,aadhaar_number,pan_verified_at,aadhaar_verified_at,submitted_at,status,created_at").order("created_at",{ascending:false}),
    SUPA.from("profile_change_requests").select("id,user_id,submitted_at,changes,status",{count:"exact"}).eq("status","pending").order("submitted_at",{ascending:false}).limit(5),
    SUPA.from("employee_profiles").select("id",{count:"exact",head:true}).not("pan_number","is",null).is("pan_verified_at",null),
    SUPA.from("employee_profiles").select("id",{count:"exact",head:true}).not("aadhaar_number","is",null).is("aadhaar_verified_at",null),
    SUPA.from("notifications").select("*").order("created_at",{ascending:false}).limit(6),
  ]);

  const list = profs.data || [];
  const salaries = list.map(e => Number(e.salary || 0));
  const max = salaries.length ? Math.max(...salaries) : 0;
  const avg = salaries.length ? Math.round(salaries.reduce((a,b)=>a+b,0)/salaries.length) : 0;
  const byDept = {};
  list.forEach(e => { byDept[e.department || "Unassigned"] = (byDept[e.department || "Unassigned"] || 0) + 1; });

  document.getElementById("kpiTotal").textContent = list.length;
  document.getElementById("kpiMax").textContent   = EMS.inr(max);
  document.getElementById("kpiAvg").textContent   = EMS.inr(avg);
  document.getElementById("kpiDept").textContent  = Object.keys(byDept).length;

  document.getElementById("kPendReq").textContent = pendingReqs.count ?? (pendingReqs.data?.length || 0);
  document.getElementById("kPendPan").textContent = pendingPan.count ?? 0;
  document.getElementById("kPendAad").textContent = pendingAad.count ?? 0;

  /* Pending requests widget */
  const pw = document.getElementById("pendingWidget");
  const preqs = pendingReqs.data || [];
  if (!preqs.length) {
    pw.innerHTML = `<div class="empty"><i class="fa-solid fa-circle-check" style="color:#10b981"></i> &nbsp;No pending change requests.</div>`;
  } else {
    const byUser = {}; list.forEach(p => byUser[p.user_id || ""] = p);
    pw.innerHTML = preqs.map(r => {
      const p = list.find(x => x.user_id === r.user_id) || {};
      const nFields = Object.keys(r.changes || {}).length;
      return `<div class="item">
        <div class="av">${(p.name||"?").trim().charAt(0).toUpperCase()}</div>
        <div class="meta">
          <div class="n">${escapeHtml(p.name||"—")} <span class="badge">${escapeHtml(p.employee_code||"")}</span> <span class="pill warn">${nFields} change${nFields===1?"":"s"}</span></div>
          <div class="d">Submitted ${r.submitted_at ? new Date(r.submitted_at).toLocaleString() : ""}</div>
        </div>
        <a class="btn ghost" href="approvals.html"><i class="fa-solid fa-up-right-from-square"></i> Review</a>
      </div>`;
    }).join("");
  }

  /* Recent notifications */
  const nw = document.getElementById("notifWidget");
  const ns = notifs.data || [];
  if (!ns.length) {
    nw.innerHTML = `<div class="empty">No recent notifications.</div>`;
  } else {
    nw.innerHTML = ns.map(n => `<div class="item">
      <div class="av"><i class="fa-solid fa-bell"></i></div>
      <div class="meta"><div class="n">${escapeHtml(n.title)}</div><div class="d">${escapeHtml(n.body||"")}</div></div>
      <div style="font-size:12px;color:var(--text-muted)">${new Date(n.created_at).toLocaleString()}</div>
    </div>`).join("");
  }

  /* Recent employees */
  const rl = document.getElementById("recentList");
  const recent = list.slice(0, 5);
  rl.innerHTML = recent.length ? recent.map(e => `
    <div class="item">
      <div class="av">${EMS.initial(e.name)}</div>
      <div class="meta">
        <div class="n">${escapeHtml(e.name||"—")} <span class="badge">${escapeHtml(e.employee_code||"")}</span></div>
        <div class="d">${escapeHtml(e.designation||"")} · ${escapeHtml(e.department||"")}</div>
      </div>
      <div style="font-weight:700">${EMS.inr(e.salary)}</div>
    </div>`).join("") : `<div class="empty">No employees yet.</div>`;

  /* Charts */
  const css = getComputedStyle(document.documentElement);
  const text = css.getPropertyValue("--text").trim() || "#fff";
  const grid = "rgba(148,163,184,.25)";
  Chart.defaults.color = text;
  Chart.defaults.font.family = "Segoe UI, Roboto, system-ui, sans-serif";
  const top = [...list].sort((a,b) => Number(b.salary||0)-Number(a.salary||0)).slice(0,10);
  new Chart(document.getElementById("salaryChart"), {
    type:"bar",
    data:{ labels: top.map(e=>e.name||"—"),
      datasets:[{ label:"Salary (₹)", data: top.map(e=>Number(e.salary||0)),
        backgroundColor:"rgba(59,130,246,.65)", borderColor:"rgba(59,130,246,1)", borderWidth:1, borderRadius:8 }]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false} },
      scales:{ x:{grid:{color:grid}}, y:{grid:{color:grid}, ticks:{callback:v=>"₹"+v.toLocaleString("en-IN")}} }}
  });
  const palette = ["#3b82f6","#f59e0b","#10b981","#a855f7","#ef4444","#06b6d4","#eab308","#ec4899","#22c55e"];
  new Chart(document.getElementById("deptChart"), {
    type:"doughnut",
    data:{ labels:Object.keys(byDept),
      datasets:[{ data:Object.values(byDept),
        backgroundColor:palette.slice(0,Object.keys(byDept).length),
        borderColor:"rgba(255,255,255,.1)", borderWidth:2 }]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{position:"bottom"} }, cutout:"60%" }
  });

  function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
})();
