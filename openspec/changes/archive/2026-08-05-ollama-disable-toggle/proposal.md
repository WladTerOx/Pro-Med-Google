## Why

The Ollama host (`VITE_OLLAMA_BASE_URL=http://162.19.248.57:11434`) has
been unreachable for at least the duration tracked in audit/001 and
audit/002 (connection timeout > 8 s on every probe). Every AI call
now triggers a network fetch to a dead host, which:

1. Adds latency on each AI operation while the orchestrator waits
   for Ollama's probe to time out;
2. Pollutes the browser console with
   `Ollama connection test failed: ...`;
3. Has no workaround short of editing source code.

The user asked for a temporary stub: `заглуши пока ollama`. The stub
must be **reversible without code edits** — flipping an env var.

## What Changes

- **`services/ai.ts`**, `case 'ollama'` in `isProviderAvailable()`:
  before calling `ollama.checkOllamaConnection()`, check whether the
  env var `VITE_OLLAMA_DISABLED` is set to `'true'`. If so, log a
  short message and return `false` immediately, skipping the
  network round-trip.
- **`.env` / `key/.env.local`** (gitignored): new line
  `VITE_OLLAMA_DISABLED=true`. Comment explains how to re-enable.

## Capabilities

### New Capabilities

- _(none — this is an ops-toggle, not a new domain capability)_

### Modified Capabilities

- `ai-services`: the requirement **Provider availability test**
  gains one scenario: *"Ollama disabled via env"*; the requirement
  *Provider operations throw on failure* is unchanged.

## Impact

- **Code**: 5 added lines in `services/ai.ts:38-44`.
- **APIs / contracts**: the orchestrator's
  `isProviderAvailable('ollama')` contract is unchanged when
  `VITE_OLLAMA_DISABLED` is not `'true'`. With the toggle on,
  Ollama becomes permanently "unavailable" in this page-load — the
  same observable effect as `checkOllamaConnection()` returning
  `false` after a timeout, just faster.
- **Dependencies**: none.
- **Runtime**: with the toggle on, the
  `fetch('/api/ollama/api/tags')` call and the surrounding
  timeout are skipped. AI calls finish faster.
- **Rollback**: set `VITE_OLLAMA_DISABLED=false` (or remove the
  line) in `.env`, rebuild, redeploy.

## Out of scope

- Removing the hardcoded fallback URL `192.168.50.250:11434`
  in `services/ollama.ts` (that's tasks/011 / tasks/012.8).
- Repairing the Ollama host at `162.19.248.57:11434`
  (that's tasks/008 / tasks/012.6 — an infrastructure task).
- Adding the same toggle to other providers.
