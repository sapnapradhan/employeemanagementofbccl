/* supabase-client.js - initializes Supabase JS from CDN.
   Loaded via <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   which exposes window.supabase.createClient. */
(function () {
  const SUPABASE_URL = "https://aopizeyserswyycgsbzn.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_r2N8n48wWoA8KpichWfy_Q_v6nDmmsH";
  if (!window.supabase || !window.supabase.createClient) {
    console.error("Supabase JS failed to load from CDN");
    return;
  }
  // Re-assign window.supabase to the client instance (keeps usage simple).
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "bccl_ems_sb_auth" },
  });
  window.sb = client;
})();
