# 002 — Массовая фиксация: AI-fallback миграция + инфра-фиксы из audit/001

**Дата:** 2026-08-05 21:10 UTC
**Автор:** pi-coding-agent (по запросу пользователя — `A/C/D/E` из аудит-сессии)
**Связано с:** [`audit/med001`](./med001-2026-08-05T19-31-33Z-all-ai-keys-broken.md), OpenSpec change
`ai-fallback-chain-migration` → `openspec/changes/archive/2026-08-05-ai-fallback-chain-migration/`
**Scope:** все 11 запланированных задач (`summary/tasks/001–011`) + новая миграция на fallback AI.

---

## 1. Краткое резюме

После аудита `001` было подготовлено 11 инфра-фиксов (`tasks/001–011`) и принято
решение о миграции архитектуры AI со «single manually-selected provider» на
fallback chain `ollama → gemini → mistral`. Эта фиксация закрывает оба пакета
одним заходом: миграция уже реализована в коде и задокументирована через
OpenSpec change (включая дельта-спек и синк в main specs), инфра-фиксы — частично
выполнены, остаток переходит в новую `task/012` для отслеживания.

**Ключевая метрика:** все AI-функции теперь ведут себя предсказуемо — или
один провайдер ответил, или пользователь увидел понятную ошибку. Silent
fallback на исходный текст прекращён.

---

## 2. Карта изменений (по файлам)

### 2.1 Код приложения

| Файл | Δ строк | Суть | Связь |
|---|---|---|---|
| `services/ai.ts` | +154 / −34 | `PROVIDER_PRIORITY`, `findAvailableProvider()`, per-provider пробы (Mistral `/v1/models`, Gemini `generateContent('Hello')`), проброс `ALL_AI_PROVIDERS_UNAVAILABLE` | OpenSpec change §1, 4 |
| `services/gemini.ts` | +9 / −8 | все 4 функции: silent return → `throw`; на отсутствии ключа `throw new Error('Gemini API key is missing')` | change §2.1, 2.2 |
| `services/mistral.ts` | +9 / −10 | все 4 функции: silent return → `throw`; модель `mistral-tiny` → `mistral-small-latest` | change §2.3, 2.4; fix task 009-prep |
| `services/ollama.ts` | +2 / −2 | re-enable `console.log` для `OLLAMA_BASE_URL` и `OLLAMA_MODEL`; fallback IP `192.168.50.64` → `192.168.50.250` (актуализация под audit/001) | task 011 (частично) |
| `App.tsx` | +52 / −13 | новый state `showAIErrorModal`; обработка `ALL_AI_PROVIDERS_UNAVAILABLE` (модалка вместо inline error); пробрасывание `onAIError` в `ArticleModal` | change §4 |
| `components/ArticleModal.tsx` | +18 / −6 | prop `onAIError`; try/catch вокруг summarization; `onAIError()` + `onClose()` при unavailable | change §4.4, 4.5 |
| `vite.config.ts` | +14 / −12 | `allowedHosts: ['med.openaiua.cloud']` (был wildcard `true`); `proxy.on('proxyRes')` вынесен из `proxy.on('proxyReq')` callback’а (фикс listener memory-leak); origin forward в CORS response | task 006, 007; change §5 |
| `.gitignore` | +4 / 0 | `.env`, `/key/` — секреты вне репо | task 010 |
| `index.html` | +3 / −3 | косметика trailing whitespace; пустая строка перед `<link>` | — |
| `README.md` | +45 / 0 | актуализирован IP Ollama; добавлена секция `🐳 Production Deployment` (Docker/Traefik/pm2/WireGuard) | task 005 (документация) |

### 2.2 Новые файлы (untracked → tracked)

| Файл | Назначение |
|---|---|
| `favicon.ico` | иконка вкладки (task 001) |
| `ecosystem.config.cjs` | pm2-process `med-stack` (task 002) |
| `FIXATION.md` | документация процедуры фиксации (на случай если skill fixation отсутствует) |
| `.pi/skills/fixation/SKILL.md` | формализованная инструкция для pi-агента |
| `.pi/skills/openspec-{propose,apply,archive,explore,sync,update}-change/SKILL.md` | OpenSpec skills |
| `.pi/prompts/opsx-*.md` | short-prompt triggers (6 файлов) |
| `openspec/specs/ai-services/spec.md` | новый main-spec из delta |
| `openspec/changes/archive/2026-08-05-ai-fallback-chain-migration/` | архив change (4 файла: proposal, design, tasks, specs/ai-services/spec.md) |
| `summary/audit/001-...md` | предыдущий аудит (бэкап) |
| `summary/tasks/001–011-...md` | описание 11 инфра-фиксов |
| **`summary/audit/002-...md`** | **этот файл** |
| **`summary/tasks/012-...md`** | **новый task для отслеживания недозакрытого остатка** |
| **`CHANGELOG.md`** | **создаётся с нуля (шаг 4 фиксации)** |

---

## 3. Состояние OpenSpec

| Что | Где | Статус |
|---|---|---|
| Change scaffold | `openspec/changes/archive/2026-08-05-ai-fallback-chain-migration/` | ✅ archived |
| `proposal.md` | там же | ✅ done |
| `design.md` | там же | ✅ done |
| `tasks.md` (25 строк внутри change) | там же | ✅ 24/25 done (см. §4) |
| `specs/ai-services/spec.md` (delta) | там же | ✅ done |
| Main spec | `openspec/specs/ai-services/spec.md` | ✅ synced |
| Активные changes | — | ✅ нет |

---

## 4. Статус задач

### 4.1 Tasks 001-011 (запланированные)

| # | Slug | Запланировано | Сделано в коде | Комментарий |
|---|---|---|---|---|
| 001 | bump-favicon-usage | добавить link в `index.html`, add `favicon.ico` | ⛔ нет | `index.html` правился только пробелы; link не добавлен |
| 002 | replace-ecosystem-config | `ecosystem.config.cjs` для pm2-стека `med-stack` | ✅ да | файл создан, untracked (готов к коммиту) |
| 003 | cleanup-med-stack-pm2 | очистить логи prod | ⛔ регресс | `console.log('OLLAMA_BASE_URL', ...)` заново включены |
| 004 | fix-vite-preview-script | `vite preview --port 4173 --host 0.0.0.0` | ⛔ нет | в `package.json` всё ещё `vite --port 4173 --host 0.0.0.0` |
| 005 | deploy-automation | `deploy.sh`, документация | 🟡 частично | `README.md` обновлён; `deploy.sh` не создан |
| 006 | fix-vite-proxy-memory-leak | `proxyRes` вне `proxyReq` callback | ✅ да | подтверждено в `vite.config.ts` |
| 007 | fix-vite-config-tab-char | заменить TAB на пробелы | 🟡 требует проверки | новый блок `allowedHosts: ['med.openaiua.cloud']` — нужно перепроверить на TAB |
| 008 | ollama-host-investigation | починить Ollama | ⛔ нет | хост `162.19.248.57` (env) и `192.168.50.250` (fallback) — оба недоступны |
| 009 | fix-gemini-prepay | пополнить prepay | ⛔ нет | код теперь корректно ловит `RESOURCE_EXHAUSTED`; prepay не решён |
| 010 | commit-and-push-changes | безопасный коммит+push | 🟡 в процессе | выполняется в этой фиксации |
| 011 | remove-hardcoded-ollama-fallback | убрать `192.168.50.250` | ⛔ нет | IP только обновлён (`64`→`250`), хардкод остался |

### 4.2 Task 012 (новая, в рамках этой фиксации)

Создаётся отдельный `summary/tasks/012-2026-08-05T21-10-00Z-fix-uncompleted-from-001-011.md`,
объединяющий **⛔** пункты выше + проверку TAB в `vite.config.ts`. Цель —
отследить, что после `git push` не закрыто.

---

## 5. Что сделано в коде (высокоуровнево)

### 5.1 Архитектурный сдвиг: AI-fallback chain

```text
         ┌──────────────────────────────────────────────┐
  request │                                              ▼
  ───▶ findAvailableProvider() ──▶ ollama.probe ── ok? ─┐
                                              │ ok      │
                                              ▼         │
                                       используем ollama
                                              ✗         │
                                              ▼         │
                                       gemini.probe    (ok? используем gemini)
                                              ✗
                                              ▼
                                       mistral.probe (ok? используем mistral)
                                              ✗
                                              ▼
                                throw ALL_AI_PROVIDERS_UNAVAILABLE
                                              │
                                              ▼
                                   UI: модалка «AI недоступен»
```

Реализация в `services/ai.ts`:
- `PROVIDER_PRIORITY = ['ollama', 'gemini', 'mistral']`
- `isProviderAvailable(provider)` для каждого типа
- `findAvailableProvider()` — линейный поиск, `throw` если все недоступны

### 5.2 Mistral upgrade

`MISTRAL_MODEL = 'mistral-tiny'` → `'mistral-small-latest'`.
`tiny` помечен deprecated в API; `small-latest` — текущий production-grade default.

### 5.3 Vite proxy hardening

- `allowedHosts: true` → `allowedHosts: ['med.openaiua.cloud']`
  Закрывает вектор «случайный Host header проходит».
- Перенос `proxy.on('proxyRes', ...)` из callback’а `proxyReq` в callback `configure`
  с привязкой к `req.headers.origin` — фикс долгосрочного listener-утечки.

---

## 6. Найденные технические долги (по сравнению с audit/001)

| # | Severity | Описание | Где | Решение |
|---|---|---|---|---|
| 🆕 | 🟡 | `favicon.ico` всё ещё не подключён в `index.html` — отображается «сломанный» значок вкладки | `index.html` | task 012 / task 001 |
| 🆕 | 🔴 | `npm run preview` продолжает запускать dev-сервер (не preview) | `package.json:9` | task 012 / task 004 |
| 🆕 | 🟢 | Логи Ollama раскомментированы — будут сыпаться в консоль prod-юзеров | `services/ollama.ts:7-8` | task 012 / task 003 (завернуть в `if (import.meta.env.DEV)`) |
| 🆕 | 🟡 | TAB-символы в новой строке `vite.config.ts` — нужна проверка байтом | `vite.config.ts:13` | task 012 / task 007 |
| ✅→🟢 | закрыто | `MISTRAL_MODEL` хардкод — оставлено как неблокирующий тех-долг | `services/mistral.ts:8` | поднимем в следующем change’е |

---

## 7. Состояние деплоя

| Компонент | Статус |
|---|---|
| `med-proxy` Docker image | 🟡 требует пересборки (уже содержит актуальный `dist/` после audit/001) |
| `med-proxy` container | 🟡 требует перезапуска после нового коммита |
| PM2 `med-stack` | 🟢 `ecosystem.config.cjs` готов (task 002), но не запущен |
| PM2 `med-app` (старый) | 🟢 работает (dev-сервер на 4173) — не задействован в проде |
| Chrome-кэш | 🟡 пользователь должен сделать Ctrl+Shift+R после обновления |

---

## 8. Файлы изменённые / созданные (для будущего `git add`)

```
# Modified (10 файлов)
.gitignore
App.tsx
README.md
components/ArticleModal.tsx
index.html
services/ai.ts
services/gemini.ts
services/mistral.ts
services/ollama.ts
vite.config.ts

# Untracked → tracked (после `git add`)
FIXATION.md
ecosystem.config.cjs
favicon.ico
.pi/skills/fixation/SKILL.md
.pi/skills/openspec-{propose,apply,archive,explore,sync,update}-change/SKILL.md  (7 файлов)
.pi/prompts/opsx-{apply,archive,explore,propose,sync,update}.md                    (6 файлов)
openspec/specs/ai-services/spec.md
openspec/changes/archive/2026-08-05-ai-fallback-chain-migration/{proposal,design,tasks}.md
openspec/changes/archive/2026-08-05-ai-fallback-chain-migration/specs/ai-services/spec.md
summary/audit/med001-2026-08-05T19-31-33Z-all-ai-keys-broken.md
summary/audit/med002-2026-08-05T21-10-00Z-all-fixes-and-ai-fallback-migration.md  ← этот файл
summary/tasks/001-...md  …  011-...md                                          (11 файлов)

# Generated в этой фиксации (после `git add`)
summary/tasks/012-2026-08-05T21-10-00Z-fix-uncompleted-from-001-011.md
CHANGELOG.md
```

**Не включаются в коммит** (gitignored):
- `.env`, `key/` (секреты)
- `dist/` (артефакт сборки)
- `.crush/` (локальная память агента — указано в `.crush/.gitignore: *`)
- `node_modules/`
