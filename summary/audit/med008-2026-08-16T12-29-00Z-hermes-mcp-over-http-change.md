# 008 — Подготовили OpenSpec change `hermes-mcp-over-http`

**Дата:** 2026-08-16 12:29 UTC
**Автор:** pi-coding-agent (по запросу пользователя — «изучи проект на
предмет установки MCP по HTTP для подключения агента типа hermes» +
«это новое OpenSpec-изменение … с новой задачей»)
**Связано с:** OpenSpec change
`hermes-mcp-over-http` →
`openspec/changes/hermes-mcp-over-http/`. Два дельта-спека:
`mcp-server` и `mcp-auth`, которые при архивировании перейдут в
`openspec/specs/mcp-server/spec.md` и `openspec/specs/mcp-auth/spec.md`.

---

## 1. Краткое резюме

По итогам аудита существующего кода подтверждено: **MCP в проекте
сегодня отсутствует целиком** — ни MCP-сервера, ни MCP-клиента, ни
`mcp.json`, ни HTTP-эндпоинта, ни транспорта. `@modelcontextprotocol/sdk`
объявлен только как peer-зависимость `@google/genai` и **сам не
установлен** в `node_modules`. Hermes (как агент / LLM) в репо
тоже не упоминается.

Подготовлен полный OpenSpec change, описывающий новый
**MCP-сервер** для PubMed-инструментов, доступный и с локальной
VPS, и с другой VPS через публичный HTTPS. Change **спроектирован
и валидирован**, но **код ещё не написан** — это план
имплементации, готовый к `/opsx-apply`.

**Ключевая метрика:** `openspec validate hermes-mcp-over-http
--strict` → `Change … is valid`. Все 4 артефакта на месте,
0–78 задач (70+ чек-боксов) готовы к выполнению.

---

## 2. Было / стало

### 2.1 Состояние репозитория

```diff
# До
$ openspec list
Changes:
  (none)

# В коде
$ grep -ri "mcp\|model-context\|streamablehttp\|hermes" \
    --include="*.ts" --include="*.tsx" --include="*.json" \
    --include="*.md" --include="*.cjs" --include="*.env"
.scrush/logs/crush.log:1: … "Initializing MCP clients"  ← IDE-шный лог
node_modules/@google/genai: peer-зависимость от @modelcontextprotocol/sdk

# Production
$ curl https://med.openaiua.cloud/
HTTP 200  ← React-бандл, AI вызывается прямо из браузера
AI hub: Mistral → MiniMax → Gemini → Ollama (fallback chain)
MCP: —

# После (этот change)
$ openspec list
Changes:
  hermes-mcp-over-http     0/78 tasks    4m ago

$ tree openspec/changes/hermes-mcp-over-http
.openspec.yaml
proposal.md             (131 lines)
design.md               (242 lines)
tasks.md                (253 lines)
specs/
├── mcp-server/spec.md  (315 lines)
└── mcp-auth/spec.md    (162 lines)
```

### 2.2 Целевая архитектура (после `/opsx-apply`)

```
┌──────────────────────────────────────────────────────────────┐
│  Hermes-агент (или Claude/Cursor/любой MCP-клиент)          │
│  ─ на той же VPS (loopback) ─ или ─ на другой VPS ──┐       │
└─────────────────────────────────────────────────────────────┘
                                  │    │
        ┌─────────────────────────┘    └────────────────────┐
        ▼                                                  ▼
  http://127.0.0.1:8765/mcp                  https://mcp.openaiua.cloud/mcp
  (bypass — loopback exempt)                 (Authorization: Bearer <token>)
        │                                                  │
        ▼                                                  ▼
┌──────────────────────────────────────────────────────────────┐
│  Traefik (root-traefik-1)                                   │
│    router: mcp (Host: mcp.openaiua.cloud)  ← без Basic Auth │
│    load balancer → 8765                                     │
└──────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  med-mcp (root-med-mcp, Node 20)                            │
│  ├── Express 4  (1)  GET /  (2)  GET /health  (3)  GET /ready│
│  ├── POST /mcp   JSON-RPC 2.0 over Streamable HTTP          │
│  ├── GET  /mcp   SSE (Accept: text/event-stream)            │
│  ├── auth (bearer / loopback exempt) + rate-limit 60/min    │
│  └── McpServer { tools:                                     │
│        search_pubmed, get_article_details,                   │
│        translate_query, optimize_query,                     │
│        summarize_article, translate_titles                  │
│    }                                                        │
└──────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  Общая логика (Node-side mirror of services/ai.ts)          │
│  ─ Mistral → MiniMax → Gemini → Ollama (fallback chain)     │
│  ─ PubMed E-utilities  (ESearch / ESummary / EFetch)         │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Файлы

### 3.1 Новые (untracked, ожидают `git add`)

| Файл | Назначение | Размер |
|---|---|---|
| `openspec/changes/hermes-mcp-over-http/.openspec.yaml` | метаданные change | 40 B |
| `openspec/changes/hermes-mcp-over-http/proposal.md` | Why / What / Capabilities / Impact | 8.7 KB |
| `openspec/changes/hermes-mcp-over-http/design.md` | Context / 8 Decisions / 7 Risks / Migration | 13.8 KB |
| `openspec/changes/hermes-mcp-over-http/tasks.md` | 15 секций, 70+ чек-боксов | 11.3 KB |
| `openspec/changes/hermes-mcp-over-http/specs/mcp-server/spec.md` | 13 ADDED Requirements, 28 сценариев | 13.1 KB |
| `openspec/changes/hermes-mcp-over-http/specs/mcp-auth/spec.md` | 7 ADDED Requirements, 20 сценариев | 6.6 KB |
| **`summary/audit/008-…md`** | **этот файл** | — |

```
$ git status --short
?? openspec/changes/hermes-mcp-over-http/

$ openspec list
Change: hermes-mcp-over-http
Progress: 4/4 artifacts complete  →  isComplete: true, validate --strict: OK
```

### 3.2 Файлы вне репо (будущие, создаются в ходе apply)

| Путь | Назначение |
|---|---|
| `mcp-server/package.json` (+ `tsconfig.json`, `src/`) | отдельный sub-package |
| `mcp-server/dist/index.js` | после `npm run build` |
| `mcp-clients/local/*` | демо-клиент для loopback |
| `mcp-clients/remote/{README.md, example.js}` | инструкция + скрипт для другой VPS |
| `/root/med-mcp/tokens.json` (mode 600) | хранилище bearer-токенов |
| `/root/med-mcp/issue-mcp-token.sh` | выдать токен |
| `/root/med-mcp/revoke-mcp-token.sh` | отозвать токен |
| `/root/med-mcp/list-mcp-tokens.sh` | показать список (без секрета) |
| `/root/docker-compose.yml` (`med-mcp:` сервис) | контейнер с Traefik-лейблами |
| DNS A-record `mcp.openaiua.cloud` | связь с публичным доменом |

### 3.3 Что НЕ меняется

- **Фронтенд** (`App.tsx`, `services/ai.ts`, `services/pubmed.ts`,
  `vite.config.ts`) — пока не трогаем. `vite.config.ts` получит
  прокси `/mcp` в task 12.1, но контракт фронта остаётся прежним.
- **`med.openaiua.cloud`** — продолжает работать за Basic Auth
  (`openspec/specs/deployment-auth/spec.md` без изменений).
- **`gemini-flash-latest`**, `MISTRAL_API_KEY`,
  `VITE_MINIMAX_API_KEY`, fallback `mistral → MiniMax → gemini →
  ollama` — без изменений.
- **`@google/genai`** уже установлен; `mcp-server` его
  **не использует** напрямую (свой `gemini.ts` через REST), чтобы
  не тянуть в Node-окружение `express` в браузерный бандл.

---

## 4. Что зафиксировано в change

### 4.1 Proposal — Capabilities

```
New Capabilities:
  mcp-server — автономный MCP-сервер с тулами для PubMed и AI-операций,
               аутентификация по bearer-токену, доступ за Traefik
               с отдельного домена.
  mcp-auth   — управление токенами (issue / list / revoke), хранение
               в host-side файле, привязка bearer-middlewares
               к Traefik-роутеру.

Modified Capabilities:
  (нет — текущие specs/ai-services, /app-styling, /deployment-auth
   не меняют REQUIREMENTS; новый mcp.openaiua.cloud живёт рядом,
   не вместо.)
```

### 4.2 Spec `mcp-server` — 13 Requirements

| # | Requirement | Сценариев |
|---|---|---|
| 1 | MCP server endpoint (loopback + public DNS) | 3 |
| 2 | Streamable HTTP transport | 3 |
| 3 | Tool registration (6 tools) | 2 |
| 4 | `search_pubmed` | 3 |
| 5 | `get_article_details` | 2 |
| 6 | `translate_query` | 3 |
| 7 | `optimize_query` | 2 |
| 8 | `summarize_article` | 3 |
| 9 | `translate_titles` | 3 |
| 10 | AI provider parity с фронтом | 2 |
| 11 | Rate limiting per token (60/min) | 3 |
| 12 | Server health checks (`/health`, `/ready`) | 2 |
| 13 | Structured logging (pino, без секретов) | 3 |

**Всего 36 сценариев** под `WHEN … THEN …`, тестируемых отдельно.

### 4.3 Spec `mcp-auth` — 7 Requirements

| # | Requirement | Сценариев |
|---|---|---|
| 1 | Bearer token authentication (+ loopback exempt) | 4 |
| 2 | Token storage on the host (`/root/med-mcp/tokens.json` 600) | 3 |
| 3 | `issue-mcp-token.sh` | 2 |
| 4 | `revoke-mcp-token.sh` | 2 |
| 5 | `list-mcp-tokens.sh` (без печати `secret`) | 1 |
| 6 | Traefik routing + CORS (любой origin для dev) | 3 |
| 7 | No logging of secrets | 2 |

**Всего 17 сценариев.**

### 4.4 Design — 8 ключевых решений

| # | Решение | Альтернатива | Почему |
|---|---|---|---|
| **D1** | Streamable HTTP | HTTP+SSE (deprecated) | спека 2025-03-26, Hermes/Claude уже на Streamable |
| **D2** | Loopback exempt от bearer | всегда bearer | dev-сценарий без ручного токена |
| **D3** | Промпты AI продублированы | общий `packages/ai-core` | Vite `import.meta.env` vs Node `process.env`; refactor → follow-up |
| **D4** | Sub-package, не workspace | npm workspaces | чистая браузерная сборка, минимум зависимостей |
| **D5** | Bearer через header | query string | query логируется в Traefik |
| **D6** | Копия AI-orchestrator (~120 строк) | прямой импорт `services/ai.ts` | несовместимость env, см. D3 |
| **D7** | In-memory sliding window | Redis / nginx limit_req | один инстанс, горизонт. scale → отдельный change |
| **D8** | Новый hostname `mcp.openaiua.cloud` | shared `med.openaiua.cloud/mcp` | двойная auth неудобна агентам |

### 4.5 Tasks — 15 секций, 70+ чек-боксов

```
1.  Repository layout           (5 задач)
2.  Dependencies                (4)
3.  Configuration & secret handling (3)
4.  HTTP shell                  (4)
5.  Auth                        (4)
6.  AI orchestrator (mirror)    (7)
7.  PubMed client               (2)
8.  MCP server core             (4)
9.  Tools registration          (7)
10. Host-side tooling           (5)
11. Ecosystem & deployment      (6)
12. Vite dev-mode proxy         (3)
13. Demo clients                (5)
14. Validation                  (14)
15. Documentation & follow-ups  (5)
```

---

## 5. Что НЕ вошло (out of scope, осознанно)

- **WebSocket** транспорт — Streamable HTTP его покрывает.
- **OAuth 2.1 / dynamic client registration** — пока хватает
  bearer с ручной выдачей, оператор один.
- **Persistent sessions** (`Mcp-Session-Id`,
  resumable SSE streams) — клиенты stateless; см. follow-up
  task 15.5.
- **MCP resources** (`resources/list`, `resources/read`) — только
  tools.
- **UI для пользователя** — сервер headless, общение через
  JSON-RPC.
- **SSE-legacy transport** — deprecated с июня 2025.

---

## 6. Текущее состояние деплоя

| Компонент | Статус |
|---|---|
| `med-proxy` (фронт) | ✅ работает за Basic Auth (audit/007) |
| `med-app` (PM2) | ✅ last commit `60b74dc` |
| `mcp-server/` | ⛔ не существует (будет создан в task 1.1) |
| `med-mcp` (PM2) | ⛔ не существует (task 11.2) |
| `/root/med-mcp/` | ⛔ не существует (task 10.1) |
| `mcp.openaiua.cloud` DNS | ⛔ не существует (task 11.5) |
| Demo clients | ⛔ не существуют (task 13.x) |
| Фронт (после apply) | ✅ не сломается, контракт не меняется |

---

## 7. Что осталось сделать прямо сейчас

| # | Действие | Зачем |
|---|---|---|
| 1 | `git add openspec/changes/hermes-mcp-over-http/` | закрепить план в репо |
| 2 | (опц.) `git commit -m "spec(mcp): plan hermes-mcp-over-http change"` | история |
| 3 | Запустить `/opsx-apply` или попросить меня применить начать имплементацию | переходить от плана к коду |

После `/opsx-apply` поэтапно:

```
phase 1  (tasks 1-5)   → mcp-server скелет + HTTP shell + auth
phase 2  (tasks 6-7)   → AI orchestrator + pubmed client (port services/*)
phase 3  (tasks 8-9)   → McpServer + 6 tools
phase 4  (tasks 10-11) → host-side tokens + PM2 + Docker + Traefik
phase 5  (tasks 12-13) → Vite proxy + demo clients
phase 6  (tasks 14)    → 14 smoke-tests
phase 7  (tasks 15)    → README + CHANGELOG + завести follow-up change "extract-ai-core-package"
```

---

## 8. Известные риски (из design.md §R)

- **R1** — `@modelcontextprotocol/sdk` < 1.0.0, ломающие изменения
  возможны → pin `~1.24.0`, фиксация через `package-lock.json`.
- **R2** — копия AI-orchestrator рассинхронизируется с фронтом →
  каждый change промпта идёт отдельным OpenSpec change.
- **R3** — in-memory rate-limit теряется при рестарте; не
  работает при горизонт. масштабировании → миграция на Redis
  отдельный change.
- **R4** — дублирование кода AI (тех-долг) → открыть follow-up
  `extract-ai-core-package` (task 15.4).
- **R5** — `mcp.openaiua.cloud` без Basic Auth, защита только по
  bearer → `/root/med-mcp/tokens.json` (mode 600), атомарный
  revoke, мониторинг `tokens_active` через `/health`.
- **R6** — burst 60 req/min может быть мало для batch-агента →
  параметр `MCP_RATE_LIMIT_PER_MIN` через env, меняется без rebuild.
- **R7** — CORS `*` для MCP-эндпоинта → write-tools нет (только
  чтение), риск ограничен; пересмотр при появлении write-tool.

---

## 9. Rollback

Change пока **не применён** — откатывать нечего. После apply:

```bash
# Остановить контейнер/PM2-процесс
docker compose stop med-mcp
pm2 stop med-mcp

# Удалить DNS A-record
# (operator tooling — Cloudflare / reg.ru)

# Удалить файлы
rm -rf mcp-server/
rm -rf /root/med-mcp/

# reverse proxy
docker restart root-traefik-1
```

Фронт и `med.openaiua.cloud` **не задеты** — это
forward-compatible addition.

---

## 10. Связанные документы

- **OpenSpec change**: [`openspec/changes/hermes-mcp-over-http/`](../../openspec/changes/hermes-mcp-over-http/)
  - `proposal.md` — Why / What Changes / Capabilities / Impact
  - `design.md` — 8 решений, 7 рисков, migration plan
  - `tasks.md` — 70+ чек-боксов
  - `specs/mcp-server/spec.md` — контракт поведения MCP
  - `specs/mcp-auth/spec.md` — контракт аутентификации
- **Существующие спеки** (не меняются):
  - [openspec/specs/ai-services/spec.md](../../openspec/specs/ai-services/spec.md)
  - [openspec/specs/deployment-auth/spec.md](../../openspec/specs/deployment-auth/spec.md)
- **Audit trail**:
  - [med001](./med001-2026-08-05T19-31-33Z-all-ai-keys-broken.md) — все 3 ключа AI лежат
  - [med002](./med002-2026-08-05T21-10-00Z-all-fixes-and-ai-fallback-migration.md) — fallback chain
  - [med003–005](./med003-2026-08-05T21-32-00Z-rotate-gemini-api-key.md) — MiniMax, ротация, Tailwind
  - [med006](./med006-2026-08-05T22-15-00Z-ollama-disable-toggle.md) — `VITE_OLLAMA_DISABLED`
  - [med007](./med007-2026-08-05T23-00-00Z-traefik-basic-auth-med-proxy.md) — Basic Auth на med-proxy
  - **med008 (этот)** — план MCP-over-HTTP

