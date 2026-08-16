## Purpose

Codifies how MCP clients — both local and remote — authenticate to
the MCP server at `mcp.openaiua.cloud`. The contract guarantees that
every public request carries a valid bearer token, that tokens can
be issued and revoked without rebuilding the server, and that the
secret material never leaves the host filesystem.

## ADDED Requirements

### Requirement: Bearer token authentication

The public MCP endpoint at `https://mcp.openaiua.cloud/mcp` SHALL
require a header `Authorization: Bearer <token>` on every request.
Requests without a valid bearer token SHALL receive HTTP 401 with
the JSON-RPC error `{"code": -32001, "message": "Missing or invalid
bearer token"}`. The loopback address (`127.0.0.1`, `::1`) SHALL
be exempt from bearer authentication so local scripts and dev
tools can connect without setup.

#### Scenario: Valid token accepted
- **WHEN** a client sends `POST /mcp` with the header
  `Authorization: Bearer <known-token>` and a valid JSON-RPC body
- **THEN** the request is processed and the response carries HTTP 200

#### Scenario: Missing token rejected
- **WHEN** a client sends `POST /mcp` without an `Authorization`
  header
- **THEN** the server returns HTTP 401 with the JSON-RPC error
  described above

#### Scenario: Wrong token rejected
- **WHEN** a client sends `Authorization: Bearer <wrong-token>`
- **THEN** the server returns HTTP 401 with the same JSON-RPC error
  and the same body (no information leak about which tokens exist)

#### Scenario: Loopback exempt
- **WHEN** a client on `127.0.0.1` sends `POST /mcp` without an
  `Authorization` header
- **THEN** the request is processed normally

### Requirement: Token storage on the host

Active tokens SHALL be stored in `/root/med-mcp/tokens.json` on the
host filesystem. The file MUST be mode `600` and owned by the user
that runs the MCP server. The file MUST NOT be committed to git
and MUST be excluded by `.gitignore`. The file format SHALL be a
JSON object mapping token ID to
`{ "secret": "<plain-text-or-bcrypt-hash>", "createdAt": "<ISO8601>",
"label": "<human-readable>", "lastUsedAt": "<ISO8601-or-null>" }`.

#### Scenario: File permissions
- **WHEN** the operator inspects `/root/med-mcp/tokens.json`
- **THEN** the file mode is `600` and the file is owned by the same
  user that runs the MCP server process

#### Scenario: File is gitignored
- **WHEN** the operator runs `git check-ignore /root/med-mcp/tokens.json`
  from the repo root
- **THEN** the path is reported as ignored

#### Scenario: Schema validity
- **WHEN** the server reads the file at startup
- **THEN** any entry that does not match the schema above is logged
  at `error` level and skipped (no crash)

### Requirement: Token issuance via helper script

The operator SHALL be able to issue a new token by running
`/root/med-mcp/issue-mcp-token.sh <label>`. The script SHALL generate
a cryptographically random token (≥ 32 bytes, base64url-encoded),
append it to `tokens.json` with `createdAt` set to the current
ISO 8601 timestamp and `lastUsedAt: null`, and print the new token
to stdout **once**. The script SHALL NOT print the token to any log
file or to a re-readable location.

#### Scenario: Issue a new token
- **WHEN** the operator runs `/root/med-mcp/issue-mcp-token.sh my-agent`
- **THEN** the script appends a new entry to `tokens.json` and
  prints the raw token to stdout exactly once

#### Scenario: Token uniqueness
- **WHEN** the script is called twice in succession
- **THEN** the two tokens are different (no collisions)

### Requirement: Token revocation via helper script

The operator SHALL be able to revoke a token by running
`/root/med-mcp/revoke-mcp-token.sh <token-id>`. The script SHALL
remove the matching entry from `tokens.json` and exit `0`. A
non-existent token ID SHALL exit `1` with a clear message.

#### Scenario: Revoke existing token
- **WHEN** the operator runs `revoke-mcp-token.sh <id>` for a token
  that exists
- **THEN** the entry is removed and the next request from that
  bearer token returns HTTP 401

#### Scenario: Revoke unknown token
- **WHEN** the operator runs `revoke-mcp-token.sh <unknown-id>`
- **THEN** the script exits with status `1` and a message
  `Token not found`

### Requirement: Token listing

The operator SHALL be able to list active tokens by running
`/root/med-mcp/list-mcp-tokens.sh`. The script SHALL print a
human-readable table of `id`, `label`, `createdAt`, `lastUsedAt`
and SHALL NOT print the raw `secret` value.

#### Scenario: Listing two tokens
- **WHEN** the operator runs `list-mcp-tokens.sh` and
  `tokens.json` contains two entries
- **THEN** the script prints two rows and the table does NOT contain
  the `secret` field

### Requirement: Traefik routing and CORS

The `mcp.openaiua.cloud` hostname SHALL be routed by Traefik to the
MCP server container. The Traefik router SHALL NOT enable HTTP
Basic Authentication (only the `med.openaiua.cloud` router does).
CORS SHALL be configured to allow `POST` and `OPTIONS` from any
origin so agents in browsers can call the MCP server during
development; in production, server-side agents are the primary
consumer and CORS is permissive by default.

#### Scenario: DNS resolves
- **WHEN** a client runs `dig mcp.openaiua.cloud`
- **THEN** the returned A-record matches the same IP as
  `med.openaiua.cloud`

#### Scenario: Wrong hostname rejected
- **WHEN** a request arrives with `Host: anything-else.example`
- **THEN** Traefik returns HTTP 421 and the MCP server is not invoked

#### Scenario: CORS preflight
- **WHEN** a browser sends `OPTIONS /mcp` with
  `Origin: http://localhost:3009` and
  `Access-Control-Request-Method: POST`
- **THEN** the response contains
  `Access-Control-Allow-Origin: *` and
  `Access-Control-Allow-Methods: POST, OPTIONS`

### Requirement: No logging of secrets

The server, the helper scripts, and the Traefik access logs SHALL
NOT log bearer tokens, AI provider keys, or PubMed API keys at any
log level. The structured-logging requirement from the MCP server
spec applies; helper scripts redirect any accidental print of a
token to `/dev/null` after the one-shot stdout print.

#### Scenario: Auth header in logs
- **WHEN** a request arrives with
  `Authorization: Bearer sk-abcDEFG…`
- **THEN** the log line shows `Authorization: Bearer [REDACTED]`
  with the original value replaced

#### Scenario: Issue script after stdout
- **WHEN** `issue-mcp-token.sh` finishes
- **THEN** the only place where the raw token is recorded is the
  caller's terminal; the script does not write to any other file
  or log
