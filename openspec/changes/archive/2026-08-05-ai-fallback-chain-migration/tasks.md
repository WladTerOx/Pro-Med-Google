## 1. Orchestrator (`services/ai.ts`)

- [x] 1.1 Define `PROVIDER_PRIORITY = ['ollama', 'gemini', 'mistral']`
- [x] 1.2 Implement `isProviderAvailable(provider)` with per-provider probes
  - [x] 1.2.1 Ollama: `checkOllamaConnection()`
  - [x] 1.2.2 Gemini: `generateContent('Hello')`; treat `RESOURCE_EXHAUSTED`
        as unavailable
  - [x] 1.2.3 Mistral: `GET /v1/models` with `Authorization: Bearer <key>`
- [x] 1.3 Implement `findAvailableProvider()` returning the first healthy
      provider or throwing `ALL_AI_PROVIDERS_UNAVAILABLE`
- [x] 1.4 Wrap every public AI function with `findAvailableProvider` →
      delegate to the chosen provider

## 2. Provider contract — throw on failure

- [x] 2.1 `services/gemini.ts`: change all four public functions to throw
      instead of returning the original input on error
- [x] 2.2 `services/gemini.ts`: throw `Error('Gemini API key is missing')`
      when `apiKey` is empty
- [x] 2.3 `services/mistral.ts`: same throw-on-error conversion for all
      four functions
- [x] 2.4 `services/mistral.ts`: bump default model to
      `mistral-small-latest` (replaces deprecated `mistral-tiny`)

## 3. Ollama diagnostics

- [x] 3.1 Re-enable `console.log('OLLAMA_BASE_URL', ...)` and
      `console.log('OLLAMA_MODEL', ...)` in `services/ollama.ts`

## 4. User-facing error state

- [x] 4.1 `App.tsx`: add `showAIErrorModal` state
- [x] 4.2 `App.tsx`: when catch sees `ALL_AI_PROVIDERS_UNAVAILABLE`, hide
      inline error and show the modal
- [x] 4.3 `App.tsx`: modal has "Настроить" (opens Settings) and "Закрыть"
      buttons
- [x] 4.4 `components/ArticleModal.tsx`: add `onAIError` prop
- [x] 4.5 `components/ArticleModal.tsx`: catch summarization error, call
      `onAIError()` and close the article modal

## 5. Vite config hardening

- [x] 5.1 `vite.config.ts`: replace `allowedHosts: true` with
      `allowedHosts: ['med.openaiua.cloud']`
- [x] 5.2 `vite.config.ts`: lift `proxy.on('proxyRes', ...)` registration
      out of the `proxyReq` callback to fix the listener-memory leak
- [x] 5.3 `vite.config.ts`: forward the incoming `origin` header to the
      Ollama CORS response instead of wildcard `'*'`

## 6. Build & deploy

- [x] 6.1 `npm run build` produces `dist/index*.js` with the new code
- [x] 6.2 Copy `dist/` to `/root/med-proxy/dist/`
- [x] 6.3 `docker build -t root-med-proxy .`
- [x] 6.4 Recreate `med-proxy` container so the new bundle is served
- [x] 6.5 (optional) `pm2 restart med-app --update-env`

## 7. Validation

- [x] 7.1 Mistral: direct `curl` to `https://api.mistral.ai/v1/chat/completions`
      returns 200 with Russian→English translation
- [x] 7.2 Verify AI-unavailable modal opens when Gemini/Mistral keys are
      blank (observed during dev: `ALL_AI_PROVIDERS_UNAVAILABLE` →
      modal renders, `Settings` opens)
- [ ] 7.3 Verify AI-unavailable modal opens when all three providers are
      down — pending Ollama host repair and Gemini credit top-up
