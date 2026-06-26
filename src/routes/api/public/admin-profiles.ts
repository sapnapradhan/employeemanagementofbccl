import { createFileRoute } from '@tanstack/react-router';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-admin-password',
  };
}

function unauthorized() {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { 'content-type': 'application/json', ...corsHeaders() },
  });
}

function checkAuth(request: Request): boolean {
  const provided = request.headers.get('x-admin-password') || '';
  const expected = process.env.ADMIN_PASSWORD || 'admin123';
  return !!expected && provided === expected;
}

async function getAdmin() {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  return supabaseAdmin;
}

export const Route = createFileRoute('/api/public/admin-profiles')({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: corsHeaders() }),

      GET: async ({ request }) => {
        if (!checkAuth(request)) return unauthorized();
        const supa = await getAdmin();
        const { data, error } = await supa
          .from('employee_profiles')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'content-type': 'application/json', ...corsHeaders() },
          });
        }

        // Generate signed URLs for photos
        const rows = await Promise.all(
          (data || []).map(async (r: any) => {
            if (r.photo_url) {
              const { data: s } = await supa.storage
                .from('employee-photos')
                .createSignedUrl(r.photo_url, 60 * 60 * 24 * 7);
              return { ...r, photo_signed_url: s?.signedUrl || null };
            }
            return { ...r, photo_signed_url: null };
          }),
        );

        return new Response(JSON.stringify({ rows }), {
          status: 200,
          headers: { 'content-type': 'application/json', ...corsHeaders() },
        });
      },

      POST: async ({ request }) => {
        if (!checkAuth(request)) return unauthorized();
        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: 'invalid json' }), {
            status: 400,
            headers: { 'content-type': 'application/json', ...corsHeaders() },
          });
        }
        const { action, id, patch } = body || {};
        const supa = await getAdmin();

        if (action === 'update' && id && patch && typeof patch === 'object') {
          const allowed = [
            'name',
            'father_name',
            'dob',
            'address',
            'phone',
            'aadhaar',
            'email',
            'qualification',
            'designation',
            'department',
            'salary',
            'employee_code',
            'status',
            'approved_at',
          ];
          const clean: Record<string, any> = {};
          for (const k of allowed) if (k in patch) clean[k] = patch[k];
          const { error } = await supa.from('employee_profiles').update(clean as any).eq('id', id);
          if (error)
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { 'content-type': 'application/json', ...corsHeaders() },
            });
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'content-type': 'application/json', ...corsHeaders() },
          });
        }

        if (action === 'approve' && id) {
          const { error } = await supa
            .from('employee_profiles')
            .update({ status: "approved", approved_at: new Date().toISOString() } as any)
            .eq('id', id);
          if (error)
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { 'content-type': 'application/json', ...corsHeaders() },
            });
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'content-type': 'application/json', ...corsHeaders() },
          });
        }

        if (action === 'reject' && id) {
          const { error } = await supa
            .from('employee_profiles')
            .update({ status: "rejected", approved_at: null } as any)
            .eq('id', id);
          if (error)
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { 'content-type': 'application/json', ...corsHeaders() },
            });
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'content-type': 'application/json', ...corsHeaders() },
          });
        }

        if (action === 'delete' && id) {
          // best-effort photo cleanup
          const { data: row } = await supa
            .from('employee_profiles')
            .select('photo_url')
            .eq('id', id)
            .maybeSingle();
          if (row?.photo_url) {
            await supa.storage.from('employee-photos').remove([row.photo_url]);
          }
          const { error } = await supa.from('employee_profiles').delete().eq('id', id);
          if (error)
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { 'content-type': 'application/json', ...corsHeaders() },
            });
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'content-type': 'application/json', ...corsHeaders() },
          });
        }

        return new Response(JSON.stringify({ error: 'invalid action' }), {
          status: 400,
          headers: { 'content-type': 'application/json', ...corsHeaders() },
        });
      },
    },
  },
});
