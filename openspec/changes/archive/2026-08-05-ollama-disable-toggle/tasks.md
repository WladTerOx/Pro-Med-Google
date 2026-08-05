## 1. Code change

- [x] 1.1 `services/ai.ts` `case 'ollama'`: short-circuit when
      `VITE_OLLAMA_DISABLED` is `'true'`.
- [x] 1.2 `services/ai.ts` log line "Ollama disabled via
      VITE_OLLAMA_DISABLED" so the toggle is observable from the
      browser console.

## 2. Environment

- [x] 2.1 `.env`: add `VITE_OLLAMA_DISABLED=true` with a comment
      explaining how to re-enable.
- [x] 2.2 `key/.env.local`: same line.

## 3. OpenSpec / Spec sync

- [x] 3.1 OpenSpec change `ollama-disable-toggle` — proposal,
      design, delta spec (MODIFIED scenario), tasks.
- [x] 3.2 Change archived to
      `openspec/changes/archive/2026-08-05-ollama-disable-toggle/`.
- [x] 3.3 Main spec `openspec/specs/ai-services/spec.md` synced
      with the new scenarios.

## 4. Build & deploy

- [x] 4.1 `npm run build` — produces `dist/assets/index-*.js` with
      the new short-circuit.
- [x] 4.2 `rsync -a --delete dist/ /root/med-proxy/dist/`.
- [x] 4.3 `docker build -t root-med-proxy` and recreate `med-proxy`
      container.
- [ ] 4.4 Live verification: console shows
      `"Ollama disabled via VITE_OLLAMA_DISABLED"` instead of the
      prior timeout.

## 5. Documentation

- [x] 5.1 `summary/audit/006-...-ollama-disable-toggle.md`.
- [x] 5.2 `summary/tasks/017-...-ollama-disable-toggle.md`.
- [x] 5.3 `CHANGELOG.md` — new entry.
- [x] 5.4 Git commit `chore(ai): stub ollama via VITE_OLLAMA_DISABLED toggle` → push.
