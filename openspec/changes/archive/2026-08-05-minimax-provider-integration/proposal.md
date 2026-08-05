## Why

The AI service abstraction has three providers (Ollama, Gemini, Mistral).
The user wants to add a fourth — **MiniMax** — an OpenAI-compatible
provider accessed at `https://api.minimax.io`. Adding MiniMax widens
the fallback chain, gives the user a second paid cloud option behind
Mistral, and (per the user's stated intent) puts Mistral first and
MiniMax second so Mistral prepay is consumed first.

Adding a provider is a behavior-level change: the priority list grows,
the modal text grows, and a new THIRD-party API is contacted on page
load. This change retroactively documents that addition.

## What Changes

- **New module** `services/minimax.ts`: OpenAI-compatible client with the
  same four functions as the other providers (`translateQueryToEnglish`,
  `translateTitlesToRussian`, `summarizeArticleForLayperson`,
  `optimizeQueryForPubMed`). All four `throw` on missing key or upstream
  error so the orchestrator can advance to the next provider. Default
  model: `MiniMax-M2.7-highspeed` (chosen for cost-efficiency on
  text-only tasks; alternatives `MiniMax-M3`, `MiniMax-M2.7`).
- **`services/ai.ts` orchestrator**:
  - `AIProvider` union grows: `'ollama' | 'gemini' | 'mistral' | 'minimax'`.
  - `PROVIDER_PRIORITY` reordered per user request: `['mistral', 'minimax', 'gemini', 'ollama']`. This puts the paid Mistral first and the local Ollama last — see "Risks / Trade-offs" in `design.md`.
  - New `isProviderAvailable('minimax')` probe: `GET https://api.minimax.io/v1/models` with `Authorization: Bearer <key>`; `response.ok` ⇒ available. A literal placeholder starting with `MINIMAX_REPLACE_ME` is treated as "not configured" so a stub value never silently passes the gate.
  - All four public functions (`translateQueryToEnglish`,
    `translateTitlesToRussian`, `summarizeArticleForLayperson`,
    `optimizeQueryForPubMed`) gain a `case 'minimax':` arm in both the
    "selected provider" switch and the "fallback" switch.
- **`App.tsx`**:
  - AI-unavailable modal text now lists all four providers in priority
    order: "Ни один из AI-провайдеров (Mistral, MiniMax, Gemini, Ollama)
    не доступен."
  - Settings panel gains a "MiniMax (M2.7-highspeed)" radio button so
    the user can manually pin the active provider to MiniMax.
- **`.env` / `key/.env.local`**:
  - New line `VITE_MINIMAX_API_KEY=MINIMAX_REPLACE_ME_BEFORE_DEPLOY`.
    The string starts with `MINIMAX_REPLACE_ME` and is detected by both
    `services/minimax.ts#isMinimaxConfigured` and
    `services/ai.ts#isProviderAvailable('minimax')` to short-circuit
    before any network call. Until the user replaces the placeholder,
    MiniMax behaves as "unavailable".
- **Capability `ai-services`** (modified):
  - `Provider priority chain` scenario list now lists four providers.
  - `Provider availability test` adds a MiniMax scenario.
  - `AI unavailable modal` text is updated to match the new copy.
  - A new requirement `**Provider five: MiniMax placeholder gating**`
    documents the placeholder-detection behavior.

## Capabilities

### New Capabilities

- _(none — MiniMax is a fourth instance of the existing
  provider-discovery contract, not a new kind of capability)_

### Modified Capabilities

- `ai-services`: priority chain grows from 3 to 4 providers; modal text
  grows; placeholder-gating requirement added.

## Impact

- **Code**: new `services/minimax.ts`; modifications in
  `services/ai.ts`, `App.tsx`; `.env` and `key/.env.local` (gitignored).
- **APIs / contracts**: unchanged from external perspective — same four
  exported functions (`translateQueryToEnglish`,
  `translateTitlesToRussian`, `summarizeArticleForLayperson`,
  `optimizeQueryForPubMed`); one extra internal arm.
- **Dependencies**: none.
- **Runtime**: on first AI use, `isProviderAvailable('minimax')`
  performs a `GET https://api.minimax.io/v1/models` (one HTTPS RTT).
  Rejected keys or placeholder values short-circuit before the network
  call. After first successful probe the page keeps using MiniMax for
  the rest of the session.
- **Costs**: until a real key is provided, MiniMax is treated as
  unavailable and **no billing occurs**. After a real key is added,
  MiniMax will be billed per the user's choice of model —
  `MiniMax-M2.7-highspeed` is positioned as cost-efficient on
  `platform.minimax.io/docs/guides/pricing-paygo.md`.
