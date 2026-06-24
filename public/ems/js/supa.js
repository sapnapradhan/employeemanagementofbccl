/* supa.js — initializes Lovable Cloud (Supabase) client via UMD CDN.
   Load AFTER the @supabase/supabase-js UMD script tag. */
(function () {
  const SUPABASE_URL = "https://aopizeyserswyycgsbzn.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_r2N8n48wWoA8KpichWfy_Q_v6nDmmsH";

  if (!window.supabase || !window.supabase.createClient) {
    console.error("Supabase UMD not loaded");
    return;
  }
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: window.localStorage,
      persistSession: true,
      autoRefreshToken: true,
      storageKey: "bccl-ems-supabase-auth",
    },
  });
  window.SUPA = client;
})();
