## Context

See `proposal.md` for motivation. Restate the constraint landscape briefly:

- `services/ai.ts` already implements a 3-provider fallback with
  priority order, `isProviderAvailable()` probes per provider, and a
  shared contract: each provider's public functions throw on failure
  and the orchestrator catches + advances. The shape extends cleanly
  to N providers.
- MiniMax's API is **OpenAI-compatible**: `POST /v1/chat/completions`
  with `Authorization: Bearer <key>`. Model discovery (`GET /v1/models`)
  also exists and is the cheapest probe. Documentation:
  https://platform.minimax.io/docs/api-reference/text-chat-openai.
- `.env` is **gitignored** — secret handling stays in the env file,
  never in source or in any committed file.
- The Settings panel in `App.tsx` lets the user pin a specific
  provider; an entry must exist for MiniMax or the user cannot select
  it even if availability probes pass.

## Goals / Non-Goals

**Goals**

- Add a fourth provider with the same public contract as the other
  three, so the existing UI/UX works without modification beyond the
  radio button and the modal text.
- Keep the "no silent fallback" guarantee from the
  `ai-fallback-chain-migration` change: every provider's functions
  throw on error; the orchestrator catches and advances.
- Allow the integration to ship **before** the user has a real API key
  — placeholder detection prevents accidental billing from a stub
  value.

**Non-Goals**

- Adding streaming output, prompt caching, function tools, the
  `thinking` parameter, or any other MiniMax-specific capability beyond
  plain chat completions.
- Migrating existing providers off the OpenAI-compatible transport.
- Persisting the user's manual provider choice across browsers
  (`localStorage` already does this and is out of scope).

## Decisions

### D1. Mirror `mistral.ts` rather than extend a generic OpenAI-client

- **Why**: `services/mistral.ts` already implements the same four
  functions over the OpenAI-compatible chat-completions transport, with
  the same throw-on-failure contract and the same three-step (system /
  user / model) message layout. Copying that file as a template and
  swapping transport constants is the minimum-risk approach.
- **Trade-off**: a future fifth OpenAI-compatible provider would still
  duplicate. Acceptable because each provider can tweak its system
  prompt or model name; extracting a shared client is a separate
  refactor.

### D2. Provider priority order chosen by user: `mistral → MiniMax → gemini → ollama`

- **Why**: explicit user choice. Documented as-is.
- **Trade-off** ⚠️: this order is **unusual** and **not optimal**
  against the original design intent of `ai-fallback-chain-migration`,
  which was "local Ollama first, then cheapest cloud, then paid
  fallback of last resort". Putting **paid Mistral first** means
  Mistral prepay credits are consumed before cheaper options are
  tried; **Ollama last** means the local free model is only consulted
  when all three cloud providers fail or are absent. The user is
  probably testing or expressing a preference; we honour it but flag
  it loudly here and in `summary/audit/004-…`.
- **Alternatives considered**: keeping
  `['ollama', 'minimax', 'gemini', 'mistral']` (the documented default
  from the previous change). Rejected because the user asked
  explicitly for the custom order.

### D3. Default model: `MiniMax-M2.7-highspeed`

- **Why**: low latency and cost-effective on text-only medical tasks.
  Source: `platform.minimax.io/docs/guides/models-intro.md` lists
  `MiniMax-M2.7-highspeed` with the description "Same performance as
  M2.7, Significantly faster inference, Low latency".
- **Alternatives considered**: `MiniMax-M3` (frontier, multimodal,
  overkill for query translation), `MiniMax-M2.7` (default speed).
  `M2.7-highspeed` wins on latency per token.

### D4. Placeholder gating (`MINIMAX_REPLACE_ME_BEFORE_DEPLOY`)

- **Why**: allow the change to be merged and deployed without a real
  key. The placeholder string is detected in two places:
  `services/minimax.ts#isMinimaxConfigured` and
  `services/ai.ts#isProviderAvailable('minimax')` — both short-circuit
  before any network call.
- **Trade-off**: the user must remember to swap the placeholder before
  the next deploy. Recorded as step 14.6 in
  `summary/tasks/014-minimax-provider-integration.md`.

## Risks / Trade-offs

- **R1** — Order `mistral → minimax → gemini → ollama` burns Mistral
  prepay credits on the first AI use per page-load, even when Ollama
  is up. → Mitigation: documented here; the user can change
  `PROVIDER_PRIORITY` in `services/ai.ts:24` to a different order at
  any time.
- **R2** — Placeholder gating relies on string-prefix matching
  (`startsWith('MINIMAX_REPLACE_ME')`). A user setting the key to e.g.
  `MINIMAX_REPLACE_ME_actual_key` would still be treated as
  placeholder. → Use a different prefix or remove the entry entirely
  when replacing.
- **R3** — Mistral and MiniMax have similar OpenAI-compatible
  transports; future code refactors that try to share a client would
  need to keep error semantics distinguishable (`Mistral API error:`
  vs `MiniMax API error:`).

## Migration Plan

1. Code lands (already done in this change). Working tree clean.
2. User replaces placeholder in `.env` and `key/.env.local`:
   ```bash
   sed -i 's|^VITE_MINIMAX_API_KEY=.*|VITE_MINIMAX_API_KEY=<real key>|' .env
   sed -i 's|^VITE_MINIMAX_API_KEY=.*|VITE_MINIMAX_API_KEY=<real key>|' key/.env.local
   ```
3. `npm run build` → sync `dist/` → `docker build -t root-med-proxy`
   → recreate `med-proxy` container.
4. Hard-refresh Chrome to bypass cached bundle.
5. Verify on `https://med.openaiua.cloud` that MiniMax appears in the
   Settings panel and that translations now flow through MiniMax when
   Mistral is rate-limited.

**Rollback**: revert `services/minimax.ts`, drop the MiniMax arms from
`services/ai.ts`, drop the radio in `App.tsx`, restore the modal text.
None of the other providers' behavior changes.

## Open Questions

None. The user has answered all material decisions (`A`, `C`, `D`, `E`
from the fixation session + the three confirmations for this change).
