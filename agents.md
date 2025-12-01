# Guidance for future contributors/agents

## Objective
- Build a browser-friendly JS/TS widget that renders PDFs as a flipbook with optional hard cover, page-turn animation, and searchable text (OCR fallback when needed).

## Stack choices
- Language: TypeScript preferred.
- Bundler/dev server: Vite.
- PDF parsing: pdf.js (use worker).
- Flipbook animation: StPageFlip (abstract behind our own view layer to allow swapping).
- OCR: Tesseract.js in a dedicated worker; only invoke for pages with empty/low text density.

## Architectural expectations
- Run pdf.js and OCR in workers; keep the main thread for UI/animation.
- Render pages to bitmaps for the flipbook; overlay an invisible text layer for selection/search.
- Maintain a per-page text cache and a lightweight inverted index for search; highlight hits in sync with page turns.
- Provide a small, documented public API (`createFlipbook`, navigation methods, search hooks, teardown).
- Make the hard-cover effect optional; expose animation timing as config.
- Current scaffold: `src/flipbook.ts` (main API), `src/core` utilities, `src/demo/main.ts` + `index.html` demo shell, `src/core/searchIndex.test.ts` (vitest).

## Repo layout (current)
- `src/flipbook.ts` orchestrates PDF loading, rendering to canvases, and PageFlip wiring.
- `src/core/` holds pdf.js loader, page renderer, search index, OCR wrapper, and view integration.
- `src/types/` includes API types and minimal module shims for dependencies.
- `index.html` + `src/demo/main.ts` serve the demo shell (uses a public sample PDF by default).
- `src/core/searchIndex.test.ts` shows the initial Vitest setup.

## Performance and UX
- Lazy-load pages near the viewport; cap concurrent OCR jobs; memoize rendered bitmaps.
- Keep bundle size lean; tree-shake dependencies; code-split workers.
- Ensure keyboard navigation, ARIA labels, and responsive layouts.
- Avoid regressions to search accuracy when animations are enabled.

## Testing and tooling
- Default to npm scripts (`npm install`, `npm run build`, `npm test`).
- Add unit tests for text extraction/indexing and search highlighting; add a simple e2e/manual playground.
- Use `rg` for repo search; prefer eslint/prettier defaults once added.

## Delivery notes
- Keep README updated with API and roadmap changes.
- Do not remove OCR fallback or search unless explicitly requested.
- When choosing alternative libraries, document the rationale and migration steps.
- Current environment does not have Node installed; use nvm or a local Node >=18 before running scripts.
