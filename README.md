# Elk Flipbook

JavaScript widget to embed PDFs as an interactive flipbook with optional hard cover, realistic page-leaf animations, and searchable text (with OCR fallback when the PDF lacks a text layer).

## Status
- Planning and design. No runtime code committed yet.

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
    search: { highlightColor: '#ffe58f' },
  });

  // Navigate and search
  flipbook.goToPage(4);
  const results = await flipbook.search('warranty');
  flipbook.highlight(results[0]);
</script>
```

## Near-term tasks
- Lock in the flipbook animation library (start with StPageFlip, keep abstraction to swap if needed).
- Define the public API surface (creation options, events, methods, teardown).
- Sketch worker architecture for pdf.js and OCR, plus message contracts.
- Draft search index structure (per-page text + inverted index + highlights).
- Add a minimal example page for manual testing once the core loader lands.
