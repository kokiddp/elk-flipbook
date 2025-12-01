# Elk Flipbook

JavaScript widget to embed PDFs as an interactive flipbook with optional hard cover, realistic page-leaf animations, and searchable text (with OCR fallback when the PDF lacks a text layer).

## Status
- Initial scaffolding in place (Vite + TypeScript + library entry + demo shell).
- Core loader + flipbook wiring + OCR/search indexing implemented at a first-pass level; demo points to the public TraceMonkey PDF.

## Goals
- Drop-in browser component to display PDFs as a flipbook with a configurable hard-cover effect and smooth page-turn animation.
- Preserve searchable, selectable text; run OCR on pages where pdf.js yields no text.
- Responsive layout, keyboard-friendly navigation, and accessible controls.
- Minimal host setup (one script + styles) and a small, cacheable bundle.

## Proposed stack and dependencies
- TypeScript + Vite for bundling and dev ergonomics.
- pdf.js for PDF parsing, page rendering, and text extraction.
- StPageFlip (or similar) for the flipbook/page-turn animation and hard-cover option.
- Tesseract.js for OCR fallback when text extraction fails or yields empty content.
- Web workers for pdf.js and OCR to avoid blocking the main thread.

## Planned data flow
1. **Input**: accept a PDF URL, File/Blob, or ArrayBuffer.
2. **Preflight**: load with pdf.js; attempt text extraction per page. Flag pages with no/low text density for OCR.
3. **Rendering**: prerender each page to canvas or image bitmaps; feed them into the flipbook component; overlay a hidden text layer to keep selection/search aligned with visuals.
4. **OCR fallback**: for flagged pages, run Tesseract.js in a worker against the rendered bitmap; cache results; merge into the page text index.
5. **Search**: build a per-page index plus a lightweight inverted index. Support highlight + navigation to each hit, respecting current page-turn animations.
6. **Controls**: page nav, zoom, fullscreen toggle, hard-cover on/off, optional spread view, keyboard shortcuts, and ARIA labels for all interactive elements.
7. **Performance**: lazy-load and prerender pages near the viewport; throttle OCR; cache bitmaps and text; allow host-controlled memory caps.

## Getting started
> Node is not present on this machine yet; install a recent LTS (>=18) to run these commands.

```bash
npm install
npm run dev    # Vite dev server with demo shell
npm run build  # library build
npm run preview
npm test       # unit tests (vitest)
```

## Current implementation
- `src/flipbook.ts`: exports `createFlipbook(options)` that loads a PDF via pdf.js, renders pages to blob URLs, feeds them into PageFlip with optional hard cover, and builds a per-page search index.
- OCR fallback: when extracted text density is below a threshold, Tesseract.js runs against the rendered bitmap; recovered text feeds the search index.
- Search: per-page search with snippets and result limits; highlights trigger a visual overlay in the flipbook view (text-layer overlay still pending).
- Demo: `index.html` + `src/demo/main.ts` preload the public TraceMonkey PDF, wire search/navigation buttons, and surface progress updates.

## Public API (early)
```ts
import { createFlipbook } from '@elk/flipbook';

const flipbook = await createFlipbook({
  container: document.getElementById('viewer')!,
  source: '/docs/catalog.pdf', // URL, File, Blob, ArrayBuffer
  hardCover: true,
  renderScale: 1.4,
  search: { maxResults: 50, highlightColor: '#f59e0b' },
  ocr: { enabled: true, lang: 'eng', minTextLength: 16 },
  onProgress: (info) => console.log(info.phase, info.page, info.pages)
});

const results = await flipbook.search('warranty');
if (results[0]) {
  flipbook.highlight(results[0]);
}

flipbook.goToPage(3);
flipbook.getPageCount();
flipbook.destroy();
```

## Near-term tasks
- Add a proper text-layer overlay and highlight rendering tied to PageFlip page turns.
- Improve OCR pipeline (dedicated worker, rate limiting, language config, caching).
- Add accessibility and keyboard controls; expose events (page change, search hit).
- Guard bundle size (code-split workers, ensure external deps stay tree-shakeable).
- Add CI checks, linting, and tests for text extraction/search correctness.
- Polish demo with controls (search box, navigation, hard-cover toggle).

## Implementation roadmap
- **Phase 0**: Repo scaffolding, linting/formatting config, CI smoke checks.
- **Phase 1**: Core loader (pdf.js) with worker setup, public `createFlipbook` API, and loading states.
- **Phase 2**: Flipbook view integration (StPageFlip or alternative) with hard-cover toggle and responsive sizing.
- **Phase 3**: Text-layer overlay, search index, highlight rendering, and navigation controls.
- **Phase 4**: OCR fallback pipeline, caching strategy, and background priority controls.
- **Phase 5**: Theming hooks, accessibility passes, and example playground.

## Usage sketch (planned)
```html
<div id="viewer"></div>
<script type="module">
  import { createFlipbook } from '@elk/flipbook';

  const flipbook = await createFlipbook({
    container: document.getElementById('viewer'),
    source: '/docs/catalog.pdf',
    hardCover: true,
    renderScale: 1.3,
    search: { highlightColor: '#ffe58f', maxResults: 20 },
    ocr: { enabled: true, lang: 'eng', minTextLength: 16 }
  });

  // Navigate and search
  flipbook.goToPage(4);
  const results = await flipbook.search('warranty');
  flipbook.highlight(results[0]);
</script>
```

> Note: Example above reflects the intended API; highlight/navigation helpers will land in upcoming iterations.
