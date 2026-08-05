# 005 — Tailwind: миграция с Play CDN на build-time

**Дата:** 2026-08-05 21:50 UTC
**Автор:** pi-coding-agent (по запросу пользователя)
**Связано с:** OpenSpec change
`tailwind-build-time-migration` →
`openspec/changes/archive/2026-08-05-tailwind-build-time-migration/`.

---

## 1. Краткое резюме

Tailwind CSS теперь подключается **build-time**, а не через Play CDN.
Создан стандартный PostCSS-конвейер (`tailwindcss` + `autoprefixer`),
исходный CSS (`index.css`) импортируется из `index.tsx` и попадает в
бандл Vite как `dist/assets/index-*.css`.

**Что выиграли:**
- ✅ Production HTML больше **не зависит** от `cdn.tailwindcss.com`
- ✅ Никакого FOUC — стили приходят сразу с документом
- ✅ Никакого 404 на `<link rel="stylesheet" href="/index.css">`
- ✅ CSS — ~21 KB (gzip ~4 KB), кэшируется браузером по хешу
- ✅ Тёмная тема через `.dark` на корне (как и раньше)

---

## 2. Было / стало

### До

```html
<!-- index.html -->
<script src="https://cdn.tailwindcss.com"></script>
<script>tailwind.config = { darkMode: 'class' }</script>
<!-- ... -->
<link rel="stylesheet" href="/index.css">   <!-- ← 404 -->
```

```ts
// index.tsx — никакого import CSS
import App from './App';
```

```text
dist/
├─ index.html
└─ assets/
   └─ index-BVsapEYp.js   (608 KB, без CSS)
```

### После

```html
<!-- index.html — чистый -->
<title>PubMed AI Explorer</title>
<link href="https://fonts.googleapis.com/css2?family=Inter..." rel="stylesheet">
```

```ts
// index.tsx — добавлен импорт CSS в самом верху
import './index.css';
```

```text
dist/
├─ index.html                          (1.5 KB — Vite инжектит <link> на css)
└─ assets/
   ├─ index-DTchTZfp.css               (21.43 KB / gzip 4.38 KB)
   └─ index-BfbMhpw5.js                (613.53 KB / gzip 160.22 KB)
```

---

## 3. Созданные / изменённые файлы

| Файл | Δ | Назначение |
|---|---|---|
| `package.json` | +3 devDependencies | `tailwindcss@^3`, `postcss`, `autoprefixer` |
| `package-lock.json` | синк | lockfile обновлён через `npm install` |
| `tailwind.config.js` | новый (249 B, ESM) | `content` globs, `darkMode: 'class'` |
| `postcss.config.js` | новый (93 B, ESM) | tailwindcss + autoprefixer |
| `index.css` | новый (59 B) | `@tailwind base/components/utilities` |
| `index.tsx` | +1 строка (`import './index.css';`) | Vite видит CSS, прогоняет через PostCSS |
| `index.html` | -7 строк | Удалены CDN-скрипт, inline-конфиг, dangling link |
| `dist/index.html` | регенерирован | Vite инжектит `<link>` на `index-DTchTZfp.css` |
| `openspec/specs/app-styling/spec.md` | новый (2.8 KB) | Главный спек: build-time Tailwind, no CDN, dark-mode class |
| `openspec/changes/archive/2026-08-05-tailwind-build-time-migration/` | новый | Архив change: proposal/design/tasks/delta-spec |
| `summary/audit/005-...md` | новый | Этот файл |
| `summary/tasks/015-...md` | новый | Checklist |
| `CHANGELOG.md` | +1 entry | |

**Без коммита изменены** (gitignored): ничего.

---

## 4. Проверка работоспособности

### 4.1 Сборка

```text
$ npm run build
vite v6.4.1 building for production...
✓ 201 modules transformed.
dist/index.html                   1.54 kB │ gzip:   0.70 kB
dist/assets/index-DTchTZfp.css   21.43 kB │ gzip:   4.38 kB
dist/assets/index-BfbMhpw5.js   613.53 kB │ gzip: 160.22 kB
✓ built in 3.88s
```

✅ CSS появился в `dist/assets/`.
✅ Размер в ожидаемом диапазоне ~10-30 KB.
✅ Build time: ~3.9 s (постпроцесс добавляет ~1-2 s).

### 4.2 Содержимое CSS

- Preflight: `*,:before,:after{--tw-…:0;…}` ✅
- Utility-классы: `flex`, `rounded-*`, `dark:bg-gray-700` (escape:
  `dark\:bg-gray-700`), `bg-indigo-600`, и т.д. ✅

### 4.3 `dist/index.html` после сборки

```html
<title>PubMed AI Explorer</title>
<link href="https://fonts.googleapis.com/css2?family=Inter..." rel="stylesheet">
<style>...</style>
<script type="importmap">...</script>
<script type="module" crossorigin src="/assets/index-BfbMhpw5.js"></script>
<link rel="stylesheet" crossorigin href="/assets/index-DTchTZfp.css">
</head>
```

✅ Vite автоматически вставил `<link rel="stylesheet" crossorigin href="/assets/index-DTchTZfp.css">`.
✅ Никаких `cdn.tailwindcss.com`.
✅ Никаких dangling `href="/index.css"`.

### 4.4 Соответствие 111 `className` в исходниках

```
App.tsx: 91 вхождение className
components/ArticleModal.tsx: 20 вхождений
Итого: 111
```

Все эти utility-классы теперь подкреплены реальным CSS в bundle.
Все `dark:*` варианты работают (т.к. `darkMode: 'class'`).

---

## 5. Что осталось пользователю

| # | Действие | Зачем |
|---|---|---|
| 1 | `rsync -a --delete dist/ /root/med-proxy/dist/` | доставить новый bundle |
| 2 | `(cd /root/med-proxy && docker build -t root-med-proxy .)` | пересобрать образ |
| 3 | `docker rm -f med-proxy && docker compose up -d med-proxy` | пересоздать контейнер |
| 4 | Hard-refresh в Chrome | сбросить кэш старого `<script src="…cdn…">` |

После — UI должен выглядеть **идентично** (те же классы), но грузится
без ожидания CDN и без FOUC.

Скажите «деплой» — выполню шаги 1-3.

---

## 6. Замечания для следующего цикла (НЕ в этом коммите)

| # | Что | Файл |
|---|---|---|
| 1 | `package-lock.json` сообщает о 7 vulnerabilities (1 low, 6 high) в dev-цепочке Tailwind; не критично для prod-bundle | review later |
| 2 | Vite предупреждает: `chunk > 500 kB`. Можно сделать `manualChunks`, разделив React, react-dom, и AI SDK в отдельные чанки | `vite.config.ts` future |
| 3 | Деплой-флоу пока ручной (`summary/tasks/012` уже трекал это как #12.4) — можно собрать `deploy.sh` | next cycle |
| 4 | Tailwind v4 миграция: переход на `@tailwindcss/vite` плагин и CSS-first конфиг. Не нужно сейчас. | out of scope |
