# 003 — Ротация Gemini API key

**Дата:** 2026-08-05 21:32 UTC
**Автор:** pi-coding-agent (по запросу пользователя)
**Severity:** 🟡 низкий (рутинная операция, без простоя; требует ребилда для доставки в прод)
**Связано с:** [`audit/med001`](./med001-2026-08-05T19-31-33Z-all-ai-keys-broken.md) (тогда ключ
помечен как «исчерпан по prepay»; [`audit/med002`](./med002-2026-08-05T21-10-00Z-all-fixes-and-ai-fallback-migration.md)
(миграция на fallback chain, где Gemini теперь второй приоритет после Ollama).

---

## 1. Контекст

В [`audit/med001`](./med001-2026-08-05T19-31-33Z-all-ai-keys-broken.md) был зафиксирован
`RESOURCE_EXHAUSTED` для существующего ключа `AIzaSy...g9Qs` —
prepay-кредиты исчерпаны. Ollama тогда тоже был недоступен, и единственным
рабочим провайдером остался Mistral (ключ `5YZeG3...UnWz`, заменённый там же).

Пользователь выдал новый ключ формата `AQ.*...` (Google переехал на новый
формат ключей для Gemini API). Задача операции — положить его в
`.env` / `key/.env.local` и убедиться, что листинг моделей возвращает 200
(ключ валидный, prepay не исчерпан).

---

## 2. Что сделано

1. Обновил `VITE_API_KEY=` в обоих env-файлах через `sed -i` с anchored-regex,
   чтобы случайно не тронуть `VITE_MISTRAL_API_KEY` и Ollama-блок:
   ```bash
   sed -i "s|^VITE_API_KEY=.*|VITE_API_KEY=${NEW_KEY}|" .env
   sed -i "s|^VITE_API_KEY=.*|VITE_API_KEY=${NEW_KEY}|" key/.env.local
   ```
2. Проверил `diff .env key/.env.local` — файлы идентичны.
3. Smoke-test против публичного API:
   ```bash
   curl -s -w "HTTP %{http_code}\n" --max-time 8 \
     "https://generativelanguage.googleapis.com/v1beta/models?key=${KEY}"
   ```
   → `HTTP 200`, ответ содержит `models/gemini-2.5-flash`.
4. Поиск по ответу на `RESOURCE_EXHAUSTED|prepayment credits|API key not valid|REQUEST_DENIED`
   → ни одного совпадения.
5. `git status -s` — пусто. Секреты остались вне git-индекса
   (`.gitignore:16:.env`, `.gitignore:17:/key/`).

---

## 3. Статус

**Готово:**
- ✅ `.env` обновлён
- ✅ `key/.env.local` обновлён
- ✅ Smoke-test прошёл (HTTP 200, `gemini-2.5-flash` доступна)
- ✅ Секреты НЕ попали в git

**Не сделано (отложено пользователем — вариант «b»):**
- ⛔ `npm run build` + `dist/` → `/root/med-proxy/dist/` + `docker build`
  + recreate `med-proxy` контейнер — **новый ключ ещё не в прод-бандле**.
- ⛔ Коммит / push — по запросу пользователя НЕ выполнялись (только файлы
  audit / tasks / CHANGELOG).

---

## 4. Что должен сделать пользователь до окончательного завершения

| # | Действие | Где |
|---|----------|-----|
| 1 | `cd /root/Projects/Pro-Med-Google && npm run build` | исходники |
| 2 | `rsync -a --delete dist/ /root/med-proxy/dist/` | синк сборки |
| 3 | `cd /root/med-proxy && docker build -t root-med-proxy .` | образ |
| 4 | `docker rm -f med-proxy && docker compose up -d med-proxy` | контейнер |
| 5 | В браузере открыть `https://med.openaiua.cloud` через Ctrl+Shift+R | клиент |

После шагов 1-5 — Gemini снова доступен в `findAvailableProvider()` вторым
после Ollama, как задокументировано в [`audit/med002`](./med002-2026-08-05T21-10-00Z-all-fixes-and-ai-fallback-migration.md)
и `openspec/specs/ai-services/spec.md` (§ «Provider priority chain», сценарий
«First two providers unavailable»).

---

## 5. Security follow-up

> ⚠️ Ключ был передан в чате открытым текстом. История диалога может
> логироваться на терминале / в буфере / на серверной стороне модели.

Рекомендуется:

1. Зайти на https://aistudio.google.com/apikey
2. **Disable** старый ключ (`AIzaSy...g9Qs`, если он ещё существует)
3. После deploy-шага 1-4 — пройти на ключ **повторно** через защищённый канал
   (secret-manager, sealed-secrets, age-encrypted файл)
4. Сохранить новый ключ **только** в `~/.bash_secrets` с `chmod 600`,
   и прокидывать в `.env` через `set -a; source ~/.bash_secrets; set +a`
   в рамках session-only shell

Если этот ключ изначально **не** предназначен для долгой жизни — заменить
его сразу после deploy.

---

## 6. Файлы изменённые / созданные

```
.env                                  ← VITE_API_KEY=…
key/.env.local                        ← VITE_API_KEY=…

# создано в этой фиксации (как файлы, без git commit)
summary/audit/med003-2026-08-05T21-32-00Z-rotate-gemini-api-key.md  ← этот файл
summary/tasks/013-2026-08-05T21-32-00Z-rotate-gemini-api-key.md  ← минимальный checklist
CHANGELOG.md                         ← +1 entry
```

**Не** вошло в git-индекс: `.env`, `key/.env.local` — gitignored.

---

## 7. Метрики для последующего наблюдения

| Метрика | Как смотреть |
|---|---|
| Gemini credit burn | `https://aistudio.google.com/projects` → usage |
| Per-request 4xx/5xx от Gemini | дев-сервер логи + production-логи med-proxy |
| Время ответа | `X-Response-Time` в nginx-логах traefik |
| Fallback в действии | `localStorage` `selectedProvider` + локальный `console.log` от `isProviderAvailable` |
