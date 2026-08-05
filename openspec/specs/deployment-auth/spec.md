# deployment-auth Specification

## Purpose

Codifies how the production deployment at `med.openaiua.cloud` is
gated from anonymous traffic. The deployment uses Traefik's built-in
HTTP Basic Authentication middleware, fed by an htpasswd file living
on the host. The contract guarantees that anonymous requests get
HTTP 401 with a basic-auth challenge, that valid credentials receive
HTTP 200, and that the user list is managed without rebuilding
nginx or the React bundle.

## Requirements

### Requirement: Traefik basic-auth middleware

The public hostname `med.openaiua.cloud` SHALL be reachable only
when the request supplies a valid username and password from the
host-side htpasswd file at `/root/med-auth/.htpasswd`. Anonymous or
wrong-credential requests SHALL receive HTTP 401 with a
`WWW-Authenticate: Basic realm="Med Proxy (auth required)"`
challenge header. The basic-auth middleware SHALL be configured via
Traefik Docker labels on the `med-proxy` container; the htpasswd
file SHALL live on the host filesystem (mode 600) and SHALL NOT
be committed to git.

#### Scenario: Anonymous request rejected
- **WHEN** a browser or curl hits `https://med.openaiua.cloud/`
  without an `Authorization` header
- **THEN** Traefik returns HTTP 401 with the basic-auth challenge;
  the browser shows a credentials prompt; curl exits with `401
  Unauthorized`

#### Scenario: Valid credentials accepted
- **WHEN** the same browser supplies the correct username and
  password from `/root/med-auth/.htpasswd`
- **THEN** Traefik forwards the request to `med-proxy:8083` and the
  React bundle returns HTTP 200

#### Scenario: Wrong credentials rejected
- **WHEN** a request supplies `Authorization: Basic` with an
  unknown username or a wrong password
- **THEN** Traefik returns HTTP 401 with the same challenge; the
  correct username/password is NOT leaked in any response

#### Scenario: User added via helper script
- **WHEN** the operator runs
  `/root/med-auth/add-med-user.sh <username>` and enters a password
  at the prompt
- **THEN** a bcrypt-hashed line is appended to
  `/root/med-auth/.htpasswd` and `regen-med-labels.sh` recreates
  the `med-proxy` container so Traefik's middleware picks up the
  new credential on its next probe

#### Scenario: User removed via helper script
- **WHEN** the operator runs
  `/root/med-auth/del-med-user.sh <username>`
- **THEN** the matching line is removed from
  `/root/med-auth/.htpasswd` and `regen-med-labels.sh` recreates
  the `med-proxy` container

#### Scenario: Access logs do not leak credentials
- **WHEN** a successful login completes
- **THEN** Traefik's access log remains disabled (no `Authorization`
  header in any log line); `med-proxy` nginx access log records
  `GET / HTTP/1.1` without credentials
