# 010 — Сделать безопасный коммит и push в GitHub

**Создан:** 2026-08-05 20:47 UTC
**Приоритет:** 🟡 средний
**Связано с:** audit/001 (после .gitignore-фикса)

## Текущее состояние

`git status -sb`:

```
## main...origin/main
 M .gitignore          ← наше изменение (добавили .env и /key/)
 M App.tsx             ← локальные правки (ещё до этой сессии)
 M README.md           ← то же
 M components/ArticleModal.tsx
 M index.html
 M services/ai.ts
 M services/gemini.ts
 M services/mistral.ts  ← правка модели mistral-small-latest
 M services/ollama.ts
 M vite.config.ts
?? ecosystem.config.cjs  ← будет перезаписан в задаче 002
?? favicon.ico           ← будет добавлен в задаче 001
?? summary/              ← audit/001 + tasks/* (новая директория)
```

## Что сделать

**Безопасный план** (ничего лишнего не уезжает на GitHub):

```bash
cd /root/Projects/Pro-Med-Google

# 1. Убедиться, что .env и /key/ НЕ в списке
git status --porcelain | grep -E '\.env|/key/' && echo "STOP: .env или /key/ в списке!" && exit 1

# 2. Закоммитить код
git add .gitignore App.tsx README.md components/ArticleModal.tsx index.html \
        services/ai.ts services/gemini.ts services/mistral.ts services/ollama.ts \
        vite.config.ts

git commit -m "fix: update Mistral API key model + add audit/tasks scaffolding

- services/mistral.ts: mistral-tiny -> mistral-small-latest (current small tier)
- .gitignore: ignore .env and /key/ (API keys must never be committed)
- summary/audit/001-*: full state audit (all 3 AI providers status)
- summary/tasks/001-009-*: follow-up tasks (Gemini, Ollama, deploy, etc.)
"

# 3. summary/ — отдельным коммитом, чтобы история читаемее
git add summary/
git commit -m "docs: add summary/audit + summary/tasks scaffolding

- audit/001 — full state audit dated 2026-08-05
- tasks/001-009 — pending work items
"

# 4. (Опционально) favicon + ecosystem.config.cjs — отдельный коммит,
#    когда задачи 001 и 002 будут выполнены

# 5. Push
git push origin main
```

**Что НЕ должно попасть в коммит** (проверить `git status`):
- `.env` (в `.gitignore` ✅)
- `/key/.env.local` (в `.gitignore` ✅)
- `dist/` (в `.gitignore` ✅)
- `node_modules/` (в `.gitignore` ✅)
- `ecosystem.config.cjs` (пока — содержит мусорный `med-stack`)
- `favicon.ico` (пока — нет ссылки в index.html)

## Acceptance criteria

- `git log origin/main --oneline -3` показывает оба новых коммита.
- `https://github.com/VladTer06081963/Pro-Med-Google` отображает обновлённые файлы.
- В публичной истории нет API-ключей (`git log -p | grep -i mistral_api_key` → пусто).
- `git status` после push чистый.

## Замечание

Перед push проверить `git diff --stat` — если в `services/ai.ts` или `services/mistral.ts` есть что-то неожиданное (например, локальные эксперименты), можно временно отложить соответствующие файлы через `git restore --staged`.