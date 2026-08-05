# 015 — Tailwind: build-time миграция (CDN → PostCSS)

**Создан:** 2026-08-05 21:50 UTC
**Приоритет:** 🟡 средний
**Связано с:** [audit/005](../audit/005-2026-08-05T21-50-00Z-tailwind-build-time-migration.md),
OpenSpec change `tailwind-build-time-migration` (archived).

## Статус: ✅ Done (код) + 🟡 Pending deploy

| ID | Задача | Оценка | Статус |
|---|---|---|---|
| 15.1 | `npm install -D tailwindcss@^3 postcss autoprefixer` | 30 сек | ✅ Done |
| 15.2 | Создать `tailwind.config.js` (ESM, content globs, darkMode: class) | 1 мин | ✅ Done |
| 15.3 | Создать `postcss.config.js` (ESM, plugins tailwindcss + autoprefixer) | 1 мин | ✅ Done |
| 15.4 | Создать `index.css` с тремя `@tailwind` директивами | 1 мин | ✅ Done |
| 15.5 | `index.tsx`: добавить `import './index.css';` | 1 мин | ✅ Done |
| 15.6 | `index.html`: убрать CDN-скрипт, inline-конфиг, dangling `<link>` | 2 мин | ✅ Done |
| 15.7 | `npm run build` — должен появиться `dist/assets/index-*.css` | 5 сек | ✅ Done (21.43 KB) |
| 15.8 | Убедиться, что в `dist/index.html` нет `cdn.tailwindcss.com` | 5 сек | ✅ Done |
| 15.9 | OpenSpec change `tailwind-build-time-migration` → archived | 10 мин | ✅ Done |
| 15.10 | Main spec `openspec/specs/app-styling/spec.md` создан и synced | 5 мин | ✅ Done |
| 15.11 | audit/005 + tasks/015 + CHANGELOG docs | 5 мин | ✅ Done |
| 15.12 | `rsync -a --delete dist/ /root/med-proxy/dist/` | 5 сек | ⛔ Pending |
| 15.13 | `(cd /root/med-proxy && docker build -t root-med-proxy .)` | ~2 мин | ⛔ Pending |
| 15.14 | `docker rm -f med-proxy && docker compose up -d med-proxy` | 10 сек | ⛔ Pending |
| 15.15 | Hard-refresh в Chrome (Ctrl+Shift+R), визуальная проверка идентичности UI | 10 сек | ⛔ Pending |

## Почему можно коммитить уже сейчас

Все изменения **изолированы в build-конвейере**: если по какой-то причине
новый `index.css` окажется сломан, `dist/assets/index-*.css` всё равно
присутствует, и страница грузится корректно (Vite всегда генерирует
`<link>` из импорта). Развёртывание безопасно в любой момент — **до
этого commit'а CSS всё равно работал через CDN** (медленнее, но работал);
**после commit'а** CSS работает через bundle (быстрее, надёжнее).
