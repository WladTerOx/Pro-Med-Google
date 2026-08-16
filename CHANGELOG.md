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
- `2026-08-05T21:50:00Z` — **Tailwind migrated from Play CDN to build-time** postcss pipeline. `tailwindcss@^3.4.19`, `postcss@^8.5.25`, `autoprefixer@^10.5.4` added as dev-deps; new `tailwind.config.js` (content globs cover `index.html`, `App.tsx`, `components/**`), `postcss.config.js` (`tailwindcss` + `autoprefixer` plugins), and `index.css` (`@tailwind base/components/utilities`). `index.tsx` now imports the CSS so Vite picks it up via PostCSS; `index.html` lost the `<script src="https://cdn.tailwindcss.com">`, the inline `tailwind.config = { darkMode: 'class' }` block, and the dangling `<link rel="stylesheet" href="/index.css">` (Vite injects a hashed `<link>` to `dist/assets/index-DTchTZfp.css` automatically). Build now produces a 21.43 KB CSS file (gzip 4.38 KB) alongside the JS bundle. OpenSpec change `tailwind-build-time-migration` archived; new main spec `openspec/specs/app-styling/spec.md` covers build-time toolchain, no-runtime-CDN, and dark-mode class strategy. Same dark-mode toggle UI; no component changes.
- `2026-08-05T22:08:00Z` — **AI bugfixes after prod deploy**: (a) `services/minimax.ts` now strips `think.../think` reasoning blocks from MiniMax-M3/M2.7 responses — MiniMax's API rejects the `thinking` parameter (HTTP 400), so the strip is done client-side. Without it, PubMed query translation would carry the model's internal monologue before the actual translation. (b) `services/ai.ts` availability probe + `services/gemini.ts` (4 functions) switched from `gemini-2.5-flash` to `gemini-flash-latest` — Google deprecated the former for new users (HTTP 404) while the latter still returns 200. Both fixes are narrow behavioral corrections, no spec/contract change. End-to-end verified on the live site: MiniMax translation `лечение головной боли при мигрени` -> `treatment of migraine headache`; Gemini generate-content now HTTP 200 where it was 404.
- `2026-08-05T22:15:00Z` — **Ollama stub via env-toggle**: `services/ai.ts` `case 'ollama'` short-circuits when `VITE_OLLAMA_DISABLED=true`, logging `'Ollama disabled via VITE_OLLAMA_DISABLED'` and skipping the `fetch('/api/ollama/api/tags')` probe (which had been timing out ~8 s on every AI call because the upstream host is down). `.env` and `key/.env.local` set the toggle on; flipping it to `false` re-enables Ollama without code changes. OpenSpec change `ollama-disable-toggle` archived; main spec `openspec/specs/ai-services/spec.md` MODIFIED with two new scenarios under `Provider availability test` ("Ollama disabled via env" and "Ollama probe returns true"). Audit `006`, tasks `017`.
- `2026-08-05T23:00:00Z` — **`med.openaiua.cloud` gated behind Traefik HTTP basic-auth**: anonymous and wrong-cred requests now receive HTTP 401 with `WWW-Authenticate: Basic realm="Med Proxy (auth required)"`. New capability `deployment-auth` codified in `openspec/specs/deployment-auth/spec.md` (six scenarios: anonymous reject, valid creds, wrong creds, add user via script, remove user via script, no-credentials-in-logs). New host-side infrastructure in `/root/med-auth/` (out of repo, mode 700 dir / 600 file): `add-med-user.sh`, `del-med-user.sh`, `list-med-users.sh`, `regen-med-labels.sh`. Bcrypt cost 10 via Python (no `htpasswd` binary required). `med-proxy` container carries three new Traefik Docker labels: `traefik.http.middlewares.med-auth.basicauth.users`, `…realm`, `traefik.http.routers.med.middlewares=med-auth@docker`. Adding/removing a user requires `docker restart root-traefik-1` (~5-10 s downtime on all Traefik services); Traefik v3 does not graceful-reload the basic-auth middleware on a container recreate. OpenSpec change `traefik-basic-auth-med-proxy` archived. Audit `med007`, tasks `med007.1`. Demo user `testuser1` left in `.htpasswd` for verification — operator should delete it before onboarding real users.
- `2026-08-16T12:29:00Z` — **OpenSpec change `hermes-mcp-over-http` designed**: full specification for a standalone Node.js MCP (Model Context Protocol) server over Streamable HTTP delivering 6 PubMed search/AI tools (`search_pubmed`, `get_article_details`, `translate_query`, `optimize_query`, `summarize_article`, `translate_titles`) for external agents (Hermes/Claude). Gated by bearer authentication (`mcp.openaiua.cloud`) with host token management. Audit `med008` and task tracker `med008.1` recorded.
- `2026-08-16T13:10:00Z` — **Restructured summary audit and task indexing**: migrated to explicit hierarchical naming scheme (`med00X` for audits, `med00X.Y` for tasks) across all 8 audit files and 18 task files. Task `med008.2` recorded.


## Upcoming (planned, not yet implemented)

See `summary/tasks/012-2026-08-05T21-10-00Z-fix-uncompleted-from-001-011.md`
for the concrete backlog: favicon link in `index.html`, dev-only Ollama
logs, `vite preview` script, `deploy.sh`, TAB-character sweep, Ollama
host repair, Gemini **deploy** (new key awaits steps 4-6 of `tasks/013`),
hardcoded fallback removal, and the build / sync / Docker re-create step.
