## 1. Dependencies

- [x] 1.1 `npm install -D tailwindcss@^3 postcss autoprefixer`
- [x] 1.2 Verify `node_modules/tailwindcss/package.json` exists and
      reports a 3.x version

## 2. Config files

- [x] 2.1 Create `tailwind.config.js` (ESM, since
      `package.json` has `"type": "module"`). Content globs:
      `'./index.html'`, `'./App.tsx'`, `'./components/**/*.{ts,tsx}'`.
      `darkMode: 'class'`.
- [x] 2.2 Create `postcss.config.js` (ESM) with plugins
      `tailwindcss` and `autoprefixer`.

## 3. Source CSS

- [x] 3.1 Create `index.css` at the project root containing
      `@tailwind base; @tailwind components; @tailwind utilities;`
      and nothing else.

## 4. Wire CSS into the React entry point

- [x] 4.1 Edit `index.tsx`: add `import './index.css';` as the first
      import.

## 5. Clean up `index.html`

- [x] 5.1 Remove `<script src="https://cdn.tailwindcss.com"></script>`
- [x] 5.2 Remove the inline `tailwind.config = { darkMode: 'class' }`
      block
- [x] 5.3 Remove the dangling `<link rel="stylesheet" href="/index.css">`
- [x] 5.4 KEEP the Google Fonts `<link>` and the inline `<style>`
      block with custom scrollbar rules

## 6. Verify build

- [x] 6.1 `npm run build` produces `dist/assets/index-*.css` alongside
      `dist/assets/index-*.js`
- [x] 6.2 `dist/index.html` references the hashed CSS via a
      `<link rel="stylesheet">` (Vite-injected) and contains no
      `<script src="…cdn.tailwindcss.com…">`
- [x] 6.3 CSS file size is in the expected ~10-30 KB range (Tailwind
      preflight + the utilities actually used by `App.tsx` and the
      two components)

## 7. Documentation

- [x] 7.1 `summary/audit/005-...-tailwind-build-time-migration.md`
- [x] 7.2 `summary/tasks/015-...-tailwind-build-time-migration.md`
- [x] 7.3 `CHANGELOG.md` — new entry
      `2026-08-05T21:50:00Z`

## 8. Spec sync

- [x] 8.1 OpenSpec change archived to
      `openspec/changes/archive/2026-08-05-tailwind-build-time-migration/`
- [x] 8.2 Main spec `openspec/specs/app-styling/spec.md` synced from
      the delta — five scenarios total
