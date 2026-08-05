## Why

`https://med.openaiua.cloud/` is currently reachable by anyone on
the public internet (HTTP 200 to anonymous curl, confirmed at audit
time). The user wants to restrict access to a hand-picked list of
people.

There is no application-level auth — `med-proxy` is a static nginx
serving `dist/`. The only sane place to enforce access is the reverse
proxy (Traefik), which already terminates TLS and routes to
`med-proxy:8083` via Docker labels.

## What Changes

- **New capability** `deployment-auth` with one requirement:
  `Traefik basic-auth middleware`. Codifies the contract that the
  public hostname MUST be reachable only after the user supplies a
  valid username/password pair from a host-side htpasswd file.

- **New scripts** in `/root/med-auth/` (host-side, **never** in the
  repo):
  - `add-med-user.sh <username>` — prompts for password (no echo),
    appends a bcrypt-hashed line via `python3 -c "import bcrypt"`,
    restarts `med-proxy` so Traefik picks up the new label list.
  - `del-med-user.sh <username>` — removes the line, restarts
    `med-proxy`.
  - `list-med-users.sh` — prints usernames only (never hashes).
  - `regen-med-labels.sh` — rebuilds the
    `traefik.http.middlewares.med-auth.basicauth.users` label content
    from the file and triggers a recreate of `med-proxy`.

- **`med-proxy` container recreation** with a new set of Traefik
  labels:
  - `traefik.http.middlewares.med-auth.basicauth.users=user1:$2y$...,user2:$2y$...`
  - `traefik.http.middlewares.med-auth.basicauth.realm=Med Proxy`
  - `traefik.http.routers.med.middlewares=med-auth@docker`

- **No code change** in the React/Vite app.

## Capabilities

### New Capabilities

- `deployment-auth`: covers the contract that the production host
  (`med.openaiua.cloud`) is gated by HTTP Basic Auth backed by a
  server-side htpasswd file. The single requirement is
  `Traefik basic-auth middleware`, with three scenarios covering
  correct credentials, missing credentials, and stale creds.

### Modified Capabilities

- _(none)_

## Impact

- **Code**: 0 lines added to repo code. Auth lives in Traefik
  middleware labels on the `med-proxy` container.
- **Host files** (out of repo): `/root/med-auth/` directory with
  `.htpasswd`, three helper scripts. Mode 700 on the directory,
  mode 600 on the file.
- **APIs / contracts**: the public hostname now requires
  `Authorization: Basic <base64(user:password)>`. Anonymous
  requests get HTTP 401 with `WWW-Authenticate: Basic realm="Med Proxy"`.
- **Dependencies**: none added. `python3`+`bcrypt` is already on
  the host (verified at audit time).
- **Runtime**: every browser session shows a one-time basic-auth
  prompt; successful auth is held by the browser for the realm until
  the user clears credentials.
- **Rollback**: drop the `traefik.http.routers.med.middlewares` label
  line on `med-proxy` and recreate. Auth disappears.

## Out of scope

- Per-request audit logs of who logged in (Traefik access log can
  record `Authorization` headers but is **NOT** enabled in this
  change to avoid logging secrets).
- Two-factor auth or OAuth — covered by other variants the user
  was offered in the prior conversation (oauth2-proxy, Cloudflare
  Access).
- IP-based allowlist — also tracked separately as a future
  capability if needed.
