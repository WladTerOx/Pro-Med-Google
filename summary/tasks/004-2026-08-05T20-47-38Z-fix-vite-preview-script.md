# 004 — Исправить `npm run preview` — он запускает dev-сервер, а не preview

**Создан:** 2026-08-05 20:47 UTC
**Приоритет:** 🟡 средний
**Связано с:** audit/001 (technical debt, критично если PM2-процесс станет основным)

## Проблема

В `/root/Projects/Pro-Med-Google/package.json`:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite --port 4173 --host 0.0.0.0"   ← 🐞 без подкоманды preview
}
```

`vite` без подкоманды = dev-сервер. То есть `npm run preview` запускает **dev**, а не `vite preview` (который отдаёт собранный `dist/`).

Сейчас это работает случайно:
- PM2 запускает `npm run preview` → стартует vite dev-сервер на 4173
- prod-трафик идёт через `med-proxy` (Docker) с правильно собранным `dist/`
- node-процесс на 4173 фактически никому не нужен (его никто не видит снаружи)

Если node-процесс когда-то станет основным (например, уберут Docker-обвязку) — будет отдаваться **неоптимизированная dev-сборка** с HMR-клиентом, сурс-мапами и т.п.

## Что сделать

В `package.json`:

```diff
-    "preview": "vite --port 4173 --host 0.0.0.0"
+    "preview": "vite preview --port 4173 --host 0.0.0.0"
```

После этого:
1. `pm2 restart med-app` (новый скрипт подхватится).
2. `curl -I http://localhost:4173/` → должно отдаваться `Last-Modified` от собранного `dist/index.html`, а не свежий HTML с `/@vite/client`.

## Где

- `/root/Projects/Pro-Med-Google/package.json`.

## Зачем

- Семантически правильное поведение: `preview` = prod-build, `dev` = dev-сервер.
- Меньше сюрпризов при смене деплоя.

## Acceptance criteria

- `npm run preview` запускает `vite preview` (видно в логах pm2: «vite preview …»).
- `curl -I http://localhost:4173/` возвращает `Last-Modified` совпадающий с `dist/index.html`.
- В HTML нет `/@vite/client` или `/@react-refresh`.