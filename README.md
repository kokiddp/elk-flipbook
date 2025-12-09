# Elk Flipbook

JavaScript widget to embed PDFs as an interactive flipbook with optional hard cover, realistic page-leaf animations, and full-text search (with OCR fallback for scanned documents).

## Features

- 📖 **Realistic page-turn animations** with hard cover option
- 🔍 **Full-text search** with highlighting across all pages
- 🔤 **OCR fallback** for scanned PDFs using Tesseract.js
- 📱 **Responsive design** - works on desktop and mobile
- ⌨️ **Keyboard navigation** support
- 🎨 **Customizable** highlight colors and UI
- 🔗 **URL parameter support** for deep linking to search terms
- 🧩 **Optional built-in search UI** or use your own

## Installation

```bash
npm install elk-flipbook
```

Or use via CDN:

```html
<script src="https://unpkg.com/elk-flipbook/dist/elk-flipbook.umd.js"></script>
```

## Quick Start

### Basic Usage

```javascript
import { createFlipbook } from 'elk-flipbook';

const flipbook = await createFlipbook({
  container: '#viewer',        // CSS selector or HTMLElement
  source: '/path/to/doc.pdf'   // URL, File, Blob, or ArrayBuffer
});

// Navigate
flipbook.goToPage(5);
flipbook.nextPage();
flipbook.previousPage();

// Search
const results = await flipbook.search('keyword');
if (results.length > 0) {
  flipbook.highlight(results[0]);
}

// Clean up
flipbook.destroy();
```

### With Built-in Search UI

```javascript
import { ElkFlipbook } from 'elk-flipbook';

const flipbook = await ElkFlipbook.create({
  container: '#viewer',
  source: '/path/to/doc.pdf',
  hardCover: true,
  searchUI: {
    enabled: true,
    position: 'top-right',     // 'top-left', 'top-right', 'bottom-left', 'bottom-right'
    showResults: true,
    showNavigation: true
  },
  initialSearch: 'warranty',   // Pre-search on load
  readSearchFromUrl: true      // Read ?q= or ?search= from URL
});
```

### Script Tag Usage

```html
<div id="viewer"></div>

<script src="https://unpkg.com/elk-flipbook/dist/elk-flipbook.umd.js"></script>
<script>
  ElkFlipbook.create({
    container: '#viewer',
    source: '/path/to/doc.pdf',
    hardCover: true,
    searchUI: { enabled: true }
  }).then(flipbook => {
    console.log('Flipbook ready!', flipbook.getPageCount(), 'pages');
  });
</script>
```

## API Reference

### `createFlipbook(options)` / `ElkFlipbook.create(options)`

Creates a new flipbook instance.

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `container` | `string \| HTMLElement` | required | CSS selector or DOM element |
| `source` | `PdfSource` | required | PDF URL, File, Blob, or ArrayBuffer |
| `hardCover` | `boolean` | `true` | Enable hard cover effect |
| `renderScale` | `number` | `1.4` | Page render quality (1-3) |
| `startPage` | `number` | `1` | Initial page to display |
| `search` | `SearchOptions` | `{}` | Search configuration |
| `searchUI` | `SearchUIOptions` | `undefined` | Built-in search UI config |
| `ocr` | `OcrOptions` | `{}` | OCR configuration |
| `initialSearch` | `string` | `undefined` | Search term to run on load |
| `readSearchFromUrl` | `boolean` | `true` | Read search from URL params |
| `autoHighlightFirst` | `boolean` | `true` | Auto-highlight first result |

#### Event Callbacks

| Callback | Parameters | Description |
|----------|------------|-------------|
| `onProgress` | `(event: ProgressEvent)` | Loading/rendering progress |
| `onReady` | `(instance: FlipbookInstance)` | Flipbook is ready |
| `onError` | `(error: Error)` | Error occurred |
| `onPageChange` | `(page: number, total: number)` | Page was turned |
| `onSearch` | `(query: string, results: SearchResult[])` | Search completed |
| `onHighlight` | `(result: SearchResult, index: number)` | Result highlighted |

### FlipbookInstance

#### Navigation

```typescript
flipbook.goToPage(page: number, animate?: boolean): void
flipbook.nextPage(): void
flipbook.previousPage(): void
flipbook.firstPage(): void
flipbook.lastPage(): void
flipbook.getCurrentPage(): number
flipbook.getPageCount(): number
```

#### Search

```typescript
flipbook.search(query: string): Promise<SearchResult[]>
flipbook.highlight(result: SearchResult): void
flipbook.clearHighlights(): void
flipbook.getSearchResults(): SearchResult[]
flipbook.nextHighlight(): void
flipbook.previousHighlight(): void
flipbook.getCurrentHighlightIndex(): number
```

#### Events

```typescript
// Subscribe to events
const unsubscribe = flipbook.on('pagechange', ({ page, totalPages }) => {
  console.log(`Page ${page} of ${totalPages}`);
});

// Available events: 'ready', 'pagechange', 'search', 'highlight', 'error', 'destroy'
flipbook.on('search', ({ query, results }) => { });
flipbook.on('highlight', ({ result, index }) => { });

// Unsubscribe
unsubscribe();
// or
flipbook.off('pagechange', handler);
```

#### UI Control

```typescript
flipbook.showSearchUI(): void
flipbook.hideSearchUI(): void
flipbook.toggleSearchUI(): void
flipbook.focusSearch(): void
```

#### State & Lifecycle

```typescript
flipbook.getState(): FlipbookState
flipbook.isReady(): boolean
flipbook.update(): void
flipbook.destroy(): void
```

### SearchResult

```typescript
interface SearchResult {
  page: number;      // 1-indexed page number
  index: number;     // Character index in page text
  length: number;    // Length of match
  snippet?: string;  // Context around the match
}
```

## URL Parameters

The flipbook can read initial search from URL parameters:

- `?q=keyword`
- `?search=keyword`
- `?query=keyword`

## Global Instance Management

```javascript
import { getInstances, destroyAll } from 'elk-flipbook';

// Get all active flipbook instances
const instances = getInstances();

// Destroy all instances (useful for SPA cleanup)
destroyAll();
```

## Customization

### Search Options

```javascript
{
  search: {
    highlightColor: '#f59e0b',  // Highlight color (CSS color)
    maxResults: 100,            // Max results to return
    minQueryLength: 2           // Min characters to trigger search
  }
}
```

### OCR Options

```javascript
{
  ocr: {
    enabled: true,      // Enable OCR for scanned pages
    lang: 'eng',        // Tesseract language code
    minTextLength: 50   // Min text chars before triggering OCR
  }
}
```

### Search UI Options

```javascript
{
  searchUI: {
    enabled: true,
    position: 'top-right',
    placeholder: 'Search document...',
    showResults: true,
    resultsMaxHeight: 300,
    autoExpandResults: true,
    showNavigation: true,
    className: 'my-custom-class',
    labels: {
      search: 'Search',
      placeholder: 'Search...',
      noResults: 'No results found',
      resultsCount: '{count} results',
      prevHit: '← Previous',
      nextHit: 'Next →'
    }
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build library
npm run build

# Run tests
npm test

# Type check
npm run typecheck
```

### Demo

The demo uses a custom search UI implementation and loads a public sample PDF:

- Default: `http://localhost:5173/`
- With search: `http://localhost:5173/?q=function`

To test the built-in SearchUI component, modify the demo or create a separate test page using the `searchUI: { enabled: true }` option.

## Browser Support

- Chrome/Edge 80+
- Firefox 75+
- Safari 14+
- iOS Safari 14+
- Android Chrome 80+

## Dependencies

- [pdf.js](https://mozilla.github.io/pdf.js/) - PDF parsing and rendering
- [StPageFlip](https://nodlik.github.io/StPageFlip/) - Page flip animations
- [Tesseract.js](https://tesseract.projectnaptha.com/) - OCR engine (optional)

## License

MIT
