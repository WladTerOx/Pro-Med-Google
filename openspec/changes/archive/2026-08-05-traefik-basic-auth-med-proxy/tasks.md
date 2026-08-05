## 1. Host infrastructure (out of repo)

- [x] 1.1 `mkdir -p /root/med-auth && chmod 700 /root/med-auth`
- [x] 1.2 Create empty `/root/med-auth/.htpasswd` (`chmod 600`).
      No users yet — every request gets 401.
- [x] 1.3 `/root/med-auth/add-med-user.sh <username>` — reads the
      password from a non-echo prompt, bcrypt-hashes via Python,
      appends the line, then calls `regen-med-labels.sh`.
- [x] 1.4 `/root/med-auth/del-med-user.sh <username>` — removes the
      matching line, then calls `regen-med-labels.sh`.
- [x] 1.5 `/root/med-auth/list-med-users.sh` — prints usernames
      only, never the hashes or passwords.
- [x] 1.6 `/root/med-auth/regen-med-labels.sh` — rebuilds the
      `traefik.http.middlewares.med-auth.basicauth.users` label from
      the file, recreates `med-proxy` with all other labels
      unchanged.

## 2. Traefik middleware via Docker labels

- [x] 2.1 Recreate `med-proxy` with three new labels:
      - `traefik.http.middlewares.med-auth.basicauth.users=user1:$hash,...`
      - `traefik.http.middlewares.med-auth.basicauth.realm=Med Proxy (auth required)`
      - `traefik.http.routers.med.middlewares=med-auth@docker`
- [x] 2.2 Verify `curl https://med.openaiua.cloud/` returns
      `HTTP 401` with `WWW-Authenticate: Basic realm="Med Proxy..."`
- [x] 2.3 Verify `curl -u valid:pass https://med.openaiua.cloud/`
      returns `HTTP 200` with the React bundle
- [x] 2.4 Verify `curl -u wrong:pass https://med.openaiua.cloud/`
      returns `HTTP 401` (no leakage)

## 3. Spec sync

- [x] 3.1 OpenSpec change `traefik-basic-auth-med-proxy` archived
      to `openspec/changes/archive/2026-08-05-traefik-basic-auth-med-proxy/`
- [x] 3.2 Main spec `openspec/specs/deployment-auth/spec.md` synced
      with six scenarios (anonymous reject, valid, wrong, add user,
      remove user, no-credentials-in-logs)

## 4. Documentation

- [x] 4.1 `summary/audit/007-...-traefik-basic-auth-med-proxy.md`
- [x] 4.2 `summary/tasks/018-...-manage-med-auth-users.md`
- [x] 4.3 `CHANGELOG.md` — new entry

## 5. Git

- [x] 5.1 `git add` all OpenSpec files + audit + tasks + CHANGELOG
- [x] 5.2 Commit `chore(security): gate med.openaiua.cloud behind Traefik basic-auth`
- [x] 5.3 Push to `origin/main`

## 6. Operator onboarding (informational)

- [x] 6.1 Initial state: zero users → site is locked down
- [x] 6.2 First user: `/root/med-auth/add-med-user.sh <your-name>`
- [x] 6.3 Verify in browser: `https://med.openaiua.cloud/` shows
      a basic-auth prompt; supply credentials; React UI loads
