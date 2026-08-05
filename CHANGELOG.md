# Changelog

All notable changes to Pro-Med-Google are documented here. Entries are kept
in chronological order (oldest first). Secrets, tokens, and `.env`
contents MUST NOT appear here.

Format: `- `<ISO-8601 timestamp with TZ>` — <one-line description>.`

---

## Upstream history (before this changelog existed)

This changelog is bootstrapped on **2026-08-05** from the existing git
log, the local audit history in `summary/audit/`, and the inline notes
in `summary/tasks/`. The intent is **not** to retroactively describe
every prior commit, only to (a) make future timestamps authoritative
and (b) seed a single canonical ledger.

Pre-2026-08-05 commits (kept for traceability, summarized from `git log
--oneline`):

- `f28a7a4` — Added Ollama + markdown output in modal.
- `4f12226` — Added reset button.
- `0a84890` — Added multi-line input.
- `2248733` — Added AI-based optimisation for long PubMed queries.
- `62c62f4` — Refreshed README with full project docs.
- `6e33235` — Added proxy for Ollama API in Vite to bypass CORS.
- `3e120ce` — Commented production logs, fixed proxy config.
- `78b796c` — Fixed project startup on server: package.json, vite.config.ts.
- `62e3989` — Added Gemini as fallback AI.
- `b2732a2` — Added various models.

---

## 2026

- `2026-08-05T19:31:33Z` — Audit `001`: all three AI providers (Ollama, Gemini, Mistral) unavailable; Mistral key rotated and upgraded to `mistral-small-latest`. PM2 process and Docker container rebuilt and confirmed serving updated bundle. Documented long-standing deployment quirks (two-step build, memory leak in proxy, tab-character risk, hardcoded Ollama IP).
- `2026-08-05T20:47:38Z` — Defined 11 infra-fix tasks (`summary/tasks/001–011`) covering favicon, pm2 ecosystem, log cleanup, vite preview script, deployment automation, proxy memory leak, tab character, Ollama host investigation, Gemini prepay, safe commit/push, hardcoded Ollama fallback removal.
- `2026-08-05T20:48:00Z` — Added `ecosystem.config.cjs` for pm2 `med-stack`.
- `2026-08-05T21:10:00Z` — **AI-fallback migration**: `services/ai.ts` now runs a priority chain `ollama → gemini → mistral`, with per-provider availability probes (Mistral `GET /v1/models`, Gemini `generateContent('Hello')`); all four AI entry-points in `services/gemini.ts` and `services/mistral.ts` now throw on failure instead of silently returning the original input. New `ALL_AI_PROVIDERS_UNAVAILABLE` error triggers a dedicated modal in `App.tsx` reachable from both the search path and the article-view path. OpenSpec change `ai-fallback-chain-migration` archived; new main spec `openspec/specs/ai-services/spec.md` covers provider priority, availability test, throw-on-failure contract, AI-unavailable modal, and Vite `allowedHosts` allowlist. `vite.config.ts`: `allowedHosts` hardened to `['med.openaiua.cloud']`; `proxy.on('proxyRes')` lifted out of `proxy.on('proxyReq')` callback to fix listener memory leak; inbound `Origin` echoed back to Ollama. `.gitignore` now excludes `.env` and `/key/`. New fixation/tasks infrastructure (`FIXATION.md`, `.pi/skills/*`, `.pi/prompts/opsx-*.md`).
- `2026-08-05T21:10:00Z` — Audit `002` written; remaining 7 infra items from `tasks/001–011` folded into a single `tasks/012` for the next cycle.
- `2026-08-05T21:10:00Z` — **Bootstrap CHANGELOG** (this file).
- `2026-08-05T21:32:00Z` — **Rotated Gemini API key** in `.env` and `key/.env.local` (secrets stay gitignored). New key passed `GET /v1beta/models` smoke-test with HTTP 200 and no `RESOURCE_EXHAUSTED`. Audit `003` and tasks `013` recorded. The key is on disk but **not yet in the production bundle** — pending `npm run build` → `dist/` sync → Docker re-create → container restart (steps 4-6 in `tasks/013`). Until then Mistral remains the de-facto working provider. Security follow-up recommended: re-issue the key via a protected channel and disable any older key on `aistudio.google.com/apikey`.
- `2026-08-05T21:46:00Z` — **Added MiniMax provider (4th)**. New `services/minimax.ts` (OpenAI-compatible chat completions at `https://api.minimax.io`, default model `MiniMax-M2.7-highspeed`). `services/ai.ts` orchestrator: `AIProvider` union, `PROVIDER_PRIORITY`, `isProviderAvailable('minimax')` with placeholder gating, and 4×2 new `case 'minimax':` arms. `App.tsx`: Settings radio button + AI-unavailable modal text mentioning MiniMax. `.env` and `key/.env.local`: `VITE_MINIMAX_API_KEY=MINIMAX_REPLACE_ME_BEFORE_DEPLOY` placeholder — detected in two places and short-circuits before any HTTP call to `api.minimax.io`, so the integration ships safely without a real key. OpenSpec change `MiniMax-provider-integration` archived; main spec `openspec/specs/ai-services/spec.md` synced (5 MODIFIED scenarios, 1 ADDED requirement). User-selected priority order `['mistral','minimax','gemini','ollama']` is **intentionally non-standard** (Mistral first / Ollama last) — see audit/004 §6 for rationale and trade-offs.
- `2026-08-05T21:46:00Z` — Audit `004` and tasks `014` written; `tasks/014` checklist awaits real API key (steps 14.10-14.14).

## Upcoming (planned, not yet implemented)

See `summary/tasks/012-2026-08-05T21-10-00Z-fix-uncompleted-from-001-011.md`
for the concrete backlog: favicon link in `index.html`, dev-only Ollama
logs, `vite preview` script, `deploy.sh`, TAB-character sweep, Ollama
host repair, Gemini **deploy** (new key awaits steps 4-6 of `tasks/013`),
hardcoded fallback removal, and the build / sync / Docker re-create step.
