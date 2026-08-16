# 011 — Убрать захардкоженный fallback `192.168.50.250` в services/ollama.ts

**Создан:** 2026-08-05 20:47 UTC
**Приоритет:** 🟢 низкий
**Связано с:** audit/001 (technical debt 🟢 #9), tasks/008 (Ollama)

## Проблема

В `/root/Projects/Pro-Med-Google/services/ollama.ts`:

```ts
const OLLAMA_BASE_URL = import.meta.env.VITE_OLLAMA_BASE_URL || 'http://192.168.50.250:11434';
```

`192.168.50.250` — приватный IP, захардкожен в коде. Если кто-то:
- запустит проект в другом окружении (другой подсети) → пойдёт по неверному URL,
- уберёт `VITE_OLLAMA_BASE_URL` из `.env` → код молча пойдёт на старый IP,
- будет править `.env`, ожидая что код подхватит — а в одном месте уже стоит жёсткий fallback.

## Что сделать

Сделать fallback **явным и нейтральным** (localhost), либо вообще убрать, обязав заполнить env:

**Вариант А (рекомендую):** убрать fallback, требовать `VITE_OLLAMA_BASE_URL`:
```ts
const OLLAMA_BASE_URL = import.meta.env.VITE_OLLAMA_BASE_URL;
if (!OLLAMA_BASE_URL) {
    throw new Error('VITE_OLLAMA_BASE_URL is not set. See .env.example.');
}
```

В комплекте добавить `.env.example`:
```
VITE_MISTRAL_API_KEY=
VITE_API_KEY=
VITE_OLLAMA_BASE_URL=http://localhost:11434
VITE_OLLAMA_MODEL=gemma2:2b
```

**Вариант Б (минимальный):** сменить fallback на `http://localhost:11434`:
```ts
const OLLAMA_BASE_URL = import.meta.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434';
```

Всё равно лучше, чем приватный IP, потому что:
- `localhost` — стандартное ожидание для локального Ollama,
- приватный IP не «перенесётся» в чужое окружение.

## Где

- `/root/Projects/Pro-Med-Google/services/ollama.ts`
- (опционально) `/root/Projects/Pro-Med-Google/.env.example`

## Зачем

- Никаких скрытых приватных IP в публичном коде.
- Явное требование env для прод-настройки.

## Acceptance criteria

- В коде нет упоминаний `192.168.50.250`.
- В `.env.example` есть все 4 переменные с пустыми/дефолтными значениями.
- Проект стартует с пустым `.env` (после `cp .env.example .env`) — падает с понятной ошибкой про отсутствующий ключ, а не «висит».