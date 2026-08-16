# 007 — Закрыли med.openaiua.cloud Traefik basic-auth

**Дата:** 2026-08-05 23:00 UTC
**Автор:** pi-coding-agent (по запросу пользователя — «закрыть от посторонних»)
**Связано с:** OpenSpec change
`traefik-basic-auth-med-proxy` →
`openspec/changes/archive/2026-08-05-traefik-basic-auth-med-proxy/`.
Новая capability `deployment-auth` →
`openspec/specs/deployment-auth/spec.md`.

---

## 1. Краткое резюме

`med.openaiua.cloud` теперь требует HTTP Basic Auth. Анонимный
запрос → `HTTP 401` + `WWW-Authenticate: Basic realm="Med Proxy
(auth required)"`. Список пользователей живёт на хосте
(`/root/med-auth/.htpasswd`, `chmod 600`, **не в git**),
обслуживается через 4 helper-скрипта.

**Изменения только в reverse-proxy (Traefik) и в метаданных
контейнера `med-proxy`** — никакого кода приложения, никакого
`dist/index.html`.

---

## 2. Было / стало

```diff
# curl до
$ curl -sk https://med.openaiua.cloud/
HTTP 200  ← доступно всем

# curl после
$ curl -sk https://med.openaiua.cloud/
HTTP 401
WWW-Authenticate: Basic realm="Med Proxy (auth required)"

$ curl -sk -u testuser1:TestPass123abc https://med.openaiua.cloud/
HTTP 200  ← React bundle
```

---

## 3. Архитектура решения

```
┌─────────────────────────────────────────────────────────────┐
│  Браузер                                                    │
└─────────────────────────────────────────────────────────────┘
                       │ TLS
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Traefik (root-traefik-1, host net)                         │
│   ├── router: med@docker (rule: Host(\`med.openaiua.cloud\`))│
│   ├── middlewares: med-auth@docker                          │
│   │       ├── basicauth.users=testuser1:$2y$10$…           │
│   │       └── basicauth.realm="Med Proxy (auth required)"   │
│   └── load balancer → 8083                                  │
└─────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  med-proxy (root-med-proxy)                                 │
│   └── nginx:alpine listening on :8083, serves dist/         │
└─────────────────────────────────────────────────────────────┘
```

Auth-state — в **Traefik labels** на контейнере `med-proxy`,
не в `med-proxy` (`nginx.conf` остался как есть). Это даёт
redeploy `med-proxy` без потери auth-config.

---

## 4. Файлы

### 4.1 В репо (код/specs/docs)

| Файл | Δ |
|---|---|
| `openspec/specs/deployment-auth/spec.md` | новый (2.8 KB) |
| `openspec/changes/archive/2026-08-05-traefik-basic-auth-med-proxy/` | 4 файла |
| `summary/audit/007-...md` | этот файл |
| `summary/tasks/018-...md` | checklist |
| `CHANGELOG.md` | +1 entry |

### 4.2 Вне репо (на хосте, gitignored)

| Путь | Режим | Назначение |
|---|---|---|
| `/root/med-auth/` | `700` | каталог auth-инфры |
| `/root/med-auth/.htpasswd` | `600` | htpasswd-файл |
| `/root/med-auth/add-med-user.sh` | `755` | добавить юзера |
| `/root/med-auth/del-med-user.sh` | `755` | удалить юзера |
| `/root/med-auth/list-med-users.sh` | `755` | список юзеров (без хешей) |
| `/root/med-auth/regen-med-labels.sh` | `755` | recreate med-proxy + restart Traefik |

---

## 5. Helper-скрипты

### add-med-user.sh `<username>`

```bash
$ /root/med-auth/add-med-user.sh alice
Enter password for 'alice': ********
Confirm password: ********
Added 'alice' to /root/med-auth/.htpasswd.
Recreated med-proxy with 2 user(s). Realm: 'Med Proxy (auth required)'.
Test: curl -u user:pass https://med.openaiua.cloud/
```

Internals:
- `read -rs` для безопасного ввода (без echo, без истории)
- bcrypt cost 10 через Python (`pip install` не нужен, пакет уже есть)
- Валидация username: lowercase letters/digits/`-`/`_`, 2–32 chars
- Защита от clobber: повторное добавление **откажется**, потребуется `del-med-user` сначала
- В конце вызывает `regen-med-labels.sh` для recreate Traefik

### del-med-user.sh `<username>`

```bash
$ /root/med-auth/del-med-user.sh alice
Removed 'alice'.
Recreated med-proxy with 1 user(s). ...
```

If empty file:
```
ERROR: /root/med-auth/.htpasswd is empty.
Add at least one user first:
    /root/med-auth/add-med-user.sh <username>
```

### list-med-users.sh

```bash
$ /root/med-auth/list-med-users.sh
Users in /root/med-auth/.htpasswd:
     1	testuser1
```

### regen-med-labels.sh

```bash
$ /root/med-auth/regen-med-labels.sh
Restarting Traefik to pick up the new med-auth middleware...
Recreated med-proxy with 1 user(s). Realm: 'Med Proxy (auth required)'.
Test: curl -u user:pass https://med.openaiua.cloud/
```

---

## 6. Что было сделано в этой сессии

| Действие | Результат |
|---|---|
| Empty htpasswd → recreate с auth labels | ❌ Traefik **panic** на пустом `users=""` — `panic: runtime error: index out of range` в middleware builder |
| Решение: добавил guard в `regen-med-labels.sh` | ✅ refuse-with-error если файл пуст |
| SIGHUP к Traefik для graceful reload | ❌ Traefik v3 не умеет — SIGHUP убивает процесс без reload |
| `docker restart root-traefik-1` | ✅ ~5-10 s downtime на ВСЕ Traefik-сервисы; auth labels подхватываются чисто |
| Traefik restart docs | вшит в `regen-med-labels.sh` (после recreate med-proxy) |

---

## 7. Smoke-test (как видно из deploy)

```
Anonymous:    HTTP 401 | WWW-Authenticate: Basic realm="Med Proxy (auth required)"
Bogus creds:  HTTP 401
Good creds:   HTTP 200 (testuser1:TestPass123abc)
```

---

## 8. Текущий пользователь

В `.htpasswd` лежит **демо**-юзер `testuser1` с паролем
`TestPass123abc`. После проверки удалите его:

```bash
/root/med-auth/del-med-user.sh testuser1
/root/med-auth/add-med-user.sh <your-real-username>
```

И добавьте боеOWе username + пароль.

---

## 9. Что осталось пользователю

| # | Действие |
|---|---|
| 1 | Удалить demo `testuser1`: `del-med-user.sh testuser1` |
| 2 | Добавить себя: `add-med-user.sh <your-username>` |
| 3 | Пригласить команду: каждый пользователь добавляется через `add-med-user.sh` |
| 4 | Сохранить пароли вне чата / истории bash |

## 10. Известные ограничения

- **5-10 s downtime** на все Traefik-сервисы при каждом
  add/remove пользователя (Traefik v3 не умеет
  graceful config reload)
- **Один общий пароль на человека** — если хочется разделять
  сессии (audit log per user), переходите на
  oauth2-proxy / Cloudflare Access
- Traefik access log OFF — здесь это фича (не логируем
  `Authorization` header). Если нужен audit log —
  отдельный change с hashed-pw-only logging

## 11. Rollback

Полностью: одна команда
```bash
docker rm -f med-proxy
docker run -d --name med-proxy --restart unless-stopped --network host \
  --label traefik.enable=true \
  --label traefik.http.routers.med.entrypoints=web,websecure \
  --label "traefik.http.routers.med.rule=Host(\`med.openaiua.cloud\`)" \
  --label traefik.http.routers.med.tls=true \
  --label traefik.http.services.med.loadbalancer.server.port=8083 \
  root-med-proxy >/dev/null
docker restart root-traefik-1
```

Сайт снова без auth. open/close в течение ~10 сек.
