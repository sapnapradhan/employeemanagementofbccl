## Diagnose preview "Not Found"

The earlier preview screenshot showed a "Lovable proxy error 500", and now it's 404 — that points at the live preview sandbox, not a code logic bug. Possible causes:
1. Dev server crashed or restarted into a bad state.
2. You navigated to a path that doesn't exist (e.g. `/ems/something.html` typo, or a TanStack route that isn't defined).
3. A static file under `public/ems/` is being requested with the wrong path.

## Steps
1. Read the sandbox dev-server logs (`/tmp/sandbox-state.db` daemon log for `vite`) for the last error.
2. `curl` the preview origin for `/`, `/ems/`, `/ems/index.html`, `/ems/my-profile.html` to see which actually 404 vs 200.
3. If the dev server is wedged, restart it once via `code--restart_dev_server`.
4. If the 404 is from a real missing path (e.g. `my-profile.html` referenced as `/my-profile.html` instead of `/ems/my-profile.html`), fix the link in the page that points there.
5. Report findings — no speculative code changes.

No schema or feature changes; this is a preview/debug pass.
