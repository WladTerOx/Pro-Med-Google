# 001 — Подключить favicon.ico в index.html и добавить в git

**Создан:** 2026-08-05 20:47 UTC
**Приоритет:** 🟢 низкий
**Связано с:** audit/001 (web-стандарт, вкусовая полировка)

## Что сделать

1. Добавить в `<head>` `index.html` строку:
   ```html
   <link rel="icon" type="image/x-icon" href="/favicon.ico" />
   ```
2. `git add favicon.ico` (файл уже не игнорируется, его можно коммитить).
3. `npm run build` → пересобрать `dist/`.
4. Скопировать `dist/` в `/root/med-proxy/dist/`.
5. Пересобрать образ `root-med-proxy` и пересоздать контейнер `med-proxy`.

## Где

- `/root/Projects/Pro-Med-Google/index.html` — добавить link.
- `/root/Projects/Pro-Med-Google/favicon.ico` — git add.

## Зачем

- Сейчас файл лежит на диске, но `index.html` его не подключает → вкладка браузера показывает дефолтный «сломанный» значок.
- Файл 1.4 KB, потери нет.

## Acceptance criteria

- В исходнике `index.html` есть `<link rel="icon" href="/favicon.ico">`.
- `git ls-files favicon.ico` возвращает путь.
- После деплоя в DevTools → Network видно запрос `favicon.ico` со статусом 200.