/* cloud-employees.js — admin-side reader for approved cloud employee profiles.
   Uses the anon publishable key + RLS policy that exposes only status='approved'. */
window.EMSCloud = (function () {
  async function listApproved() {
    if (!window.SUPA) return [];
    try {
      const { data, error } = await window.SUPA
        .from("employee_profiles")
        .select("id,user_id,employee_code,name,father_name,dob,address,phone,aadhaar,email,qualification,designation,department,salary,photo_url,approved_at,created_at")
        .eq("status", "approved");
      if (error) { console.warn("cloud list error", error); return []; }
      const rows = data || [];
      // Sign photo URLs in parallel
      const withPhotos = await Promise.all(rows.map(async (r) => {
        let photo = null;
        if (r.photo_url) {
          try {
            const { data: s } = await window.SUPA.storage
              .from("employee-photos")
              .createSignedUrl(r.photo_url, 60 * 60);
            photo = s?.signedUrl || null;
          } catch { photo = null; }
        }
        return {
          // Shape match for admin table/dashboard:
          employeeId: r.employee_code || ("CLD-" + String(r.id).slice(0, 6).toUpperCase()),
          name: r.name || "",
          fatherName: r.father_name || "",
          dob: r.dob || "",
          address: r.address || "",
          phone: r.phone || "",
          aadhaar: r.aadhaar || "",
          email: r.email || "",
          qualification: r.qualification || "",
          designation: r.designation || "",
          department: r.department || "",
          salary: Number(r.salary || 0),
          photo,
          createdAt: r.approved_at ? new Date(r.approved_at).getTime() : (r.created_at ? new Date(r.created_at).getTime() : 0),
          __cloud: true,
        };
      }));
      return withPhotos;
    } catch (e) {
      console.warn("cloud list failed", e);
      return [];
    }
  }
  return { listApproved };
})();
