## Context

См. `proposal.md` (Why / What Changes) и `specs/{mcp-server,mcp-auth}/spec.md`
(контракт). Краткое состояние на сегодня:

- Frontend `pubmed-ai-explorer` общается с PubMed E-utilities
  (`services/pubmed.ts`) и AI-провайдерами (`services/ai.ts` +
  `services/{gemini,mistral,minimax,ollama}.ts`) **из браузера**.
- В `services/ai.ts` есть fallback-цепочка
  `mistral → MiniMax → gemini → ollama` с проверкой доступности
  каждого провайдера и единой ошибкой `ALL_AI_PROVIDERS_UNAVAILABLE`.
- `@modelcontextprotocol/sdk` объявлен как peer-зависимость
  `@google/genai`, но **сам не установлен** в `node_modules`. Фактически
  в проекте MCP не используется.
- Прод-инфраструктура: `med.openaiua.cloud` за Traefik с Basic Auth
  (`openspec/specs/deployment-auth/spec.md`), Ollama в WireGuard-сети
  по `192.168.50.250:11434` (сейчас хост лежит, есть
  `VITE_OLLAMA_DISABLED` toggle), фронтенд собирается в `dist/` и
  отдаётся контейнером `med-proxy`, PM2 (`ecosystem.config.cjs`)
  держит процесс `med-app`.
- В корне `package.json` нет `mcp-server/` — это новая
  директория-подпакет со своим `package.json`.

## Goals / Non-Goals

**Goals:**

- Поднять изолированный Node.js MCP-сервер, который говорит
  Streamable HTTP и отдаёт шесть PubMed-тулов.
- Обеспечить аутентификацию по bearer, разделить с фронтендом
  (новый hostname `mcp.openaiua.cloud`, без Basic Auth).
- Переиспользовать ту же fallback-логику AI, что и фронтенд, без
  копирования prompt-ов (вынести промпты в общий `.md` или
  продублировать — см. D3).
- Покрыть двумя демо-клиентами: loopback (`127.0.0.1:8765`) и
  remote (с другой VPS через `https://mcp.openaiua.cloud/mcp`).
- Сохранить существующие контракты фронтенда неизменными
  (фронт продолжает работать как раньше).

**Non-Goals:**

- WebSocket-транспорт MCP (Streamable HTTP уже покрывает);
- OAuth 2.1 / dynamic client registration (достаточно bearer
  с ручной выдачей токенов; пользователь пока один — оператор
  VPS);
- Persistent sessions / stateful stream resumability
  (`Mcp-Session-Id`) — клиенты stateless, агент переподключается
  если соединение падает, что соответствует
  Streamable HTTP single-shot;
- Поддержка MCP-ресурсов (`resources/list`, `resources/read`) — в
  этом change только `tools`;
- UI для пользователя (`mcp-server` — headless);
- Поддержка SSE-legacy транспорта (deprecate с июня 2025).

## Decisions

### D1. Streamable HTTP вместо HTTP+SSE

**Что**: реализуем Streamable HTTP transport (`POST /mcp` +
опциональный `GET /mcp` для `text/event-stream`).

**Почему**: HTTP+SSE транспорт помечен как deprecated в MCP
spec 2025-03-26 (`@modelcontextprotocol/sdk` теперь по умолчанию
отдаёт `StreamableHTTPServerTransport`). Агенты Hermes / Claude
Desktop / Cursor уже используют Streamable HTTP.

**Альтернативы**: SSE-only (старые клиенты) — отвергнуто, они
есть и без нас; WebSocket — нестандартный для MCP, требует
дополнительной реализации.

### D2. Loopback exempt от bearer auth

**Что**: запросы с `127.0.0.1` / `::1` проходят без проверки
токена.

**Почему**: dev-сценарий (Hermes-агент запускается на той же VPS)
не должен требовать ручной выдачи токена. Traefik → MCP-сервер по
Docker-network тоже приходит как `127.0.0.1` на стороне сервера,
поэтому внутри Docker-сети мы всё равно loopback.

**Альтернативы**: всегда требовать bearer (отвергнуто — лишний
шаг для локальной разработки); отдельный dev-token в env
(отвергнуто — лишняя поверхность атаки).

### D3. Промпты AI дублируются, шаблоны выносим

**Что**: MCP-сервер имеет собственные копии prompt-ов (те же
тексты, что в `services/{gemini,mistral,minimax}.ts`). В
`design.md` фиксируется, что **изменение промпта требует
синхронного изменения в обоих местах** (отдельный OpenSpec
change).

**Почему**: модули фронтенда используют `import.meta.env` (Vite),
модули MCP-сервера — `process.env` (Node). Совместное использование
без тяжёлого рефакторинга (вынести `packages/ai-core/`) — не
оправдано на данном этапе.

**Альтернативы**: рефакторинг в общий `packages/ai-core` (см.
D6) — оставлено как возможный follow-up.

### D4. Отдельный sub-package, не workspace

**Что**: `mcp-server/package.json` — обычный (не workspace) пакет
со своими зависимостями. Корень `package.json` не меняется.

**Почему**: фронтенд-сборка останется чистой (Vite не увидит
express / `@modelcontextprotocol/sdk`); `@modelcontextprotocol/sdk`
попадает только в `mcp-server/dist`.

**Минус**: нет единого `npm install` (operator-у нужно делать
`npm install` в `mcp-server/` тоже). Принимаемо — задокументируем
в `tasks.md`.

**Альтернативы**: npm workspaces (отвергнуто — pulling
npm-workspace v2 в этот проект ради одного подпакета избыточно);
monorepo с Turbo (overkill).

### D5. Bearer через header, не через query string

**Что**: `Authorization: Bearer <token>`; токены **никогда** не
принимаются в URL или query string.

**Почему**: query string логируется в Traefik access-log,
попадает в рефереры, может утечь в публичных дашбордах.

**Альтернативы**: cookie + CSRF (отвергнуто — агенты обычно
никаких cookies не хранят); mTLS (отвергнуто — нужен инфра для
выдачи клиентских сертификатов).

### D6. Reuse vs copy of `services/ai.ts` logic

**Что**: MCP-сервер использует **копию** AI-orchestrator
(`mcp-server/src/ai/orchestrator.ts`), с тем же `PROVIDER_PRIORITY`
и тем же контрактом ошибок. При добавлении/удалении провайдера
нужно править оба файла.

**Почему**: модули фронтенда — Vite-only (`import.meta.env`),
Node-импорт их не получит без изменений. Дублирование ~120 строк
согласовано с D3.

**Долгосрочно**: выделить `packages/ai-core` с `process.env`
интерфейсом — отдельный OpenSpec change (см. Risks §R4).

### D7. Rate-limit через in-memory sliding window

**Что**: простой sliding-window счётчик по tokenId за последние
60 секунд, в `Map<tokenId, number[]>`.

**Почему**: один инстанс, нет нужды в Redis. Если инстанс
перезапустится — счётчики обнулятся, что приемлемо (защищаемся
от runaway-агента, а не от целенаправленной DoS).

**Альтернативы**: Lua-script на Redis (overkill); nginx limit_req
(сложно маркировать по токену за reverse-proxy).

### D8. Traefik-роутер через новый hostname

**Что**: A-record `mcp.openaiua.cloud` → тот же IP, отдельный
Traefik-router `mcp` без basic-auth, отдельный сервис
`med-mcp` в `docker-compose.yml`.

**Почему**: переиспользовать `med.openaiua.cloud` под
`/mcp` при текущем Basic Auth неудобно — клиент-агент должен
слать Basic Auth **и** bearer, что нарушает принцип "один
аут-метод на endpoint".

**Альтернативы**: использовать `med.openaiua.cloud/mcp` с
двойной auth (отвергнуто — см. выше); вынести за VPN без
публичного hostname (отвергнуто — цель change именно
"удалённый VPS").

## Risks / Trade-offs

- **R1** — `@modelcontextprotocol/sdk` активно развивается,
  semver до 1.0.0, есть риск ломающих изменений.
  → Mitigation: pin `~1.24.0` (последняя стабильная на момент
  проектирования), фиксировать через `package-lock.json`.
- **R2** — Копия AI-orchestrator может рассинхронизироваться с
  фронтендом. → Mitigation: добавить smoke-тест в `tasks.md`
  (одинаковый prompt даёт одинаковый результат на обоих
  концах); отдельный OpenSpec change для каждого изменения
  промпта.
- **R3** — Rate-limit в in-memory теряется при рестарте; при
  горизонтальном масштабировании не сработает.
  → Mitigation: в этом change у нас один инстанс; миграция
  на Redis — отдельный change «если понадобится».
- **R4** — Node-импорт `services/ai.ts` напрямую невозможен
  из-за `import.meta.env`. Дублирование кода — технический долг.
  → Mitigation: открыть follow-up «выделить `packages/ai-core`».
- **R5** — `mcp.openaiua.cloud` без Basic Auth виден снаружи;
  защита только по bearer. Если ключи утекут — сервер открыт.
  → Mitigation: `/root/med-mcp/tokens.json` (mode 600), helper
  скрипты делают `revoke-mcp-token.sh` атомарным, мониторим
  `tokens_active` через `/health`.
- **R6** — Трафик через Cloudflare/публичный Traefik может
  превышать 60 req/min даже у одного агента (burst при
  пакетной обработке).
  → Mitigation: параметр `--rate-limit` в env
  (`MCP_RATE_LIMIT_PER_MIN`), регулируется без rebuild.
- **R7** — CORS-permissive (`Access-Control-Allow-Origin: *`)
  для MCP-эндпоинта теоретически позволяет CSRF со стороны
  произвольного origin. → Mitigation: MCP tools write-side
  нет (только чтение: `search`, `fetch`, `translate`),
  риск ограничен. Если в будущем появится write-tool —
  пересмотреть.

## Migration Plan

Деплой в три шага, откатываемый отдельно на каждом:

1. **Build & deploy MCP-сервер**:
   - `cd mcp-server && npm install && npm run build` →
     `mcp-server/dist/index.js`.
   - Копируем `dist/` в `/root/med-mcp/dist/`.
   - Создаём `/root/med-mcp/tokens.json` (mode 600) и
     `/root/med-mcp/issue-mcp-token.sh` / `revoke-mcp-token.sh`
     / `list-mcp-tokens.sh`.
   - Запускаем через PM2: `pm2 start ecosystem.config.cjs
     --only med-mcp`.
2. **Прокидываем Traefik**:
   - В `/root/docker-compose.yml` правим сервис `med-mcp`:
     port mapping `8765:8765`, labels
     `traefik.http.routers.mcp.rule=Host(\`mcp.openaiua.cloud\`)`,
     `traefik.http.services.mcp.loadbalancer.server.port=8765`,
     `traefik.enable=true`.
   - DNS A-record `mcp.openaiua.cloud` → текущий IP.
   - `docker compose up -d med-mcp`.
3. **Выдаём токен и проверяем**:
   - `/root/med-mcp/issue-mcp-token.sh hermes-vps-1`.
   - С другой VPS: `curl -H "Authorization: Bearer <token>"
     https://mcp.openaiua.cloud/` → 200 JSON.
   - `tools/list` → 6 инструментов.

**Rollback**: `docker compose stop med-mcp` отрубает MCP без
затрагивания фронтенда. DNS можно оставить (нет поддержки
TCP-соединений — клиенты получает connection refused).

## Open Questions

_Нет._ Все существенные решения зафиксированы. Остатки
(долгосрочный рефакторинг в `packages/ai-core`, миграция на
OAuth 2.1, persistent sessions) — осознанные out-of-scope.
