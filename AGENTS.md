# Guidance for future contributors/agents

## Objective
- Build a browser-friendly JS/TS widget that renders PDFs as a flipbook with optional hard cover, page-turn animation, and searchable text (OCR fallback when needed).

## Stack choices
- Language: TypeScript (strict mode).
- Bundler/dev server: Vite.
- PDF parsing: pdf.js (pdfjs-dist v4.10.38) with worker support.
- Flipbook animation: page-flip (StPageFlip v2.0.7), abstracted behind FlipbookView.
- OCR: Tesseract.js v5.x in a dedicated wrapper; only invoked for pages with empty/low text density.

## Architectural expectations
- Run pdf.js in a worker (configured in pdfLoader.ts); keep the main thread for UI/animation.
- Render pages to blob URLs for the flipbook canvas; use text span data for search highlighting.
- Maintain a per-page text cache and search index; highlight hits overlay on the canvas using screen coordinates.
- Provide a documented public API (`createFlipbook`, `ElkFlipbook.create`, navigation methods, search hooks, events, teardown).
- Make the hard-cover effect optional; expose animation timing and highlight colors as config. Hard-cover mode pads blank pages while StPageFlip still runs with showCover=false.
- Support optional built-in SearchUI component or allow custom implementations.

## Repo layout (current)
```
src/
├── flipbook.ts        # Main entry point, createFlipbook() and ElkFlipbook global
├── index.ts           # Public exports (API, types, components)
├── core/
│   ├── flipbookView.ts    # PageFlip wrapper, highlight rendering, coordinate transforms
│   ├── ocr.ts             # Tesseract.js OCR engine wrapper
│   ├── pageRenderer.ts    # PDF page to blob URL renderer
│   ├── pdfLoader.ts       # pdf.js document loader with worker setup
│   ├── searchIndex.ts     # Per-page text indexing and search
│   ├── searchIndex.test.ts # Vitest unit tests
│   └── textExtraction.ts  # PDF text content extraction with span positions
├── ui/
│   └── SearchUI.ts        # Optional built-in search panel component
├── styles/
│   └── base.css           # Core styles for flipbook and highlights
├── types/
│   ├── api.ts             # Comprehensive TypeScript type definitions
│   ├── page-flip.d.ts     # Module shim for page-flip
│   └── tesseract.d.ts     # Module shim for tesseract.js
├── demo/
│   └── main.ts            # Demo shell implementation
└── workers/               # (Reserved for future dedicated workers)

index.html                 # Demo HTML shell
package.json               # Dependencies and npm scripts
vite.config.ts             # Vite bundler configuration
tsconfig.json              # TypeScript configuration
```

## Key implementation details

### Highlighting system
- PageFlip uses canvas rendering; highlights are positioned using `getBoundsRect()` coordinates
- FlipbookView transforms PDF text spans to screen coordinates with proper scaling
- Portrait mode requires offset adjustment (single page rendered on right side of book bounds)
- `clearHighlightDom()` (internal) vs `clearHighlights()` (public API) separation is critical
- Highlights clear at the start of navigation (flip gestures or programmatic calls) and re-render after the new page settles.

### Event system
- Flipbook instances support `on(event, handler)` / `off(event, handler)` pattern
- Events: `ready`, `pagechange`, `search`, `highlight`, `error`, `destroy`
- Global instance tracking via `getInstances()` and `destroyAll()`

### Search features
- URL parameter support: `?q=`, `?search=`, `?query=`
- Optional `initialSearch` for pre-loaded queries
- Built-in SearchUI with customizable position, labels (i18n), and styling
- SearchIndex stores lowercased text per page to avoid repeated normalization and respects `maxResults` to short-circuit traversal.
- UMD globals: `page-flip` → `pageFlip`, `pdfjs-dist` → `pdfjsDist`, `tesseract.js` → `tesseract_js`.

## Performance and UX
- Pages rendered at configurable scale (default 1.4) for quality/performance balance.
- OCR runs only when text density is below threshold (minTextLength).
- Resize observer and debounced highlight re-renders prevent flicker.
- Keyboard navigation support; responsive layouts for mobile/desktop.
- In hard-cover mode, blank first/last pages are automatically skipped/clamped after load, resize, or orientation change (important for portrait/mobile).

## Testing and tooling
- npm scripts: `npm install`, `npm run dev`, `npm run build`, `npm test`
- Vitest for unit tests (see `src/core/searchIndex.test.ts`)
- TypeScript strict mode; `npm run typecheck` for type validation
- Dev server typically on port 5173 (auto-increments if busy)

## Delivery notes
- Keep README.md updated with API changes.
- Do not remove OCR fallback or search unless explicitly requested.
- When modifying highlight logic, test both portrait and landscape modes.
- The `clearHighlights()` public method clears state; internal renders use `clearHighlightDom()`.
- Version constant in flipbook.ts should match intended release version (current: 0.3.0).
- Publish metadata (package.json) points to https://github.com/kokiddp/elk-flipbook with MIT license (LICENSE.md) and author/email set to ELK-Lab.
