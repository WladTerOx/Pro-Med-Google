## Purpose

Drives the AI provider selection and fallback behavior used by every AI
feature in the app (query translation, titles translation, query
optimization, article summarization). Establishes a single contract that
the rest of the application can rely on: at least one provider will be
tried per request, in priority order; failure of the entire chain is
surfaced to the user as an actionable error.

## ADDED Requirements

### Requirement: Provider priority chain

The system SHALL try AI providers in the order `ollama`, then `gemini`,
then `mistral`. The first provider that passes an availability check is
used for all AI operations in that page-load; subsequent operations on
the same page do not re-check availability.

#### Scenario: First provider healthy
- **WHEN** the user opens the app and Ollama responds to a connectivity
  check
- **THEN** all AI operations in the page session use Ollama without
  contacting Gemini or Mistral

#### Scenario: First two providers unavailable
- **WHEN** Ollama is unreachable and Gemini responds `RESOURCE_EXHAUSTED`
- **THEN** the system uses Mistral for AI operations and does not surface
  the AI-unavailable modal

#### Scenario: All providers unavailable
- **WHEN** all three providers fail their availability checks or return
  errors
- **THEN** the system throws `ALL_AI_PROVIDERS_UNAVAILABLE` once, on the
  first AI operation, and the UI shows a modal

### Requirement: Provider availability test

The system SHALL test provider availability before using it. The test MUST
differentiate between "configured but exhausted" and "not configured".

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
it SHALL NOT show its own inline error.

#### Scenario: Triggered from search
- **WHEN** the user submits a search and all providers fail
- **THEN** the search spinner clears, the inline error stays empty, and
  the AI-unavailable modal appears

#### Scenario: Triggered from article view
- **WHEN** the user opens an article modal and the summarization call
  receives `ALL_AI_PROVIDERS_UNAVAILABLE`
- **THEN** the article modal closes and the AI-unavailable modal opens

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
