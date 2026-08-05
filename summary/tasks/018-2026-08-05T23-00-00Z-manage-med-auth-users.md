# 018 — Управление пользователями med-auth (basic-auth для med.openaiua.cloud)

**Создан:** 2026-08-05 23:00 UTC
**Приоритет:** 🟡 средний (после деплоя)
**Связано с:** [audit/007](../audit/007-2026-08-05T23-00-00Z-traefik-basic-auth-med-proxy.md),
OpenSpec change `traefik-basic-auth-med-proxy` (archived),
spec `deployment-auth/spec.md`.

## Статус: 🟡 Pending operator onboarding

| ID | Задача | Статус |
|---|---|---|
| 18.1 | OpenSpec change `traefik-basic-auth-med-proxy` archived | ✅ Done |
| 18.2 | Spec `deployment-auth/spec.md` synced (6 scenarios) | ✅ Done |
| 18.3 | `/root/med-auth/` директория создана (mode 700) | ✅ Done |
| 18.4 | `add-med-user.sh`, `del-med-user.sh`, `list-med-users.sh`, `regen-med-labels.sh` (executable) | ✅ Done |
| 18.5 | Empty-htpasswd guard в `regen-med-labels.sh` | ✅ Done |
| 18.6 | Traefik-restart внутри `regen-med-labels.sh` | ✅ Done |
| 18.7 | med-proxy с auth labels, restarted Traefik, восстановлен router | ✅ Done |
| 18.8 | Smoke test: anonymous/bogus/correct → 401/401/200 | ✅ Done |
| 18.9 | Удалить demo `testuser1` | ⛔ Pending operator |
| 18.10 | Добавить боеOWе юзеры через `add-med-user.sh` | ⛔ Pending operator |
| 18.11 | Добавить `*.sh` и `/root/med-auth/` в gitignore-чеклист (НЕ должны попасть в git; сейчас только не-существующие) | ✅ Done (файлы в `/root/med-auth/`, не в репо) |

## Быстрый старт (для оператора)

```bash
# 1) Удалить demo-пользователя
/root/med-auth/del-med-user.sh testuser1

# 2) Добавить себя
/root/med-auth/add-med-user.sh me
# (введите пароль дважды, без эха)

# 3) Проверить
/root/med-auth/list-med-users.sh
curl -u me:ВАШ-ПАРОЛЬ -sk -o /dev/null -w "HTTP %{http_code}\n" \
  --max-time 8 https://med.openaiua.cloud/

# 4) Добавить коллегу
/root/med-auth/add-med-user.sh colleague-name
```

## Известные gotchas (документировано в audit/007 §10)

| Gotcha | Workaround |
|---|---|
| Traefik v3 не делает graceful reload на SIGHUP | Полный restart (~5-10s downtime на все Traefik-сервисы) |
| Пустой `.htpasswd` вызывает Traefik panic (`users=""`) | `regen-med-labels.sh` отказывается и подсказывает команду add |
| Username с `,` или `:` ломает label parsing | add-med-user.sh валидирует: `[a-z][a-z0-9_-]{1,31}` |
| Сессии браузера кэшируют basic-auth между запросами | OK для одного юзера; для передачи другому — clear credentials в браузере или Logout |

## Когда НЕ использовать эту auth

| Если | Используйте вместо |
|---|---|
| Много юзеров (50+) и хочется по логам видеть кто заходил | `oauth2-proxy` + GitHub OAuth |
| Хочется 2FA / SSO через Google / Microsoft | Cloudflare Access |
| Нужно временно открыть сайт для конкретного IP | Traefik `ipallowlist` middleware (отдельный change) |

## Файлы вне репо (на хосте, НЕ в git)

```
/root/med-auth/                          700
├── .htpasswd                            600 (htpasswd формат)
├── add-med-user.sh                      755
├── del-med-user.sh                      755
├── list-med-users.sh                    755
└── regen-med-labels.sh                  755
```

Все скрипты можно редактировать напрямую — каждый recreate
контейнера берёт свежее состояние файла.
