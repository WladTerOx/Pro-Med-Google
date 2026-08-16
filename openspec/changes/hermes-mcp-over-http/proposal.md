## Why

`pubmed-ai-explorer` сегодня — это Browser SPA, которое напрямую вызывает
AI-провайдеров (Mistral / MiniMax / Gemini / Ollama) и PubMed E-utilities
из `App.tsx`. Никаких «тулов» как объектов, к которым мог бы подключиться
внешний агент, в системе нет: логика перевода/оптимизации/саммари зашита
в `services/`, и единственный способ её вызвать — открыть фронтенд
в браузере.

Hermes (Nous Research) и совместимые с ним агенты работают по
протоколу **MCP (Model Context Protocol)**: они подключаются к
MCP-серверу по HTTP/SSE, вызывают `tools/list`, получают схемы и
выполняют `tools/call`. Чтобы такой агент — локальный или с другой
VPS — мог искать и анализировать PubMed от имени пользователя,
нужен **MCP-сервер**, доступный по HTTP, с набором инструментов
`search_pubmed`, `get_article_details`, `translate_query`,
`optimize_query`, `summarize_article`, `translate_titles`.

Сейчас инфраструктура есть (Traefik + домен `med.openaiua.cloud` + Basic
Auth на `med-proxy`), а слоя, который отдаёт «PubMed как тулы
агенту», — нет. Подключение нового агента требует сначала менять код
фронтенда, что не подходит для headless-сценариев (CI, batch-анализ,
агенты на удалённой VPS).

## What Changes

- **Новый пакет `mcp-server/`** в корне репозитория: Node.js 20+ HTTP
  сервер, реализующий JSON-RPC 2.0 поверх **Streamable HTTP** транспорта
  MCP (текущий стандарт спецификации, заменивший устаревший HTTP+SSE).
  Сервер поднимается на `127.0.0.1:8765` за Traefik, отдаёт
  `/.well-known/mcp.json` и обрабатывает `POST /mcp` (single-shot
  запросы) и `GET /mcp` (server-initiated SSE-поток, если клиент
  заявил `Accept: text/event-stream`).
- **Шесть MCP-тулов**, повторяющих поведение текущих
  `services/ai.ts` / `services/pubmed.ts`:
  - `search_pubmed(query, max_results)` — обёртка над PubMed
    ESearch + ESummary. Возвращает структурированный список
    `{ pmid, title, authors[], journal, pubDate, hasAbstract }`.
  - `get_article_details(pmid)` — обёртка над EFetch, возвращает
    title / abstract / authors / journal / pubDate.
  - `translate_query(query, target_lang)` — обёртка над
    `translateQueryToEnglish` (target_lang = `'en'` поддерживается,
    иной ⇒ passthrough).
  - `optimize_query(long_query)` — обёртка над
    `optimizeQueryForPubMed`.
  - `summarize_article(pmid, lang)` — обёртка над
    `summarizeArticleForLayperson`. Принимает `pmid`, сам подтягивает
    abstract, чтобы агенту не требовалось два вызова.
  - `translate_titles(pmids[], target_lang)` — обёртка над
    `translateTitlesToRussian`. Принимает массив `pmid`-ов,
    переводит заголовки.
- **Аутентификация — bearer token.** Traefik-роутер
  `mcp.openaiua.cloud` заводится **отдельно** от основного
  `med.openaiua.cloud` (Basic Auth) и принимает только
  `Authorization: Bearer <token>`. Список токенов хранится
  на хосте в `/root/med-mcp/tokens.json` (mode 600, не в git).
  Tokens персистентные, можно ревокнуть через `revoke-mcp-token.sh`.
- **Два демо-клиента** в `mcp-clients/`:
  - `local/` — Node.js скрипт (`node mcp-clients/local/list-tools.js`),
    подключается к `http://127.0.0.1:8765/mcp` без токена (loopback
    exempt), вызывает `search_pubmed` и печатает результат.
  - `remote/README.md` — инструкция запуска с другой VPS:
    `https://mcp.openaiua.cloud/mcp` с bearer-токеном через
    `@modelcontextprotocol/sdk/client`.
- **`vite.config.ts`** добавляет второй proxy-route `/mcp` →
  `http://127.0.0.1:8765/mcp`, чтобы dev-режим фронтенда мог
  использоваться как MCP-клиент без отдельного процесса.
- **`ecosystem.config.cjs`** получает новый процесс `med-mcp`
  (`script: 'mcp-server/dist/index.js'`) рядом с `med-app`.
- **`docker-compose.yml`** (в `/root`, не в репо) получает новый
  сервис `med-mcp` + новый Traefik-роутер с `mcp.openaiua.cloud`.

**Не входит в этот change**: переиспользование фронтенд-бандла,
gRPC/WS-транспорт, OAuth 2.1 discovery, rate-limiting на уровне
сервера, persistent session storage (stateful MCP-сессии пока
не заявлены — клиенты stateless, что совместимо со Streamable HTTP
single-shot запросами).

## Capabilities

### New Capabilities

- `mcp-server` — автономный MCP-сервер с тулами для PubMed и AI-операций,
  аутентификация по bearer-токену, доступ за Traefik с другого домена.
- `mcp-auth` — управление токенами (issue / list / revoke), хранение
  в host-side файле, привязка bearer-middlewares к Traefik-роутеру.

### Modified Capabilities

_(нет — `openspec/specs/` содержит только `ai-services`, `app-styling`,
`deployment-auth`, и ни одна из них не меняет требования. Basic Auth
на `med.openaiua.cloud` остаётся; новый `mcp.openaiua.cloud`
живёт рядом, не вместо.)_

## Impact

- **Код (новый)**:
  - `mcp-server/package.json` — отдельный npm-package, зависимости
    `@modelcontextprotocol/sdk`, `express`, `cors`, `pino`, `dotenv`.
  - `mcp-server/src/index.ts` — bootstrap: HTTP-сервер, маршруты
    `/.well-known/mcp.json`, `POST /mcp`, `GET /mcp`, `DELETE /mcp`.
  - `mcp-server/src/server.ts` — `McpServer` instance + `registerTools()`.
  - `mcp-server/src/tools/{searchPubmed,getArticleDetails,translateQuery,
    optimizeQuery,summarizeArticle,translateTitles}.ts` — шесть
    модулей, изоморфных `services/{ai,pubmed}.ts`, но без
    `import.meta.env` (берут `process.env`).
  - `mcp-server/src/auth.ts` — bearer-валидация, opt-out для loopback.
  - `mcp-clients/local/list-tools.js` — демо-клиент.
  - `mcp-clients/remote/README.md` — инструкция.
- **Код (модифицированный)**:
  - `vite.config.ts` — прокси `/mcp` → `127.0.0.1:8765`.
  - `ecosystem.config.cjs` — процесс `med-mcp`.
  - `package.json` — workspace? **нет**, отдельный sub-package
    со своим `package.json` чтобы не раздувать bundle
    фронтенда и не тащить `@modelcontextprotocol/sdk` в браузер.
- **Зависимости**: новые npm-пакеты (`@modelcontextprotocol/sdk`,
  `express`, `cors`, `pino`, `dotenv`) — только в `mcp-server/`,
  не в корневом `package.json`.
- **Инфраструктура**:
  - DNS A-record `mcp.openaiua.cloud` → тот же IP, что
    `med.openaiua.cloud`.
  - Traefik Docker labels на `med-mcp` контейнере.
  - `/root/med-mcp/tokens.json` (mode 600) +
    `/root/med-mcp/issue-mcp-token.sh` +
    `/root/med-mcp/revoke-mcp-token.sh` +
    `/root/med-mcp/list-mcp-tokens.sh`.
- **Безопасность и breaking**: разделение роутеров
  (`med.openaiua.cloud` остаётся за Basic Auth; новый
  `mcp.openaiua.cloud` — только bearer) — **не ломает**
  существующих пользователей фронтенда. Анонимный доступ
  к `mcp.*` отвергается 401.
