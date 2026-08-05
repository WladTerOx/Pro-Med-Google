## 1. New provider module

- [x] 1.1 Create `services/minimax.ts` with the same four exports as
      `services/mistral.ts` (`translateQueryToEnglish`,
      `translateTitlesToRussian`, `summarizeArticleForLayperson`,
      `optimizeQueryForPubMed`).
- [x] 1.2 Configure base URL `https://api.minimax.io/v1/chat/completions`
      and `GET /v1/models` for availability probe.
- [x] 1.3 Default model `MiniMax-M2.7-highspeed`.
- [x] 1.4 Bearer-token auth via `Authorization: Bearer <VITE_MINIMAX_API_KEY>`.
- [x] 1.5 Throw on missing key, 401, 429, 5xx (no silent return).
- [x] 1.6 Placeholder gating in `isMinimaxConfigured`: any value whose
      trimmed string starts with `MINIMAX_REPLACE_ME` is treated as
      not configured.

## 2. Orchestrator (`services/ai.ts`)

- [x] 2.1 Add `'minimax'` to the `AIProvider` union.
- [x] 2.2 Set `PROVIDER_PRIORITY = ['mistral', 'minimax', 'gemini', 'ollama']`.
- [x] 2.3 Add `case 'minimax':` to `isProviderAvailable`: probe
      `GET /v1/models`; placeholder short-circuit.
- [x] 2.4 Add `case 'minimax':` to `getUnavailableMessage`.
- [x] 2.5 Add `case 'minimax':` to the four public functions (selected +
      fallback switch in each).

## 3. UI

- [x] 3.1 `App.tsx` Settings panel — new radio button
      "MiniMax (M2.7-highspeed)" with `value="minimax"`.
- [x] 3.2 `App.tsx` AI-unavailable modal — text updated to
      "(Mistral, MiniMax, Gemini, Ollama)".

## 4. Environment

- [x] 4.1 `.env` — add `VITE_MINIMAX_API_KEY=MINIMAX_REPLACE_ME_BEFORE_DEPLOY`.
- [x] 4.2 `key/.env.local` — identical placeholder.

## 5. Validation

- [ ] 5.1 Smoke-test `GET https://api.minimax.io/v1/models` returns 200
      with the real key (PENDING real key — placeholder short-circuits
      today).
- [ ] 5.2 Verify the placeholder is detected by both
      `services/minimax.ts#isMinimaxConfigured` and
      `services/ai.ts#isProviderAvailable('minimax')` — no network call.
- [ ] 5.3 `npm run build` produces `dist/index*.js` with the new provider.
- [ ] 5.4 Local `npm run dev` (port 3009) — Settings panel shows the
      MiniMax radio; selecting it makes the orchestrator pick MiniMax.

## 6. Documentation

- [x] 6.1 `summary/audit/004-...-minimax-provider-integration.md`
- [x] 6.2 `summary/tasks/014-...-minimax-provider-integration.md`
- [x] 6.3 `CHANGELOG.md` — new entry
      `2026-08-05T21:35:00Z`.
- [x] 6.4 `openspec/changes/MiniMax-provider-integration/` archived to
      `openspec/changes/archive/2026-08-05-minimax-provider-integration/`.
