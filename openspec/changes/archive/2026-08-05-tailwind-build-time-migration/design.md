## Context

See `proposal.md` for motivation. Restated here for the design:

- The runtime CDN script is a single point of failure that the user
  has already paid for once (`<script src="…"></script>` blocked or
  slow → unstyled UI in production).
- Vite already speaks PostCSS natively; no plugin glue needed beyond
  `postcss.config.js`. Adding `tailwindcss` to the PostCSS plugin list
  is the standard recipe.
- The package uses `"type": "module"` in `package.json`, so the two
  new config files must use ESM (`export default`).

## Goals / Non-Goals

**Goals**

- Move from runtime JIT to precompiled CSS that ships with the bundle.
- Preserve the exact visual output: every utility class in `App.tsx`
  and `components/ArticleModal.tsx` must produce the same styles.
- Preserve dark-mode behavior via `darkMode: 'class'` — the
  orchestrator in `App.tsx` toggles `dark` on `<html>` and components
  use `dark:` variants.

**Non-Goals**

- Migrating to Tailwind v4 — separate decision; v4 has a different
  setup (Vite plugin instead of PostCSS, CSS-based config).
- Switching the design system, adding a CSS layer system, introducing
  CSS modules, or refactoring utility classes into component classes.
- Changing the dark-mode toggle implementation or theme palette.

## Decisions

### D1. Tailwind v3 (not v4)

- **Why**: v3's PostCSS-based setup is the most widely-deployed
  configuration, well-documented, and integrates with zero changes
  beyond `tailwindcss/postcss/autoprefixer` + `tailwind.config.js` +
  `postcss.config.js`. v4 changes the contract significantly
  (CSS-first config, `@tailwindcss/vite` plugin instead of PostCSS,
  semantic class names) and was released after this project's
  Tailwind classes were written. v4 migration is a separate, larger
  change if the team wants it later.
- **Alternatives considered**: installing `tailwindcss@latest` (which
  resolves to v4.3.x as of today) and following v4 docs — rejected
  because it requires also replacing the entire PostCSS pipeline with
  `@tailwindcss/vite` and rewriting the configuration style.

### D2. Source CSS file at project root: `index.css`

- **Why**: the project's flat structure puts `App.tsx` at the repo
  root; keeping `index.css` at the same level mirrors that and makes
  the import `import './index.css'` resolve without a `src/` folder
  convention shift.
- **Alternatives considered**: putting the CSS in `src/index.css`
  (would create a new folder and break the flat-lay convention
  already used by `services/` and `components/`).

### D3. Content globs: explicit list, no autoexpand

- **Why**: Tailwind only generates CSS for classes used in the
  `content` globs. Explicit list of `{index.html, App.tsx,
  components/**/*.{ts,tsx}}` covers every file in the repo that
  contains Tailwind utilities (verified with
  `grep -rn 'className="' --include='*.tsx'`).
- **Trade-off**: future files added outside these globs would be
  un-styled silently. Acceptable for a small project; if the project
  grows, switch to `{'./*.{ts,tsx,html}', './{components,services}/**/*.{ts,tsx}'}`.

### D4. Drop the CDN `<script>` AND the dangling `<link>` in `index.html`

- **Why**: Vite will inject its own `<link rel="stylesheet">`
  referencing the hashed CSS file. Keeping the dangling
  `<link href="/index.css">` would still 404 (the file Vite generates
  is at `/assets/index-HASH.css`, not `/index.css`), which leaves the
  same broken-link behavior we are fixing.
- **Trade-off**: any developer who runs the app via
  `python -m http.server` on the root (not via Vite) will now
  genuinely miss a CSS file. Mitigation: dev workflow always uses
  `npm run dev` which goes through Vite.

## Risks / Trade-offs

- **R1** — Wrong config content globs silently produce no output. →
  Mitigation: `npm run build` is run as the verification step; if
  the produced CSS is empty (only `*{}` etc.), a developer will
  notice immediately.
- **R2** — `darkMode` strategy mismatch: the Play CDN used `class`
  mode; if the new config accidentally ships `media` mode, every
  dark-mode styling breaks visually. → Mitigation: the `darkMode:
  'class'` is configured in the same place as the rest of the
  content globs; a single grep verifies it post-write.
- **R3** — `tailwindcss` 7 vulnerabilities reported by `npm audit`;
  these are Tailwind-CSS-utility classnames advertised by v3 that
  match denial-of-service patterns when used as raw CSS selectors.
  None apply here because the project generates CSS via Tailwind
  itself. Acceptable.

## Migration Plan

Single deployment step; no rollback data-migration needed.

1. **In this commit**: add the three dev-deps, the two config files,
   the `index.css` source, the `import` line, and the HTML cleanup.
2. `npm run build` — must produce `dist/assets/index-*.css` (not just
   `.js`).
3. Deploy (`rsync dist/`, `docker build`, recreate `med-proxy`) and
   hard-refresh Chrome.
4. Visual sanity check: the page renders identically (same spacing,
   same dark-mode toggle).

**Rollback**: revert this commit. The previous state (CDN script,
   dangling `/index.css` link) is restored.

## Open Questions

None. All decisions are settled.
