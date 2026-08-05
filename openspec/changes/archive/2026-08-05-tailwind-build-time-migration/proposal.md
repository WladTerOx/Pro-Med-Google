## Why

The application styles itself with Tailwind CSS classes embedded in
`App.tsx` and `components/ArticleModal.tsx`, but **no Tailwind
toolchain is configured in the project**. The current setup pulls
Tailwind at runtime via the Play CDN in `index.html`:

```html
<script src="https://cdn.tailwindcss.com"></script>
<script>tailwind.config = { darkMode: 'class' }</script>
```

This was an audit finding on **2026-08-05** (see
`summary/audit/005-…`). It has four concrete costs:

1. **FOUC** (Flash Of Unstyled Content) on every page load.
2. **Runtime CDN dependency** — if `cdn.tailwindcss.com` is blocked or
   slow, the entire UI renders unstyled.
3. **No CSS in the build artifact** — `dist/assets/` contains only
   `index-*.js` (608 KB). There is no `index-*.css`. Vite ships zero
   stylesheet output.
4. **Dangling reference** — `<link rel="stylesheet" href="/index.css">`
   404s silently in production.

The official Tailwind Play CDN guide explicitly says it is **not for
production** (https://tailwindcss.com/docs/installation/play-cdn).

This change migrates Tailwind to a proper **build-time setup**: install
the package, generate a real `tailwind.config.js`, write
`postcss.config.js` and a real source CSS file, and import the
stylesheet from `index.tsx` so Vite injects it via its built-in
asset pipeline.

## What Changes

- **New dev dependencies** in `package.json`:
  `tailwindcss@^3`, `postcss`, `autoprefixer`.
- **New file** `tailwind.config.js` (ESM): `content: ['./index.html',
  './App.tsx', './components/**/*.{ts,tsx}']`, `darkMode: 'class'`.
- **New file** `postcss.config.js` (ESM): `plugins: { tailwindcss: {},
  autoprefixer: {} }`.
- **New file** `index.css` (project root): the three `@tailwind`
  directives (`base`, `components`, `utilities`).
- **Modify `index.tsx`** — add `import './index.css';` as the first
  import so Vite processes it through PostCSS during the build.
- **Modify `index.html`** — remove the Play CDN `<script>` tag, the
  inline `tailwind.config = …` block, and the dangling
  `<link rel="stylesheet" href="/index.css">` (Vite injects the
  production `<link>` automatically with the hashed filename).
  Keep the Google Fonts `<link>` (not Tailwind-related) and the inline
  `<style>` block with custom scrollbar rules.
- **No component changes**: every Tailwind utility class in
  `App.tsx` and `components/ArticleModal.tsx` continues to compile
  identically. The user-visible output is byte-identical for every
  class actually used.

## Capabilities

### New Capabilities

- `app-styling`: codifies the contract that the app must be styled
  via a build-time Tailwind toolchain, the dark-mode toggle is driven
  by a `.dark` class on the root, and the production CSS is bundled
  with the JS — no runtime CDN dependency.

### Modified Capabilities

- _(none — `app-styling` is the first capability in this domain; no
  prior spec to modify)_

## Impact

- **Code**: 1 source file deleted (`script src=cdn.tailwindcss.com`
  block + dangling `<link>`), 1 line added to `index.tsx`, 4 new
  config/source files (`tailwind.config.js`, `postcss.config.js`,
  `index.css`, lock-file entries from `npm install`).
- **APIs / contracts**: unchanged externally. Public HTML output
  gains `<link rel="stylesheet" href="/assets/index-HASH.css">`
  (Vite-injected), loses the two CDN `<script>` tags and the dangling
  `/index.css` request.
- **Dependencies**: three new dev-deps. The CDN URL
  `https://cdn.tailwindcss.com` is no longer reached at runtime.
- **Runtime**: no runtime JIT compilation; CSS is shipped as a single
  ~10-30 KB file (gzip 3-5 KB) hashed and cached like other Vite
  outputs. Removes the FOUC and removes the cross-origin dependency.
- **Build**: `npm run build` will output an additional
  `dist/assets/index-*.css` file. Build time increases by ~1-2 s for
  the postcss pipeline.
