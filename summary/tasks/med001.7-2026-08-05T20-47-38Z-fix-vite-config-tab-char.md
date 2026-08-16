# 007 — Убрать TAB-символ в vite.config.ts (allowedHosts)

**Создан:** 2026-08-05 20:47 UTC
**Приоритет:** 🟢 низкий
**Связано с:** audit/001 (technical debt 🟡 #6)

## Проблема

В `/root/Projects/Pro-Med-Google/vite.config.ts` строка `allowedHosts` начинается с TAB-символа (`\t`) вместо пробелов:

```
            //allowedHosts: true,
^I    allowedHosts: ['med.openaiua.cloud'],
```

`^I` = TAB. В текущей версии esbuild (Vite 6.4) это работает, но в более ранних сборках PM2-логи уже ловили ошибку:
```
[ERROR] Expected "}" but found "proxy"
vite.config.ts:14:12
```

При апгрейдах Vite/esbuild есть риск повторения.

## Что сделать

В `vite.config.ts` заменить TAB в начале строки `allowedHosts: ['med.openaiua.cloud'],` на пробелы (выровнять по остальной индентации — 12 пробелов).

## Где

- `/root/Projects/Pro-Med-Google/vite.config.ts`, строка 13.

## Зачем

- Унифицировать индентацию.
- Снизить риск регрессии при апгрейдах Vite/esbuild.

## Acceptance criteria

- `cat -A vite.config.ts | grep allowedHosts` показывает только пробелы в начале строки.
- `npm run dev` стартует без ошибок.