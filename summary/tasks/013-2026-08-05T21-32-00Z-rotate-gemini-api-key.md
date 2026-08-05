# 013 — Ротация Gemini API key

**Создан:** 2026-08-05 21:32 UTC
**Приоритет:** 🟡 средний
**Связано с:** [audit/003](../audit/003-2026-08-05T21-32-00Z-rotate-gemini-api-key.md),
[audit/001](../audit/001-2026-08-05T19-31-33Z-all-ai-keys-broken.md).

## Статус: 🟡 Pending deploy

| ID | Задача | Оценка | Статус |
|---|---|---|---|
| 1 | Обновить `VITE_API_KEY` в `.env` и `key/.env.local` через `sed` (anchored на `^VITE_API_KEY=`) | 1 мин | ✅ Done |
| 2 | Smoke-test `GET /v1beta/models?key=…` — ожидаем HTTP 200 без `RESOURCE_EXHAUSTED` | 10 сек | ✅ Done |
| 3 | Убедиться, что `.env` и `key/.env.local` НЕ на сцене в git | 5 сек | ✅ Done (working tree clean) |
| 4 | `npm run build` → `dist/index*.js` с новым ключом | ~30 сек | ⛔ Pending |
| 5 | Синхронизировать `dist/` в `/root/med-proxy/dist/` | 5 сек | ⛔ Pending |
| 6 | `docker build -t root-med-proxy` + recreate контейнер `med-proxy` | ~2 мин | ⛔ Pending |
| 7 | Hard-refresh в Chrome (Ctrl+Shift+R) на `https://med.openaiua.cloud` | 5 сек | ⛔ Pending (ручной) |
| 8 | Security follow-up: ротация ключа через защищённый канал, disable старого на aistudio.google.com | 10 мин | ⛔ Pending (см. audit/003 §5) |

## Почему 1-3 уже Done, но 4-7 нет

Пользователь выбрал вариант «b» фиксации: только файлы (audit/tasks/CHANGELOG),
**без деплоя и без git commit**. Это означает:

- Ключ лежит в `.env` на диске — **правильно, файл gitignored**.
- Ключ **не** дошёл до прод-бандла в `/root/med-proxy/dist/index*.js` —
  ожидает шагов 4-6.
- Пока шаги 4-6 не выполнены, `findAvailableProvider()` всё ещё «видит»
  прежний prepay-исчерпанный ключ из старого bundle. Mistral остаётся
  де-факто единственным живым провайдером (Ollama хост по-прежнему down).

## Что сказать агенту для продолжения

- «Деплой» — выполню шаги 4-6.
- «Фиксация» после деплоя — запишу 2026-08-05T21:3X в CHANGELOG.

Скажите «деплой» — и завершу.
