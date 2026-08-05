## Context

See `proposal.md` for motivation. Briefly:

- Ollama probe (`fetch('/api/ollama/api/tags')`) currently times out
  every call because the upstream host is down. The fallback chain
  eventually lands on Mistral or MiniMax (both working), but every
  AI request pays the timeout cost on the Ollama slot first.
- The user wants a **temporary** stub. The artifact must be
  reversible without touching code, so that when the Ollama host is
  fixed the toggle can be flipped in `.env` and the system resumes.

## Goals / Non-Goals

**Goals**

- Add an env-driven, no-code-edit way to disable Ollama's probe.
- Preserve the existing `isProviderAvailable()` contract; Ollama
  should simply **return `false` as if the network probe had failed**
  — the rest of the orchestrator must not need to know about the
  toggle.
- Log a one-line message so observers can tell the difference between
  "env disabled" and "host unreachable".

**Non-Goals**

- Reparing the underlying Ollama host (separate infra change).
- Adding the same toggle for the other providers (no need: their
  availability tests are already fast — under 3 s).
- Removing the `192.168.50.250:11434` fallback URL in
  `services/ollama.ts` (not relevant to this change).

## Decisions

### D1. Trigger string: the literal `'true'` (case-insensitive via `.trim()`)

- **Why**: matches Vite's convention of treating env-var strings
  literally. A typo (`VITE_OLLAMA_DISABLED=True` or `=1`) won't
  accidentally disable Ollama — operators must write the literal
  lowercase `'true'`. Use `.trim()` so trailing whitespace in
  `.env` doesn't break it.
- **Alternatives considered**: `=== '1'`, `import.meta.env` boolean
  semantics — rejected to keep the env format explicit and grep-able.

### D2. Check at the orchestrator (`services/ai.ts`), not in `services/ollama.ts`

- **Why**: keeps the toggle observable from the orchestrator's
  log line ("Ollama disabled via VITE_OLLAMA_DISABLED"), so a
  future maintainer reading the console immediately understands
  why Ollama never succeeds. If the toggle lived inside
  `services/ollama.ts`, the user would only see the ordinary
  "Ollama connection test result: false" and would not know
  whether it's the toggle or the network.
- **Trade-off**: any future second caller of
  `ollama.checkOllamaConnection()` still hits the network. There
  is no second caller today (grep verified).

### D3. No new requirement; only an ADDED scenario to existing requirement

- **Why**: `Provider availability test` (already in
  `openspec/specs/ai-services/spec.md`) describes the
  configuration matrix. Adding *"Ollama disabled via env"* as a
  fifth scenario captures the toggle without inventing a new
  capability that would in practice be a single paragraph.

## Risks / Trade-offs

- **R1** — If the operator forgets the toggle exists, they could
  chase a "why doesn't Ollama work" issue and waste time on the
  proxy/host. → The single-line log
  ("Ollama disabled via VITE_OLLAMA_DISABLED") plus the comment
  in `.env` are the only mitigation.

## Migration Plan

1. The toggle is **already set to `true`** in `.env` /
   `key/.env.local`. No env migration needed.
2. Land the code change.
3. `npm run build` → rsync → Docker rebuild → container recreate.
4. Confirm on the live site that the console shows
   `"Ollama disabled via VITE_OLLAMA_DISABLED"` exactly once per
   AI operation, instead of the prior timeout error.

**Rollback**: set `VITE_OLLAMA_DISABLED=false`, rebuild, redeploy.
No code reversion needed.

## Open Questions

None.
