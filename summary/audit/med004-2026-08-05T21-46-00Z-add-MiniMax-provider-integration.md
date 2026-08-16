# 004 — Добавлен провайдер MiniMax в fallback-цепочку

**Дата:** 2026-08-05 21:46 UTC
**Автор:** pi-coding-agent (по запросу пользователя)
**Связано с:** [audit/med002](./med002-2026-08-05T21-10-00Z-all-fixes-and-ai-fallback-migration.md)
(трёхпровайдерный fallback), [audit/med003](./med003-2026-08-05T21-32-00Z-rotate-gemini-api-key.md)
(свежий Gemini-ключ), OpenSpec change `MiniMax-provider-integration` →
`openspec/changes/archive/2026-08-05-minimax-provider-integration/`.

---

## 1. Краткое резюме

Добавлен **четвёртый провайдер MiniMax** в AI-оркестратор. Код уже работает,
API-ключ ставится заглушкой `MINIMAX_REPLACE_ME_BEFORE_DEPLOY` (см.
ниже) — пользователь обещал положить реальный ключ заменой GEMINI-блока вручную.

API контракт MiniMax: OpenAI-compatible
(`https://api.minimax.io/v1/chat/completions`, `Authorization: Bearer <key>`,
модель по умолчанию `MiniMax-M2.7-highspeed`).

Пользовательский выбор приоритета: **`['mistral', 'MiniMax', 'gemini', 'ollama']`**
(см. ⚠️ предупреждение в §6).

---

## 2. Карта изменений

### 2.1 Новые файлы

| Файл | Назначение |
|---|---|
| `services/minimax.ts` | OpenAI-compatible клиент, 4 функции, throw-on-error |
| `openspec/changes/archive/2026-08-05-minimax-provider-integration/{proposal,design,tasks,specs/ai-services/spec}.md` | OpenSpec change → 4 файла |
| `summary/audit/004-...md` | этот файл |
| `summary/tasks/014-...md` | checklist для закрытия |
| `openspec/specs/ai-services/spec.md` | **MODIFIED**: добавлены сценарии для MiniMax, новый requirement «placeholder gating» |

### 2.2 Изменённые файлы

| Файл | Δ |
|---|---|
| `services/ai.ts` | `AIProvider` → добавил `'minimax'`; `PROVIDER_PRIORITY = ['mistral','minimax','gemini','ollama']`; `isProviderAvailable('minimax')` проба `GET /v1/models`; placeholder short-circuit; 12 новых `case 'minimax':` в switch'ах (selected + fallback × 4 функции) |
| `App.tsx` | Новая радиокнопка "MiniMax (M2.7-highspeed)" в Settings; текст модалки → "Ни один из AI-провайдеров (Mistral, MiniMax, Gemini, Ollama) не доступен" |
| `.env` (gitignored) | +1 строка: `VITE_MINIMAX_API_KEY=MINIMAX_REPLACE_ME_BEFORE_DEPLOY` |
| `key/.env.local` (gitignored) | identical |
| `CHANGELOG.md` | +1 entry |

---

## 3. Контракт API MiniMax (из проверенных докисточников)

| Параметр | Значение | Источник |
|---|---|---|
| Base URL | `https://api.minimax.io` | открытое API |
| Chat completion | `POST /v1/chat/completions`, OpenAI-compatible | `platform.minimax.io/docs/api-reference/text-chat-openai.md` |
| Models probe | `GET /v1/models` | список моделей OpenAI-compatible; ответ 401 без ключа подтверждает путь |
| Аутентификация | `Authorization: Bearer <apiKey>` | подтверждено ответом 401 "Please carry the API secret key in the 'Authorization' field of the request header" |
| Default model | `MiniMax-M2.7-highspeed` | `platform.minimax.io/docs/guides/models-intro.md` (low latency, same perf as M2.7) |
| Pricing | pay-as-you-go, см. `platform.minimax.io/docs/guides/pricing-paygo.md` | доки |

### 3.1 Сценарий подтверждения

| Шаг | Команда | Ответ |
|---|---|---|
| Хост жив | `curl https://www.minimax.io/` | 200 (HTML «MiniMax — Building AGI…») |
| API endpoint | `curl -X POST https://api.minimax.io/v1/chat/completions -d '{...}'` (без ключа) | 401 + JSON `{"type":"error","error":{"type":"authorized_error","message":"login fail: Please carry the API secret key in the 'Authorization' field…"}}` |

---

## 4. Что фактически работает уже сейчас (с заглушкой)

| Подсистема | Статус |
|---|---|
| Module `services/minimax.ts` | ✅ компилируется, экспортирует 4 функции |
| Тип `AIProvider` включает `'minimax'` | ✅ |
| `PROVIDER_PRIORITY` обновлён | ✅ |
| Switch в `translateQueryToEnglish/TitlesToRussian/summarizeArticleForLayperson/optimizeQueryForPubMed` | ✅ все 4 поддерживают MiniMax |
| UI-радиокнопка | ✅ Settings панель содержит "MiniMax (M2.7-highspeed)" |
| Текст модалки | ✅ "(Mistral, MiniMax, Gemini, Ollama)" |
| `isProviderAvailable('minimax')` заглушка | ✅ короткое замыкание до network-call |
| Реальные запросы к MiniMax | ⛔ ЖДЁМ ключ от пользователя |
| OpenSpec change `MiniMax-provider-integration` | ✅ Archived |
| Main spec `openspec/specs/ai-services/spec.md` | ✅ Synced: новый requirement «placeholder gating», 4 обновлённых сценария |

---

## 5. Что осталось пользователю

| # | Действие | Где |
|---|---|---|
| 1 | Заменить `VITE_MINIMAX_API_KEY=MINIMAX_REPLACE_ME_BEFORE_DEPLOY` на реальный ключ в `.env` и `key/.env.local` | оба файла gitignored |
| 2 | `npm run build` → sync `dist/` → `docker build -t root-med-proxy` → recreate `med-proxy` | прод-контур |
| 3 | Hard-refresh в Chrome (Ctrl+Shift+R) | клиент |
| 4 | Проверить что радиокнопка "MiniMax" в Settings теперь работает и реальные ответы идут | UI |

---

## 6. ⚠️ Решение о приоритете `mistral → MiniMax → gemini → ollama`

**Пользователь явно выбрал этот порядок** в этой сессии: «mistral, minimax, gemini, ollama».

**Это сознательно нестандартный порядок.** Зафиксированная в
`openspec/changes/archive/2026-08-05-minimax-provider-integration/design.md`
раскладка D2:

| Стандартный выбор (`audit/002`) | Выбор пользователя (`audit/004`) |
|---|---|
| `ollama → gemini → mistral` (или `ollama → gemini → mistral → MiniMax`) | `mistral → MiniMax → gemini → ollama` |
| Локальный бесплатный Ollama первый | **Платный Mistral первый** |
| Платные облака в порядке убывания цены | **Локальный Ollama последний** |

**Последствия:**

1. **Burn Mistral prepay credits первым.** Каждый поисковый запрос → Mistral первым. Gemini и MiniMax — реже. Ollama — почти никогда (только если все три облака мертвы).
2. **Ollama никогда не используется**, пока работает хоть один облачный провайдер. Если WireGuard к Ollama поднимется — это не поможет, пока есть любой живой cloud.

**Когда пересмотреть:** если стоимость Mistral prepay окажется непосильной, или если Ollama вернётся в строй и вы захотите её использовать. Изменение — **одна строка** в `services/ai.ts:24`.

**Решение зафиксировано в коде явно** через JSDoc-комментарий в `services/ai.ts:13`:
```
* Current priority (chosen by user on 2026-08-05; unusual because it
* places paid Mistral first and local Ollama last; see
* summary/audit/004 for justification):
*   mistral → MiniMax → gemini → ollama
```

---

## 7. Файлы изменённые / созданные (для будущего `git add`)

```
# Modified
services/ai.ts                                        (~30 строк diff)
App.tsx                                               (+6 строк: радио + modal text)
openspec/specs/ai-services/spec.md                    (MODIFIED: 5 scenarios, +1 requirement)
CHANGELOG.md                                          (+1 entry)

# Created
services/minimax.ts                                          (7.5 KB)
openspec/changes/archive/2026-08-05-minimax-provider-integration/
├─ proposal.md
├─ design.md
├─ tasks.md
├─ specs/ai-services/spec.md
└─ .openspec.yaml

summary/audit/med004-2026-08-05T21-46-00Z-add-MiniMax-provider-integration.md   ← этот файл
summary/tasks/014-2026-08-05T21-46-00Z-add-MiniMax-provider-integration.md   ← checklist

# Out of repo (.gitignore): изменены (но НЕ коммитятся)
.env
key/.env.local
```
