# 002 — Заменить ecosystem.config.cjs на корректный для med-app

**Создан:** 2026-08-05 20:47 UTC
**Приоритет:** 🟡 средний
**Связано с:** audit/001 (ecosystem.config.cjs сейчас описывает чужие процессы)

## Проблема

Текущий `/root/Projects/Pro-Med-Google/ecosystem.config.cjs` описывает процесс `med-stack`, который запускает `docker compose up -d` из `/root` — это конфиг **gemini-live стека**, а не Pro-Med. К Pro-Med он не относится, ни на что не влияет, лежит по ошибке.

Реальный `med-app` запущен однострочной командой `pm2 start "npm run preview" --name med-app` без декларативного описания.

## Что сделать

1. Перезаписать `ecosystem.config.cjs` так, чтобы он описывал только `med-app`:
   ```js
   module.exports = {
     apps: [{
       name: 'med-app',
       cwd: '/root/Projects/Pro-Med-Google',
       script: 'npm',
       args: 'run preview',
       autorestart: true,
       max_memory_restart: '512M',
       env: {
         NODE_ENV: 'production',
       },
       out_file: '/root/.pm2/logs/med-app-out.log',
       error_file: '/root/.pm2/logs/med-app-error.log',
     }],
   };
   ```
2. Удалить старый процесс из PM2:
   ```
   pm2 delete med-app
   pm2 start /root/Projects/Pro-Med-Google/ecosystem.config.cjs
   pm2 save
   ```
3. Решить судьбу `med-stack` (сейчас errored) — отдельная задача (см. 003).

## Где

- `/root/Projects/Pro-Med-Google/ecosystem.config.cjs` — перезаписать.
- PM2 — пересоздать процесс.

## Зачем

- Декларативный конфиг вместо «магической команды в памяти».
- `pm2 resurrect` после перезагрузки сервера восстановит процесс с тем же env/лимитами.
- Новый разработчик/агент сразу видит, что и как запускается.

## Acceptance criteria

- `pm2 jlist` показывает `med-app` со `script: npm`, `args: run preview`, `cwd: /root/Projects/Pro-Med-Google`.
- `med-stack` либо удалён, либо вынесен в отдельный файл (см. задачу 003).
- `med-app` отвечает на http://localhost:4173/ (HTTP 200).