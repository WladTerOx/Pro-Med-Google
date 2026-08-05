## Context

See `proposal.md` for motivation. Briefly:

- `med.openaiua.cloud` resolves via Traefik (running in Docker,
  `--providers.docker=true`, `--providers.docker.exposedbydefault=false`).
- Traefik reads routing/middleware from Docker container labels at
  startup and live-watches via the unix socket.
- The `med-proxy` container is currently the only service labelled
  with `traefik.enable=true` plus the host-rule and port-binding.
- Traefik supports a built-in `basicauth` middleware. Two ways to
  feed it credentials:
  1. inline `users` label: comma-separated `user:bcrypt_hash`
  pairs. Capped at the label-size limit (16 KB per container).
  2. mounted `usersfile`. Requires the htpasswd file to live in
     Traefik's container filesystem.

## Goals / Non-Goals

**Goals**

- Block anonymous traffic to `med.openaiua.cloud` with HTTP 401
  unless a valid username/password is supplied.
- Manage user list from a single host-side file (`.htpasswd`) with
  a small handful of helper scripts.
- Allow the user to add and remove users without rebuilding
  nginx or changing React code.
- Survive `med-proxy` container restarts (`docker rm -f med-proxy;
  docker run …`) without losing auth state.

**Non-Goals**

- Per-user audit log / session tracking.
- Single sign-on (oauth2-proxy already considered and rejected
  earlier in conversation).
- IP allowlisting (different problem, separate future change).
- A login screen in the React app (the static bundle ships to
  everyone, so any "real" auth has to be at the proxy).

## Decisions

### D1. Inline `users` label, not `usersfile`

- **Why**: avoids having to recreate the Traefik container (which
  is on host network and managed by `docker compose`). Recreating
  `med-proxy` is already a one-liner we run on every deploy, so
  passing inline users there costs no extra operational steps.
- **Trade-off**: cap is ~16 KB per label. With bcrypt-hash ~60 chars
  per user plus username, this is ~80 chars per user → comfortably
  fits ~200 users. Far more than expected.
- **Alternatives considered**: `usersfile` mounted into Traefik
  — rejected because it requires editing the Traefik compose file
  and restarting `root-traefik-1`.

### D2. Bcrypt (cost 10) via Python

- **Why**: Traefik accepts bcrypt (`$2y$10$…`) which is the modern
  standard for htpasswd. Python's `bcrypt` module is already on the
  host (verified at audit time). `htpasswd` binary is NOT installed,
  and installing `apache2-utils` is more invasive than a Python
  one-liner.
- **Trade-off**: cost 10 is roughly equivalent to the Apache
  htpasswd default — fine for interactive users (login takes
  ~100 ms), problematic if the user list grows past a few hundred.

### D3. Helper scripts in `/root/med-auth/`, OUTSIDE the repo

- **Why**: the htpasswd file MUST NOT be in git; the helper
  scripts are fine to be in git but reference the absolute path
  `/root/med-auth/` so they don't need to ship inside the bundle.
- **Trade-off**: scripts live in `/root/med-auth/` only — operator
  must `cd` there. Acceptable.

### D4. Recreate pattern via `regen-med-labels.sh`

- **Why**: every user change requires recreating the `med-proxy`
  container so Traefik's middleware re-reads the user list. Doing
  this in a single helper script keeps the operator's mental model
  clean: *edit file → run regen → done*.
- **Trade-off**: brief downtime (~1 s) on every user change.
  Acceptable for a small-team app.

## Risks / Trade-offs

- **R1** — Traefik DOES log `Authorization` request headers at INFO
  level if access-log is enabled. We DO NOT enable Traefik access
  log in this change precisely because the header carries the
  password. Mitigation: keep Traefik access log disabled; rely on
  `med-proxy` nginx `access_log /dev/stdout` (which logs the URL
  only).
- **R2** — An operator who forgets the toggle exists may try to
  `curl https://med.openaiua.cloud/` and see "401" with no hint.
  Mitigation: log a one-line announcement inside `med-auth.info`
  embedded in the challenge realm "Med Proxy (auth required)".

## Migration Plan

1. Land scripts in `/root/med-auth/`.
2. Recreate `med-proxy` with empty `users` label list (in this
   state, **every** request to `med.openaiua.cloud` returns 401
   with a basic-auth challenge; nothing is reachable).
3. Operator runs:
   ```bash
   /root/med-auth/add-med-user.sh <their-username>
   /root/med-auth/regen-med-labels.sh
   ```
4. Operator opens browser, accepts the basic-auth dialog,
   supplies the password, and confirms they can reach the React
   app.

**Rollback**: drop the `traefik.http.routers.med.middlewares` label
from the `med-proxy` run args and recreate. Auth is gone instantly.

## Open Questions

None.
