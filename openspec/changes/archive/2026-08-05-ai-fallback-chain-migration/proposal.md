## Why

The current AI layer (`services/ai.ts`) only uses a manually-selected provider
from `localStorage`. When the chosen provider is broken or has no key, the
service silently returns the original query / titles, which means users see
untranslated PubMed results with no indication that AI assistance failed.
In `audit/001` all three providers were simultaneously unavailable and the
application became unusable for translation, optimization and summarization.

We introduce a **provider priority chain** (Ollama → Gemini → Mistral) so
the application can keep working whenever at least one provider responds.
When every provider fails the user must see an explicit error modal so
they can fix credentials instead of staring at a broken UI.

## What Changes

- `services/ai.ts` — add `PROVIDER_PRIORITY`, `findAvailableProvider()`, and
  per-provider availability tests (Mistral: `GET /v1/models`; Gemini:
  `models.generateContent` for `gemini-2.5-flash`). Replace silent return on
  failure with `throw new Error('ALL_AI_PROVIDERS_UNAVAILABLE')`.
- `services/gemini.ts` and `services/mistral.ts` — every public function
  (`translateQueryToEnglish`, `translateTitlesToRussian`,
  `summarizeArticleForLayperson`, `optimizeQueryForPubMed`) now **throws**
  on missing key or upstream error. No silent fallback to original text.
  Mistral model upgraded: `mistral-tiny` (deprecated) →
  `mistral-small-latest`.
- `services/ollama.ts` — re-enable diagnostic `console.log` for base URL
  and model so on-call can verify env wiring without rebuilding.
- `App.tsx` + `components/ArticleModal.tsx` — on
  `ALL_AI_PROVIDERS_UNAVAILABLE` show a modal prompting the user to open
  Settings; close any open `ArticleModal` that triggered the failure.
- `vite.config.ts` — `allowedHosts` is now an explicit list
  `['med.openaiua.cloud']` (was `true`) to document the production
  hostname and drop the browser's "not allowed" warning on prod.

## Capabilities

### New Capabilities

- `ai-services` — provider discovery, availability test, priority-based
  selection, and the user-facing error state when no provider works.

### Modified Capabilities

- _(none — `openspec/specs/` is empty, this is the first capability)_

## Impact

- **Code**: `services/{ai,gemini,mistral,ollama}.ts`,
  `components/ArticleModal.tsx`, `App.tsx`, `vite.config.ts`.
- **APIs / contracts**: All four exported functions in `services/gemini.ts`
  and `services/mistral.ts` change contract — they now throw on failure
  instead of returning original text. Downstream callers must use
  `try { ... } catch { /* fallback UI */ }`. The orchestrator in
  `services/ai.ts` already wraps them and handles `ALL_AI_PROVIDERS_UNAVAILABLE`.
- **Dependencies**: no new dependencies.
- **Runtime**: startup adds two HTTPS probes (one to Mistral `/models`, one
  to Gemini `generateContent`) on first AI use. Each has its own short
  timeout in the underlying SDK / `fetch`. Latency added only when called
  the first time per page load; subsequent calls hit the same provider.
