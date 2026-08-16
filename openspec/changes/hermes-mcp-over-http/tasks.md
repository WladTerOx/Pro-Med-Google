## 1. Repository layout

- [ ] 1.1 Create `mcp-server/` directory with its own `package.json`
      (Node 20+, type `module`, scripts: `build`, `start`, `dev`)
- [ ] 1.2 Create `mcp-server/tsconfig.json` extending
      `@tsconfig/node20/tsconfig.json` with `outDir: dist`,
      `rootDir: src`
- [ ] 1.3 Create `mcp-server/src/` subdirs
      `src/{tools,ai,http,auth,observability}/`
- [ ] 1.4 Add `mcp-server/` to root `.gitignore` patterns for
      `node_modules/`, `dist/`, `*.log`
- [ ] 1.5 Add `mcp-server/` to root `.gitignore` so secrets
      (`tokens.json`, `.env`) never leak

## 2. Dependencies

- [ ] 2.1 `mcp-server/package.json` dependencies:
      `@modelcontextprotocol/sdk` (pin `~1.24.0`),
      `express` `^4.21.0`, `cors` `^2.8.5`,
      `pino` `^9.0.0`, `pino-http` `^10.0.0`,
      `dotenv` `^16.4.0`, `zod` `^3.23.0`
- [ ] 2.2 devDependencies: `typescript` `~5.8.2`,
      `@types/node` `^22.14.0`, `@types/express`,
      `@types/cors`, `tsx` `^4.0.0`
- [ ] 2.3 Generate `mcp-server/package-lock.json` via `npm install`
- [ ] 2.4 Verify `npm ls @modelcontextprotocol/sdk` resolves to a
      single version

## 3. Configuration & secret handling

- [ ] 3.1 Create `mcp-server/.env.example` with
      `PORT=8765`, `LOG_LEVEL=info`, `MCP_RATE_LIMIT_PER_MIN=60`,
      `OLLAMA_BASE_URL=http://192.168.50.250:11434`,
      `VITE_OLLAMA_DISABLED=true`,
      `MISTRAL_API_KEY=`, `VITE_MINIMAX_API_KEY=`, `VITE_API_KEY=`
- [ ] 3.2 Create `mcp-server/src/config.ts` that reads
      `process.env` (with `dotenv`) and validates the schema via
      `zod`; throws on boot if required keys missing
- [ ] 3.3 Create `mcp-server/src/observability/redact.ts` —
      pino redaction that replaces `req.headers.authorization`,
      `*.apiKey`, `*.token` with `[REDACTED]`

## 4. HTTP shell

- [ ] 4.1 `mcp-server/src/http/server.ts` — `express()` app with
      `pino-http` middleware, `cors({ origin: '*' })`,
      `express.json({ limit: '1mb' })`
- [ ] 4.2 `mcp-server/src/http/routes.ts` — wire up:
      `GET /` (info JSON), `GET /health`, `GET /ready`,
      `POST /mcp`, `GET /mcp`, `DELETE /mcp`
- [ ] 4.3 `mcp-server/src/http/errors.ts` — JSON-RPC error
      helpers (`-32700`, `-32602`, `-32000`, `-32001`)
- [ ] 4.4 `mcp-server/src/index.ts` — bootstrap, reads config,
      starts server on `127.0.0.1:PORT`, graceful shutdown on
      `SIGTERM` / `SIGINT`

## 5. Auth

- [ ] 5.1 `mcp-server/src/auth/loopback.ts` — middleware that
      bypasses bearer check when `req.ip === '127.0.0.1'` or
      `req.ip === '::1'`
- [ ] 5.2 `mcp-server/src/auth/bearer.ts` — middleware that reads
      `Authorization: Bearer <token>`, looks up the token in
      `tokens.json`, attaches `tokenId` to `req`
- [ ] 5.3 `mcp-server/src/auth/store.ts` — `TokenStore` class
      that loads `/root/med-mcp/tokens.json` at startup, validates
      the schema, skips malformed entries with a logged error
- [ ] 5.4 `mcp-server/src/auth/rateLimit.ts` — sliding-window
      rate limiter, 60 req/min per tokenId, exempt for loopback;
      returns HTTP 429 with `Retry-After` and JSON-RPC `-32000`

## 6. AI orchestrator (mirror of frontend)

- [ ] 6.1 `mcp-server/src/ai/orchestrator.ts` — copy of
      `services/ai.ts` logic: `PROVIDER_PRIORITY =
      ['mistral','minimax','gemini','ollama']`,
      `isProviderAvailable`, `findAvailableProvider`,
      `ALL_AI_PROVIDERS_UNAVAILABLE`
- [ ] 6.2 `mcp-server/src/ai/providers/ollama.ts` — Ollama call
      (respects `VITE_OLLAMA_DISABLED`); uses
      `config.OLLAMA_BASE_URL`
- [ ] 6.3 `mcp-server/src/ai/providers/mistral.ts` — Mistral
      Chat Completions (`mistral-small-latest`)
- [ ] 6.4 `mcp-server/src/ai/providers/minimax.ts` — MiniMax
      OpenAI-compatible (`api.minimax.io/v1/chat/completions`),
      strip `think…` blocks
- [ ] 6.5 `mcp-server/src/ai/providers/gemini.ts` — Gemini
      `gemini-flash-latest` via `@google/genai`
- [ ] 6.6 `mcp-server/src/ai/prompts.ts` — same prompt strings
      as in `services/{gemini,mistral,minimax}.ts` (translate /
      optimize / summarize)
- [ ] 6.7 Mirror the four public ops as
      `mcp-server/src/ai/ops.ts`:
      `translateQueryToEnglish`, `translateTitlesToRussian`,
      `optimizeQueryForPubMed`, `summarizeArticleForLayperson`

## 7. PubMed client

- [ ] 7.1 `mcp-server/src/ai/pubmed.ts` — port of
      `services/pubmed.ts` to a pure Node module (no
      `import.meta.env`); same ESearch + ESummary + EFetch calls
- [ ] 7.2 `mcp-server/src/ai/pubmed-types.ts` — TypeScript
      interfaces matching the JSON-RPC tool return types
      (`ArticleSummary`, `ArticleDetails`)

## 8. MCP server core

- [ ] 8.1 `mcp-server/src/server.ts` — `McpServer` from
      `@modelcontextprotocol/sdk/server/mcp.js`,
      `StreamableHTTPServerTransport` from
      `…/server/streamableHttp.js`
- [ ] 8.2 Wire server to Express: parse `POST /mcp` body as
      JSON-RPC, hand to transport, send response; for
      `Accept: text/event-stream` use SSE mode
- [ ] 8.3 `GET /mcp` and `DELETE /mcp` return 405 with the
      `Mcp-Session-Id` header handling stubbed (no persistent
      sessions in this change)
- [ ] 8.4 Set `MCP-Protocol-Version` response header on every
      `/mcp` response

## 9. Tools registration

- [ ] 9.1 `mcp-server/src/tools/searchPubmed.ts` — JSON Schema
      `query: string, max_results?: number (1..50, default 10)`;
      returns array of `ArticleSummary`
- [ ] 9.2 `mcp-server/src/tools/getArticleDetails.ts` — schema
      `pmid: integer`; returns `ArticleDetails`
- [ ] 9.3 `mcp-server/src/tools/translateQuery.ts` — schema
      `query: string, target_lang?: 'en'`; passthrough for any
      value other than `'en'`
- [ ] 9.4 `mcp-server/src/tools/optimizeQuery.ts` — schema
      `long_query: string (minLength 1)`; returns optimized
      string
- [ ] 9.5 `mcp-server/src/tools/summarizeArticle.ts` — schema
      `pmid: integer, lang?: 'ru' | 'en'`; fetches abstract then
      AI-summarizes
- [ ] 9.6 `mcp-server/src/tools/translateTitles.ts` — schema
      `pmids: integer[] (minItems 1, maxItems 50),
      target_lang?: 'ru'`; returns ordered array
- [ ] 9.7 `mcp-server/src/server.ts#registerTools()` — call
      `server.tool(...)` for each of the six modules with the
      right `description`, `inputSchema`, and async handler

## 10. Host-side tooling

- [ ] 10.1 Create `/root/med-mcp/` directory (mode 700), owned by
      the user running MCP
- [ ] 10.2 `issue-mcp-token.sh` — generate 32-byte base64url
      token, append to `tokens.json`, print raw token to stdout
      once
- [ ] 10.3 `revoke-mcp-token.sh` — remove entry by token ID,
      exit `0` on success, `1` on unknown ID
- [ ] 10.4 `list-mcp-tokens.sh` — print id, label, createdAt,
      lastUsedAt; never print `secret`
- [ ] 10.5 Initial `tokens.json` with at least one entry for
      dev (operator-deletes after smoke test)

## 11. Ecosystem & deployment

- [ ] 11.1 `ecosystem.config.cjs` — add `med-mcp` block:
      `script: 'mcp-server/dist/index.js'`, `cwd: '%(cwd)s'`,
      `env: { NODE_ENV: 'production', PORT: 8765 }`, autorestart
- [ ] 11.2 `pm2 start ecosystem.config.cjs --only med-mcp`;
      verify `pm2 status` shows `med-mcp` `online`
- [ ] 11.3 `pm2 save` so the process survives reboots
- [ ] 11.4 Edit `/root/docker-compose.yml`:
      - new service `med-mcp` from image or local build
      - `expose: ["8765"]`
      - Traefik labels (`traefik.enable=true`,
        `traefik.http.routers.mcp.rule=Host(\`mcp.openaiua.cloud\`)`,
        `traefik.http.routers.mcp.tls.certresolver=letsencrypt`,
        `traefik.http.services.mcp.loadbalancer.server.port=8765`)
      - mount `/root/med-mcp/tokens.json` read-only
      - mount `mcp-server/.env` read-only
- [ ] 11.5 DNS: add A-record `mcp.openaiua.cloud` → same IP as
      `med.openaiua.cloud`
- [ ] 11.6 `docker compose up -d med-mcp`; check
      `docker logs root-med-mcp-1` for `listening on 127.0.0.1:8765`

## 12. Vite dev-mode proxy

- [ ] 12.1 `vite.config.ts` — add second proxy `/mcp` →
      `env.VITE_MCP_BASE_URL || 'http://127.0.0.1:8765'`,
      `rewrite: p => p.replace(/^\/mcp/, '')`, `changeOrigin: true`
- [ ] 12.2 Add `VITE_MCP_BASE_URL` to root `.env.example` and
      `key/.env.local` so devs can point to a non-default backend
- [ ] 12.3 Verify `npm run dev` still boots and `/mcp` is
      reachable from the browser

## 13. Demo clients

- [ ] 13.1 `mcp-clients/local/package.json` with
      `@modelcontextprotocol/sdk` as a regular dependency
- [ ] 13.2 `mcp-clients/local/list-tools.js` — connects to
      `http://127.0.0.1:8765/mcp`, calls `tools/list`, prints
      the six tool names
- [ ] 13.3 `mcp-clients/local/search-coffee.js` — runs
      `search_pubmed({ query: 'coffee cardiovascular diabetes',
      max_results: 3 })` and prints titles
- [ ] 13.4 `mcp-clients/remote/README.md` — step-by-step
      instructions for connecting from another VPS:
      `npm install @modelcontextprotocol/sdk`, set
      `MCP_URL`, `MCP_TOKEN`, run example script
- [ ] 13.5 `mcp-clients/remote/example.js` — same as
      `search-coffee.js` but reads `MCP_URL` /
      `MCP_TOKEN` from env

## 14. Validation

- [ ] 14.1 Loopback: `curl http://127.0.0.1:8765/` → 200 with
      `{"name":"pubmed-mcp", ...}`
- [ ] 14.2 Loopback: `curl http://127.0.0.1:8765/health` → 200
      JSON
- [ ] 14.3 Local MCP client: `node mcp-clients/local/list-tools.js`
      prints six tool names
- [ ] 14.4 Local MCP client: `node mcp-clients/local/search-coffee.js`
      returns ≥ 1 article
- [ ] 14.5 Bearer: `curl -H "Authorization: Bearer $TOK"
      https://mcp.openaiua.cloud/` → 200
- [ ] 14.6 Bearer missing: `curl https://mcp.openaiua.cloud/` → 401
- [ ] 14.7 Bearer wrong: `curl -H "Authorization: Bearer
      wrong-token" https://mcp.openaiua.cloud/` → 401
- [ ] 14.8 Remote client from another VPS: `node example.js`
      returns the same result as local
- [ ] 14.9 `tools/list` JSON schema validates with `ajv` (one-off
      smoke test)
- [ ] 14.10 Rate-limit: 61st request in 60s with the same token
      returns HTTP 429
- [ ] 14.11 `revoke-mcp-token.sh <id>` then the same token
      returns 401
- [ ] 14.12 Secret redaction: `grep -i 'bearer sk-' /var/log/mcp-*`
      finds nothing
- [ ] 14.13 Frontend regression: `npm run dev` still serves the
      pubmed-ai-explorer UI, all AI features still work
- [ ] 14.14 Production: `curl https://mcp.openaiua.cloud/health`
      returns 200 from the public probe

## 15. Documentation & follow-ups

- [ ] 15.1 Update repo root `README.md` — add a section
      "MCP server" with a link to `mcp-server/README.md` and
      `mcp-clients/`
- [ ] 15.2 `mcp-server/README.md` — quick start (install /
      build / config / run), env var table, link to
      `openspec/specs/mcp-server/spec.md`
- [ ] 15.3 Add an entry to `CHANGELOG.md` summarising this
      change once `tasks/14.x` pass
- [ ] 15.4 Open follow-up OpenSpec change proposal for
      `extract-ai-core-package` (consolidation of duplicated
      AI orchestrator logic)
- [ ] 15.5 Open follow-up OpenSpec change proposal for
      `mcp-persistent-sessions` (long-lived `Mcp-Session-Id`
      and resumable SSE streams)
