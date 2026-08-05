## MODIFIED Requirements

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
