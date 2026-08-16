# 006 — Устранить memory leak в vite.config.ts (proxy.on внутри proxyReq)

**Создан:** 2026-08-05 20:47 UTC
**Приоритет:** 🟡 средний
**Связано с:** audit/001 (technical debt 🟡 #7)

## Проблема

В `/root/Projects/Pro-Med-Google/vite.config.ts` (строки ~21–32):

```ts
configure: (proxy, options) => {
    proxy.on('proxyReq', (proxyReq, req) => {
        proxyReq.removeHeader('origin')
        proxyReq.removeHeader('referer')
        const origin = req.headers.origin;
        proxy.on('proxyRes', (proxyRes) => {       // ← 🐞 listener регается ВНУТРИ
            proxyRes.headers['Access-Control-Allow-Origin'] = origin || '*'
            proxyRes.headers['Access-Control-Allow-Headers'] = '*'
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
        });
    });
},
```

На каждый входящий запрос регистрируется **новый** listener `proxyRes` на прокси. EventEmitter-у слушатели копятся — после N запросов имеем N listener'ов на `proxyRes`. Утечка памяти + деградация (лишние вызовы на каждый ответ).

## Что сделать

Перенести регистрацию `proxyRes` наружу — один раз на этапе `configure`, а `origin` пробрасывать через замыкание:

```ts
configure: (proxy, options) => {
    proxy.on('proxyReq', (proxyReq, req) => {
        proxyReq.removeHeader('origin')
        proxyReq.removeHeader('referer')
    });
    proxy.on('proxyRes', (proxyRes) => {
        const origin = proxyRes.req.headers.origin;
        proxyRes.headers['Access-Control-Allow-Origin'] = origin || '*'
        proxyRes.headers['Access-Control-Allow-Headers'] = '*'
        proxyRes.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    });
},
```

Проверить: `proxyRes.req.headers.origin` доступен (http-proxy проксирует req как `proxyRes.req`).

## Где

- `/root/Projects/Pro-Med-Google/vite.config.ts`.

## Зачем

- Убрать утечку памяти.
- Не выполнять N лишних listener'ов на каждом proxy-ответе.

## Acceptance criteria

- Структура listener'ов: ровно 1 на `proxyRes`, 1 на `proxyReq`.
- Под нагрузкой (curl в цикле 1000 раз `/api/ollama/...`) — `process.memoryUsage().heapUsed` стабилен, без роста.
- Проксирование Ollama продолжает работать (если когда-нибудь оживёт).