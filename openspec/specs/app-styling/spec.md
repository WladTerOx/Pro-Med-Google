# app-styling Specification

## Purpose

Codifies how the application is styled. The app uses Tailwind CSS
utility classes embedded in TSX files. The contract guarantees that
those classes are resolved at build time into a single CSS file that
ships with the production bundle, and that the user never has to
reach `cdn.tailwindcss.com` at runtime.

## Requirements

### Requirement: Build-time Tailwind toolchain

The build pipeline SHALL process the project's CSS through Tailwind CSS
at build time. The output of the build MUST include a hashed CSS file
under `dist/assets/index-*.css` containing every utility class
referenced in the project sources.

#### Scenario: Production build produces CSS
- **WHEN** `npm run build` is run from the project root
- **THEN** the build emits a single `.css` file under `dist/assets/`
  containing Tailwind's preflight reset, component layer, and utility
  classes used by the application

#### Scenario: Source CSS contains Tailwind directives
- **WHEN** a developer inspects `index.css` at the project root
- **THEN** it contains the three `@tailwind base;`,
  `@tailwind components;`, `@tailwind utilities;` directives

### Requirement: No runtime CDN dependency

The production HTML output MUST NOT reference
`https://cdn.tailwindcss.com` or any equivalent runtime-Tailwind CDN.
The application MUST render correctly in offline / no-CDN scenarios
as long as the static assets under `/assets/` are reachable.

#### Scenario: HTML output after build
- **WHEN** the file `dist/index.html` is inspected
- **THEN** it contains no `<script src="…cdn.tailwindcss.com…">` and
  no inline `tailwind.config = …` block

#### Scenario: App renders with CDN blocked
- **WHEN** the browser has network access to `med.openaiua.cloud` but
  `cdn.tailwindcss.com` is blocked or unreachable
- **THEN** the application still renders with all UI styles

### Requirement: Dark-mode toggle via class

The application SHALL support dark-mode styling by toggling a `dark`
class on the document root. Components SHALL opt into dark styles by
using Tailwind's `dark:` variant prefix. There MUST be no `@media
(prefers-color-scheme)` reliance.

#### Scenario: Light-mode default
- **WHEN** the app loads and the user has not toggled dark mode
- **THEN** the document root does not have the `dark` class and the
  light-mode utility classes apply

#### Scenario: Dark-mode toggle
- **WHEN** the user opens the Settings panel and activates dark mode
- **THEN** the orchestrator adds the `dark` class to `<html>` and the
  `dark:bg-…` / `dark:text-…` variants override the corresponding
  light classes

#### Scenario: Dark-mode persistence
- **WHEN** the page reloads after dark mode was activated
- **THEN** the dark-mode preference is restored from `localStorage`
  and the `dark` class is applied on first paint
