## Context

See `proposal.md` for motivation. Quick restatement of starting state:

- `services/ai.ts` previously read `localStorage` for a chosen provider and
  delegated to one of three modules; there was no fallback.
- `services/{gemini,mistral}.ts` swallowed upstream errors and returned the
  untranslated input — observers had no signal that AI failed.
- `services/ollama.ts` did log base URL / model only behind commented-out
  `console.log`, so diagnostic data was hidden in production builds.
- The UI in `App.tsx` had no specific handling for "all AI is down"; the
  same generic error path was used as for PubMed network errors.

## Goals / Non-Goals

**Goals**

- Always-present AI assistance: at least one provider should be tried per
  user request, ordered by reliability/cost (local Ollama first).
- Bounded failure path: when the chain is exhausted, surface a modal that
  tells the user which providers are affected and points them to Settings.
- Drop silent-fallback semantics in cloud providers so the orchestrator can
  actually observe failure and try the next provider.

**Non-Goals**

- Adding new providers beyond the existing three.
- Streaming output, retry/back-off at the network layer, or persisting
  per-session provider preference to `localStorage`. (User can keep
  overriding manually via the Settings panel already present in the UI.)
- Re-architecting the proxy / Vite layer (separate concern, see
  `tasks/006` for the `proxyRes` memory leak fix already landed).

## Decisions

### D1. Priority order — `ollama → gemini → mistral`

- **Why**: Ollama is local, free, and has no prepay credits to deplete.
  Gemini is cheap and fast (`gemini-2.5-flash`). Mistral is the paid
  fallback of last resort. The order matches the audit/001 finding that
  Ollama, when it works, is preferred; when it doesn't, the cheapest
  cloud should burn credits next.
- **Alternatives considered**: putting Mistral first because the audit
  showed it as the only working cloud — rejected because Mistral prepay
  could deplete and we'd lose the only working provider later.

### D2. Per-provider availability test before first call

- **Why**: A Mistral / Gemini key may be present but the account may be
  out of credits. The orchestrator needs a definitive "this provider is
  broken right now" signal before triggering fallback UI.
- **Method**:
  - **Mistral** → `GET https://api.mistral.ai/v1/models` with
    `Authorization: Bearer <key>`; `response.ok` ⇒ available.
  - **Gemini** → `ai.models.generateContent({ model: 'gemini-2.5-flash',
    contents: 'Hello' })`; any non-`RESOURCE_EXHAUSTED` / non-quota error
    is treated as unavailable.
  - **Ollama** → existing `checkOllamaConnection()` ping.
- **Alternatives considered**: optimistic "key is present ⇒ available"
  check (rejected — key present does not imply credit present, see
  audit/001).

### D3. `throw` instead of silent return in cloud providers

- **Why**: silent return prevents `services/ai.ts` from knowing whether
  the call succeeded. After this change the orchestrator catches the
  thrown error, advances to the next provider, and only after the chain
  is exhausted surfaces `ALL_AI_PROVIDERS_UNAVAILABLE`.
- **Trade-off**: any future caller of these functions must wrap in
  `try/catch`. Documented in `Impact` of proposal.md.

### D4. `ALL_AI_PROVIDERS_UNAVAILABLE` is the singular error contract

- The orchestrator in `services/ai.ts` throws this exact string.
- The UI components (`App.tsx`, `ArticleModal`) string-compare the error
  message and open the dedicated modal. Other errors fall through to the
  generic message.

## Risks / Trade-offs

- **R1** — Ollama may be reachable over the WireGuard/proxy but not have
  the requested model loaded. `checkOllamaConnection()` only verifies
  the HTTP layer. → Mitigation: callers receive the raw error from
  ollama.ts, which surfaces model-not-found; manual fallback handles it
  via the same `try` boundary.
- **R2** — A transient Gemini `RESOURCE_EXHAUSTED` mid-session will mark
  Gemini unavailable for the rest of the session. → Mitigation: page
  refresh resets the cached availability; the next user reload re-tests.
  Long-term: surface a "retry" affordance in the modal.
- **R3** — Two HTTPS probes on first AI use add ~0.5-2s latency before
  the user sees the first answer. → Acceptable because the alternative
  is silent failure. Could later be optimised with cached availability
  timestamps; deliberately out of scope for this change.

## Migration Plan

This change is **already implemented** and being retroactively documented.
Deployment requires no migration steps beyond the regular rebuild:

1. `npm run build` — produces `dist/` with the new `services/ai.ts` and
   dependency chain.
2. Copy `dist/` into `/root/med-proxy/dist/`.
3. `docker build -t root-med-proxy .` (image contains `dist`).
4. Recreate `med-proxy` container so the new bundle is served.
5. `pm2 restart med-app --update-env` if PM2 is used.

**Rollback**: revert `services/ai.ts` to a previous commit and rebuild.
`services/{gemini,mistral}.ts` callers already expect `try/catch`, so
silently returning the original text remains a viable rollback target.

## Open Questions

None. All material decisions are settled; remaining items (provider UI
toggle persistence, streaming output) are out of scope.
