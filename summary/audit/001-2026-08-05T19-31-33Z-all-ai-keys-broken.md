# 001 — Все AI-провайдеры не работают

**Дата:** 2026-08-05 19:31 UTC
**Автор:** pi-coding-agent (по запросу пользователя)
**Severity:** 🔴 Critical — приложение полностью неработоспособно по части ИИ

---

## 1. Краткое резюме

Pro-Med (PubMed AI Explorer) использует три AI-провайдера с приоритетом `ollama → gemini → mistral`. На момент аудита **все три** недоступны, любая попытка перевода/оптимизации/суммаризации выбрасывает `ALL_AI_PROVIDERS_UNAVAILABLE`. После вмешательства исправлен только Mistral; Gemini и Ollama остаются нерабочими.

---

## 2. Текущее состояние провайдеров

| # | Провайдер | Статус | Детали |
|---|-----------|--------|--------|
| 1 | **Ollama** | ❌ Недоступен | Оба хоста (`VITE_OLLAMA_BASE_URL=http://162.19.248.57:11434` в `.env` и fallback `http://192.168.50.250:11434` в коде) — connection timeout >8 сек. Серверная часть не отвечает, сети между этим хостом и Ollama нет. |
| 2 | **Gemini** | ❌ 429 RESOURCE_EXHAUSTED | Ключ `AIzaSyCtQie1lOG4ONs_6L_Rr1X2bMwJbTK06Qs` валиден (листинг моделей работает), но prepay-кредиты исчерпаны. Ответ API: *"Your prepayment credits are depleted. Please go to AI Studio… to manage your project and billing."* |
| 3 | **Mistral** | ✅ Починен в этой сессии | Старый ключ `q9Mp6lwilxt3Q7JjFA7BeJLSonG32An0` → 401 Unauthorized. Заменён на `5YZeG3v8HIliFiGPJlnkpeI94xfjUnWz` в `.env` и `key/.env.local`. Также обновлена модель: `mistral-tiny` (deprecated) → `mistral-small-latest`. Прямой API-тест вернул 200 OK, корректный перевод RU→EN. |

---

## 3. Текущее состояние деплоя

| Компонент | Статус | Детали |
|-----------|--------|--------|
| **PM2 `med-app`** | ✅ Online | `npm run preview` (vite на 4173). После рестарта с `--update-env` статус online, 30 рестартов. |
| **Docker `med-proxy`** | ✅ Online (пересоздан) | Содержит nginx + собранный `dist/`. Старый контейнер (4 недели аптайма) был пересоздан с новым образом `root-med-proxy`, который включает обновлённый `dist/index-BVsapEYp.js` с новым ключом Mistral. |
| **Traefik routing** | ✅ Работает | `med.openaiua.cloud` → `med-proxy:8083` через traefik (443). Подтверждено: `curl https://med.openaiua.cloud/` отдаёт новый bundle. |
| **Nginx (host:80)** | ⚠️ Конфиг устарел | `proxy_pass http://172.17.0.1:4173` — дублирует traefik-маршрут на node dev-сервер, но фактически весь трафик идёт через traefik → med-proxy. Nginx не критичен, но может вызывать путаницу. |

---

## 4. Архитектура деплоя (двухшаговая — источник хронических багов)

```
Исходники:  /root/Projects/Pro-Med-Google/         (правки, npm run build)
                     │
                     ├── dist/  ──копируется──▶  /root/med-proxy/dist/
                     │                                    │
                     ▼                                    ▼
              vite preview                            docker build
            (host:4173 / dev)                    root-med-proxy образ
                                                         │
                                                         ▼
                                                  med-proxy контейнер
                                                  (nginx:8083 → traefik)
                                                         │
                                                         ▼
                                              https://med.openaiua.cloud
```

**Проблема:** правка `.env`/`services/mistral.ts` в исходниках **НЕ** видна в проде без:
1. `npm run build`
2. копирования `dist/` в `/root/med-proxy/dist/`
3. `docker build -t root-med-proxy`
4. пересоздания контейнера

Пользователь потратил ~30 минут на отладку 401 после "жёсткого обновления" Chrome — оказалось, что Chrome показывал старый bundle `index-DFKI9Dh-.js` из контейнера, который мы не пересобрали.

---

## 5. Выявленные технические долги

### 🔴 Критично

1. **Gemini prepay исчерпан** — без пополнения/нового ключа второй провайдер не работает, всё ложится на Mistral.
2. **Ollama хосты недоступны** — `162.19.248.57` (из .env) и fallback `192.168.50.250` (в коде `services/ollama.ts`). Если сервер должен быть локальным — он не запущен / firewall закрыт.
3. **Скрипт `npm run preview` запускает dev-сервер, а не preview.** В `package.json`: `"preview": "vite --port 4173 --host 0.0.0.0"` — без подкоманды `preview`. Должно быть `"preview": "vite preview --port 4173 --host 0.0.0.0"`. Сейчас prod-build раздаётся только через med-proxy (Docker), а node-процесс на 4173 — это dev-сервер, бессмысленный в проде.

### 🟡 Средний приоритет

4. **Двухшаговый деплой без автоматизации** — легко забыть скопировать dist или пересобрать образ. Нужен `deploy.sh`.
5. **`dist/` запекается в Docker-образ COPY'ом** — каждый ребилд образа пересоздаёт слои. Лучше volume-mount `/root/med-proxy/dist` в контейнер → изменения подхватываются без ребилда.
6. **`vite.config.ts` содержит TAB-символ** в строке `allowedHosts` — esbuild на старых версиях падает (в логах pm2 был "Expected '}' but found 'proxy'"). Сейчас работает, но рискованно при апгрейдах.
7. **`proxy.on('proxyRes', ...)` регистрируется ВНУТРИ callback'а `proxy.on('proxyReq', ...)`** — это **memory leak**: каждый запрос регистрирует новый listener `proxyRes`. После N запросов — N listener'ов. В `vite.config.ts` proxy-блок.

### 🟢 Низкий приоритет

8. **`MISTRAL_MODEL` хардкод в `services/mistral.ts`** — нет возможности переключать модель из UI или env. Аналогично для Ollama (`gemma2:2b` в `.env` закомментирован, в коде fallback на `gpt-oss:20b-cloud`).
9. **`fallback=...:'http://192.168.50.250:11434'` в `services/ollama.ts`** — приватный IP захардкоден в коде, перебивает `.env`. Лучше убрать fallback или сделать его явно отключаемым.
10. **Отсутствует `.gitignore`-защита** для `.env`/`key/.env.local` — коммитятся ли ключи? Проверить.

---

## 6. Что сделано в этой сессии (для traceability)

1. ✅ Диагностика всех трёх AI-провайдеров прямыми curl-запросами.
2. ✅ Заменён Mistral API key в `/root/Projects/Pro-Med-Google/.env` и `/root/Projects/Pro-Med-Google/key/.env.local`.
3. ✅ В `services/mistral.ts`: модель `mistral-tiny` → `mistral-small-latest`.
4. ✅ `npm run build` — пересборка bundle.
5. ✅ Синхронизация `dist/` → `/root/med-proxy/dist/`.
6. ✅ `docker build -t root-med-proxy .` — пересборка образа.
7. ✅ Пересоздание контейнера `med-proxy` (старый удалён вручную, т.к. `docker compose` его не знает).
8. ✅ `pm2 restart med-app --update-env` — перезапуск node-процесса.

---

## 7. Что осталось пользователю

| # | Действие | Где |
|---|----------|-----|
| 1 | Hard-refresh Chrome (Ctrl+Shift+R) + при наличии SW — Unregister | браузер |
| 2 | Пополнить Gemini prepay или дать новый ключ | https://aistudio.google.com/projects |
| 3 | Запустить/починить Ollama на нужном хосте или дать актуальный `VITE_OLLAMA_BASE_URL` | инфраструктура |
| 4 | Решить: оставить `med-app` в PM2 или убрать (он дублирует функциональность med-proxy) | infra-решение |

---

## 8. Файлы изменённые

```
/root/Projects/Pro-Med-Google/.env                              (Mistral key)
/root/Projects/Pro-Med-Google/key/.env.local                    (Mistral key)
/root/Projects/Pro-Med-Google/services/mistral.ts               (model name)
/root/Projects/Pro-Med-Google/dist/                             (rebuilt)
/root/med-proxy/dist/                                           (synced from above)
/root/med-proxy/Dockerfile                                      (no change, but image rebuilt)
Docker image root-med-proxy                                     (rebuilt sha256:c06d6c11...)
Docker container med-proxy                                      (recreated)
PM2 process med-app id=1                                        (restarted --update-env)
```