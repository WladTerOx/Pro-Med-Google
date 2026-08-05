# ai-services Specification

## Purpose

Drives the AI provider selection and fallback behavior used by every AI
feature in the app (query translation, titles translation, query
optimization, article summarization). Establishes a single contract that
the rest of the application can rely on: at least one provider will be
tried per request, in priority order; failure of the entire chain is
surfaced to the user as an actionable error.

## Requirements

### Requirement: Provider priority chain

The system SHALL try AI providers in the order `mistral`, then `minimax`,
then `gemini`, then `ollama`. The first provider that passes an
availability check is used for all AI operations in that page-load;
subsequent operations on the same page do not re-check availability.

> ⚠️ **Priority order was changed by user request on 2026-08-05** —
> the original priority was `ollama → gemini → mistral`. See
> `design.md` §D2 for the rationale and the trade-off (paid Mistral
> first, local Ollama last).

#### Scenario: First provider healthy
- **WHEN** the user opens the app and Mistral responds to
  `GET https://api.mistral.ai/v1/models`
- **THEN** all AI operations in the page session use Mistral without
  contacting MiniMax, Gemini, or Ollama

#### Scenario: First provider exhausted, second healthy
- **WHEN** Mistral credits are depleted (HTTP 429) and MiniMax returns
  200 from its availability probe
- **THEN** the system uses MiniMax for AI operations and does not
  surface the AI-unavailable modal

#### Scenario: First two providers unavailable
- **WHEN** Mistral returns 429 and MiniMax returns 401 (invalid key)
- **THEN** the system falls through to Gemini and uses it for AI
  operations

#### Scenario: All providers unavailable
- **WHEN** all four providers fail their availability checks or return
  errors
- **THEN** the system throws `ALL_AI_PROVIDERS_UNAVAILABLE` once, on
  the first AI operation, and the UI shows a modal listing all four
  providers in their priority order

### Requirement: Provider availability test

The system SHALL test provider availability before using it. The test
MUST differentiate between "configured but exhausted" and "not
configured", and it MUST support MiniMax identically to the other
cloud providers. Ollama MAY be disabled via an env-driven toggle
(`VITE_OLLAMA_DISABLED=true`) without code edits.

#### Scenario: Mistral key present and credits available
- **WHEN** `VITE_MISTRAL_API_KEY` is set and `GET https://api.mistral.ai/v1/models` returns 200
- **THEN** Mistral is treated as available

#### Scenario: Mistral key missing
- **WHEN** `VITE_MISTRAL_API_KEY` is empty
- **THEN** Mistral is treated as unavailable and skipped

#### Scenario: Gemini credits exhausted
- **WHEN** Gemini returns `RESOURCE_EXHAUSTED` for a 1-token generation
  request
- **THEN** the provider is treated as unavailable for the rest of the
  session

#### Scenario: MiniMax key valid and probe successful
- **WHEN** `VITE_MINIMAX_API_KEY` is set to a non-placeholder value and
  `GET https://api.minimax.io/v1/models` returns 200 with
  `Authorization: Bearer <key>`
- **THEN** MiniMax is treated as available

#### Scenario: MiniMax key invalid or missing
- **WHEN** `VITE_MINIMAX_API_KEY` is empty or absent
- **THEN** MiniMax is treated as unavailable and skipped without any
  network probe

#### Scenario: Ollama disabled via env
- **WHEN** `VITE_OLLAMA_DISABLED` is the literal string `'true'` (after
  trimming whitespace)
- **THEN** `isProviderAvailable('ollama')` returns `false` immediately
  without contacting `/api/ollama/api/tags`, and the orchestrator logs
  a single line indicating the toggle is in effect

#### Scenario: Ollama probe returns true
- **WHEN** `VITE_OLLAMA_DISABLED` is not `'true'` and the host
  reachable at `VITE_OLLAMA_BASE_URL` responds with HTTP 200 to
  `GET /api/tags` via the configured proxy
- **THEN** Ollama is treated as available and used for AI operations

### Requirement: Provider operations throw on failure

Each provider's `translateQueryToEnglish`, `translateTitlesToRussian`,
`summarizeArticleForLayperson`, and `optimizeQueryForPubMed` functions
SHALL throw an error when the operation cannot complete. The functions
MUST NOT silently return the original input or a placeholder string.

#### Scenario: Gemini 4xx during translation
- **WHEN** `services/gemini.ts#translateQueryToEnglish` is invoked and
  the upstream API returns a 4xx error
- **THEN** the function throws and the orchestrator advances to the next
  provider

#### Scenario: Missing API key
- **WHEN** a provider is called without its required API key
- **THEN** the function throws `Error("<provider> API key is missing")`
  instead of returning the input unprocessed

### Requirement: AI unavailable modal

The application SHALL display a modal dialog when an AI operation ends in
`ALL_AI_PROVIDERS_UNAVAILABLE`. The modal SHALL offer a primary action
labeled "Настроить" that opens the Settings panel, and a secondary
"Закрыть" action. While the modal is visible the operation that triggered
it SHALL NOT show its own inline error. The modal text SHALL list
the configured providers in their priority order so the user knows
which providers were checked before the modal opened.

#### Scenario: Triggered from search
- **WHEN** the user submits a search and all four providers fail
- **THEN** the search spinner clears, the inline error stays empty, and
  the AI-unavailable modal appears with the copy "Ни один из
  AI-провайдеров (Mistral, MiniMax, Gemini, Ollama) не доступен."

#### Scenario: Triggered from article view
- **WHEN** the user opens an article modal and the summarization call
  receives `ALL_AI_PROVIDERS_UNAVAILABLE`
- **THEN** the article modal closes and the AI-unavailable modal opens

#### Scenario: Modal includes the new provider
- **WHEN** the user reads the AI-unavailable modal
- **THEN** the modal text mentions MiniMax by name in the provider list

### Requirement: MiniMax placeholder gating

The system SHALL treat a `VITE_MINIMAX_API_KEY` value that starts with
the literal prefix `MINIMAX_REPLACE_ME` as "not configured" and MUST
NOT perform any network call to `api.minimax.io` while that prefix is
present. This allows the integration to ship and deploy before the user
has obtained a real MiniMax API key.

#### Scenario: Placeholder short-circuits the probe
- **WHEN** `VITE_MINIMAX_API_KEY` equals `MINIMAX_REPLACE_ME_BEFORE_DEPLOY`
  (or any value with that prefix)
- **THEN** `isProviderAvailable('minimax')` returns `false` without
  contacting `https://api.minimax.io`

#### Scenario: Real key replaces the placeholder
- **WHEN** the user replaces `VITE_MINIMAX_API_KEY` with a valid key
  that does not start with `MINIMAX_REPLACE_ME`
- **THEN** the next probe call reaches `https://api.minimax.io/v1/models`
  with the user's key

### Requirement: Production hostname allowlist

The Vite dev server SHALL only accept requests with the hostnames in an
explicit allowlist. The allowlist MUST include `med.openaiua.cloud`.
Wildcard `true` MUST NOT be used because it allows any Host header.

#### Scenario: Production host accepted
- **WHEN** a request to the dev server uses `Host: med.openaiua.cloud`
- **THEN** the request is served normally

#### Scenario: Foreign host rejected
- **WHEN** a request uses `Host: attacker.example`
- **THEN** Vite rejects the request and never proxies it through the
  configured proxy routes
