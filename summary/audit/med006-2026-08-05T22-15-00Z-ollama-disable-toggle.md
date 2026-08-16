# 006 — Ollama: env-driven временная заглушка

**Дата:** 2026-08-05 22:15 UTC
**Автор:** pi-coding-agent (по запросу пользователя, «заглуши пока ollama»)
**Связано с:** [audit/med001](./med001-2026-08-05T19-31-33Z-all-ai-keys-broken.md),
[audit/med002](./med002-2026-08-05T21-10-00Z-all-fixes-and-ai-fallback-migration.md),
[tasks/med001.8](../tasks/med001.8-2026-08-05T20-47-38Z-ollama-host-investigation.md),
[tasks/011](../tasks/011-2026-08-05T20-47-38Z-remove-hardcoded-ollama-fallback.md),
[tasks/012](../tasks/012-2026-08-05T21-10-00Z-fix-uncompleted-from-001-011.md) §12.6.
OpenSpec change `ollama-disable-toggle` →
`openspec/changes/archive/2026-08-05-ollama-disable-toggle/`.

---

## 1. Краткое резюме

Ollama-хост по-прежнему **недоступен** (та же сетевая проблема, что в
audit/001 и audit/002). Каждый AI-вызов сейчас:

1. Тратит ~8 секунд на таймаут `fetch('/api/ollama/api/tags')` через
   Vite proxy
2. Засоряет консоль: `Ollama connection test result: false` /
   `Ollama connection test failed: ...`

Чтобы убрать эти потери **без правок кода** при будущем починении хоста,
добавлен env-toggle `VITE_OLLAMA_DISABLED=true`. При значении `'true'`
`services/ai.ts:case 'ollama'` short-circuit'ит и возвращает `false`
**до** сетевого вызова.

---

## 2. Изменения

| Файл | Δ |
|---|---|
| `services/ai.ts` | +5 строк в `case 'ollama'`: проверка `import.meta.env.VITE_OLLAMA_DISABLED`; если `'true'` — лог + return false |
| `.env` | +1 строка `VITE_OLLAMA_DISABLED=true` с поясняющим комментом |
| `key/.env.local` | identical |
| `openspec/changes/archive/2026-08-05-ollama-disable-toggle/` | 4 файла (proposal, design, delta spec, tasks) |
| `openspec/specs/ai-services/spec.md` | MODIFIED requirement «Provider availability test» + 2 новых сценария |
| `summary/audit/006-...md` | этот файл |
| `summary/tasks/017-...md` | 8-row checklist |
| `CHANGELOG.md` | +1 entry |

---

## 3. Почему именно env-переключатель (а не правка кода)

| Вариант | За/против |
|---|---|
| Жёстко `return false` в `case 'ollama'` | просто, но требует пересборки/деплоя при починке хоста |
| Env `VITE_OLLAMA_DISABLED` | ✅ реверс одной строкой в `.env`, без кода |
| Захардкодить fallback на `false` при любой ошибке | необратимо: при починке хоста всё равно придётся править код |

Выбран env-toggle: пользователь обещал временно; когда Ollama вернётся,
достаточно убрать строку из `.env`.

---

## 4. Поведение после применения

### `VITE_OLLAMA_DISABLED=true` (текущее состояние)

```text
[AI-запрос]
Testing Gemini API...
Gemini API test result: true
Testing MiniMax API...
MiniMax API test result: true
Testing Mistral API...
Mistral API test result: true
Ollama disabled via VITE_OLLAMA_DISABLED     ← новое
```

Никакого `fetch('/api/ollama/api/tags')`, никакого таймаута. Латентность
уменьшается на ~8 сек на каждом AI-вызове.

### `VITE_OLLAMA_DISABLED=false` (или строка удалена)

```text
[AI-запрос]
Testing Ollama connection...
Ollama connection test result: true | false
```

Обычная проба, как было до этого change.

---

## 5. Что НЕ входит в эту фиксацию (track elsewhere)

| Пункт | Где |
|---|---|
| Починить хост `162.19.248.57:11434` (или дать новый URL) | tasks/008, tasks/012.6 |
| Убрать хардкод `192.168.50.250:11434` в `services/ollama.ts` | tasks/011, tasks/012.8 |
| Обернуть `console.log('OLLAMA_*')` в `import.meta.env.DEV` | tasks/003, tasks/012.2 |

Когда хост оживёт — поменять одну строку в `.env` и пересобрать.

---

## 6. Файлы изменённые (для git)

```
M  services/ai.ts                    (+5 строк)
?? openspec/changes/archive/2026-08-05-ollama-disable-toggle/
   ├─ .openspec.yaml
   ├─ proposal.md
   ├─ design.md
   ├─ specs/ai-services/spec.md     (MODIFIED)
   └─ tasks.md
M  openspec/specs/ai-services/spec.md  (MODIFIED — 2 new scenarios)
A  summary/audit/006-...md             (этот файл)
A  summary/tasks/017-...md             (checklist)
M  CHANGELOG.md                        (+1 entry)

# Out of repo (.gitignore):
.env
key/.env.local
```
