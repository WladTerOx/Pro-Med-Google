# 005 — Сделать автоматический деплой одной командой (deploy.sh)

**Создан:** 2026-08-05 20:47 UTC
**Приоритет:** 🟡 средний
**Связано с:** audit/001 (двухшаговый деплой — источник сегодняшнего 30-минутного дебага 401)

## Проблема

Сейчас цикл деплоя — 4 ручных шага, любой из которых легко забыть:

```
1. правишь код в /root/Projects/Pro-Med-Google/
2. npm run build
3. cp -r dist /root/med-proxy/dist      ← ЗАБЫЛ = старая версия в проде
4. docker build -t root-med-proxy .     ← ЗАБЫЛ = чужой образ
5. docker rm med-proxy && docker run … ← ЗАБЫЛ = старый контейнер крутится
```

Подтверждение из этой сессии: пользователь жёстко обновил Chrome, увидел 401, начал грешить на кэш браузера — а проблема была в том, что `dist/index-DFKI9Dh-.js` отдавался из **старого** Docker-контейнера.

## Что сделать

Создать `/root/Projects/Pro-Med-Google/deploy.sh` (или `/root/med-proxy/deploy.sh`):

```bash
#!/bin/bash
set -euo pipefail

PROJ="/root/Projects/Pro-Med-Google"
PROXY="/root/med-proxy"

echo "[1/4] Building Vite bundle…"
(cd "$PROJ" && npm run build)

echo "[2/4] Syncing dist → med-proxy…"
rm -rf "$PROXY/dist"
cp -r "$PROJ/dist" "$PROXY/dist"

echo "[3/4] Building Docker image…"
(cd "$PROXY" && docker build -t root-med-proxy .)

echo "[4/4] Recreating container…"
docker stop med-proxy 2>/dev/null || true
docker rm   med-proxy 2>/dev/null || true
docker run -d --name med-proxy --network host --restart unless-stopped \
  --label traefik.enable=true \
  --label traefik.http.routers.med.entrypoints=web,websecure \
  --label traefik.http.routers.med.rule='Host(`med.openaiua.cloud`)' \
  --label traefik.http.routers.med.tls=true \
  --label traefik.http.services.med.loadbalancer.server.port=8083 \
  root-med-proxy

echo "Done. Verify: curl -I https://med.openaiua.cloud/"
```

`chmod +x deploy.sh`.

После правок кода: `./deploy.sh` вместо 4 команд.

## Где

- `/root/Projects/Pro-Med-Google/deploy.sh` (или `/root/med-proxy/deploy.sh`).

## Опционально (бонус)

- **Вместо COPY в Dockerfile** примонтировать `/root/med-proxy/dist` в контейнер как volume. Тогда `docker build` не нужен — меняется только содержимое папки.
- Заменить `docker run …` на `docker compose up -d med-proxy` (если добавить `med-proxy` в `/root/docker-compose.yml` — сейчас его там нет).

## Acceptance criteria

- `./deploy.sh` отрабатывает без ошибок и `https://med.openaiua.cloud/` отдаёт свежий `Last-Modified`.
- Время деплоя < 1 минуты.
- В gitignore: `deploy.sh` либо добавлен в git (если хочется версионировать), либо в `.gitignore` (если локальный).