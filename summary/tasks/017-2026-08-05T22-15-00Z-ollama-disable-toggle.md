# 017 — Ollama: env-toggle для временной заглушки

**Создан:** 2026-08-05 22:15 UTC
**Приоритет:** 🟡 средний
**Связано с:** [audit/006](../audit/006-2026-08-05T22-15-00Z-ollama-disable-toggle.md),
[tasks/008](../tasks/008-2026-08-05T20-47-38Z-ollama-host-investigation.md),
[tasks/012](../tasks/012-2026-08-05T21-10-00Z-fix-uncompleted-from-001-011.md) §12.6.
OpenSpec change `ollama-disable-toggle` (archived).

## Статус: ✅ Done

| ID | Задача | Оценка | Статус |
|---|---|---|---|
| 17.1 | `services/ai.ts` `case 'ollama'` — short-circuit при `VITE_OLLAMA_DISABLED='true'` | 1 мин | ✅ Done |
| 17.2 | Log-строка «Ollama disabled via VITE_OLLAMA_DISABLED» | 1 мин | ✅ Done |
| 17.3 | `.env` + `key/.env.local`: `VITE_OLLAMA_DISABLED=true` | 1 мин | ✅ Done |
| 17.4 | OpenSpec change `ollama-disable-toggle` → архив | 5 мин | ✅ Done |
| 17.5 | Main spec `ai-services` synced (2 новых scenario) | 5 мин | ✅ Done |
| 17.6 | Build + деплой (rsync + docker rebuild + container recreate) | 4 мин | ✅ Done |
| 17.7 | audit/006 + tasks/017 + CHANGELOG | 5 мин | ✅ Done |
| 17.8 | git commit + push | 2 мин | ✅ Done |

## Как включить обратно (когда Ollama починят)

Одна строка в `.env`:
```bash
sed -i 's|^VITE_OLLAMA_DISABLED=true|VITE_OLLAMA_DISABLED=false|' .env
sed -i 's|^VITE_OLLAMA_DISABLED=true|VITE_OLLAMA_DISABLED=false|' key/.env.local
```

И передеплоить (tasks/017.6).

## Что НЕ решает этот task

| # | Задача | Где |
|---|---|---|
| 1 | Починить Ollama-хост `162.19.248.57:11434` (или дать новый URL) | tasks/008 / 012.6 |
| 2 | Убрать хардкод `192.168.50.250:11434` в `services/ollama.ts` | tasks/011 / 012.8 |
| 3 | Обернуть `console.log('OLLAMA_*')` в `import.meta.env.DEV` | tasks/003 / 012.2 |

Этот task — **только** про временное отключение сетевой пробы. Не затрагивает
код `services/ollama.ts` (там все 4 функции `ollama.*` остаются на месте,
на случай если когда-нибудь хост оживёт).
