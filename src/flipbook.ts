/**
 * Elk Flipbook - Main Entry Point
 * 
 * Creates interactive PDF flipbooks with search, highlighting, and more.
 * Hard-cover mode pads a blank page at the start/end while StPageFlip runs with showCover=false.
 * 
 * @example
 * ```js
 * // Basic usage
 * const flipbook = await ElkFlipbook.create({
 *   container: '#viewer',
 *   source: '/path/to/document.pdf'
 * });
 * 
 * // With search UI
 * const flipbook = await ElkFlipbook.create({
 *   container: document.getElementById('viewer'),
 *   source: '/path/to/document.pdf',
 *   searchUI: { enabled: true, position: 'top-right' },
 *   initialSearch: 'keyword'
 * });
 * ```
 */

import './styles/base.css';

import { destroyPdfWorker, loadPdfDocument } from './core/pdfLoader';
import { renderPageToBlobUrl, type RenderedPage } from './core/pageRenderer';
import { extractPageText, type TextSpan } from './core/textExtraction';
import { SearchIndex } from './core/searchIndex';
import { OcrEngine } from './core/ocr';
import { FlipbookView, type PageAsset } from './core/flipbookView';
import { SearchUI } from './ui/SearchUI';
import type { 
  FlipbookInstance, 
  FlipbookOptions, 
  FlipbookProgressEvent,
  FlipbookEventType,
  FlipbookEventMap,
  FlipbookState,
  SearchResult 
} from './types/api';

/** Library version */
export const VERSION = '0.3.0';

/** Track all active instances for global management */
const activeInstances: Set<FlipbookInstance> = new Set();

/**
 * Parse URL parameters for initial search query.
 */
function getSearchQueryFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('q') ?? params.get('search') ?? params.get('query') ?? null;
}

/**
 * Resolve a container option to an HTMLElement.
 */
function resolveContainer(container: HTMLElement | string): HTMLElement {
  if (typeof container === 'string') {
    const el = document.querySelector<HTMLElement>(container);
    if (!el) {
      throw new Error(`Container element not found: ${container}`);
    }
    return el;
  }
  return container;
}

/**
 * Create a new flipbook instance.
 * 
 * @param options - Configuration options
 * @returns Promise that resolves to a FlipbookInstance
 * 
 * @example
 * ```js
 * const flipbook = await createFlipbook({
 *   container: '#viewer',
 *   source: 'document.pdf',
 *   searchUI: { enabled: true }
 * });
 * 
 * // Navigate
 * flipbook.goToPage(5);
 * 
 * // Search
 * const results = await flipbook.search('keyword');
 * flipbook.highlight(results[0]);
 * 
 * // Clean up
 * flipbook.destroy();
 * ```
 */
export async function createFlipbook(options: FlipbookOptions): Promise<FlipbookInstance> {
  // Resolve and validate container
  const container = resolveContainer(options.container);

  // Extract options with defaults
  const {
    source,
    hardCover = true,
    renderScale = 1.4,
    startPage = 1,
    search = {},
    searchUI: searchUIOptions,
    ocr,
    initialSearch,
    autoHighlightFirst = true,
    readSearchFromUrl = true,
    onProgress,
    onReady,
    onError,
    onPageChange,
    onSearch,
    onHighlight
  } = options;

  // Event handlers storage
  const eventHandlers = new Map<FlipbookEventType, Set<(data: unknown) => void>>();
  
  const emit = <K extends FlipbookEventType>(event: K, data: FlipbookEventMap[K]) => {
    const handlers = eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  };

  // Progress emitter
  const emitProgress = (event: FlipbookProgressEvent) => {
    onProgress?.(event);
  };

  // State
  let isReady = false;
  let searchResults: SearchResult[] = [];
  let currentHighlightIndex = -1;
  let searchQuery: string | null = null;
  let searchUIInstance: SearchUI | null = null;
  let view: FlipbookView | null = null;
  let searchIndex: SearchIndex | null = null;
  let renderedPages: RenderedPage[] = [];
  let ocrEngine: OcrEngine | null = null;
  let documentProxy: Awaited<ReturnType<typeof loadPdfDocument>> | null = null;
  let pageCount = 0;

  const createBlankPage = (width: number, height: number): RenderedPage => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    const dataUrl = canvas.toDataURL('image/png');
    const byteString = atob(dataUrl.split(',')[1] ?? '');
    const array = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i += 1) {
      array[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([array], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    return {
      url,
      blob,
      width,
      height,
      cleanup: () => URL.revokeObjectURL(url)
    };
  };

  try {
    emitProgress({ phase: 'loading', message: 'Loading PDF…', progress: 0 });
    documentProxy = await loadPdfDocument(source);

    pageCount = documentProxy.numPages;
    searchIndex = new SearchIndex();
    const assets: PageAsset[] = [];
    const textLayers = new Map<number, TextSpan[]>();
    ocrEngine = new OcrEngine(ocr);

    // Render all pages
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await documentProxy.getPage(pageNumber);
      const progress = Math.round((pageNumber / pageCount) * 80);
      
      emitProgress({
        phase: 'rendering',
        page: pageNumber,
        pages: pageCount,
        message: `Rendering page ${pageNumber}/${pageCount}`,
        progress
      });

      const [rendered, extracted] = await Promise.all([
        renderPageToBlobUrl(page, renderScale),
        extractPageText(page, renderScale)
      ]);

      let text = extracted.text;
      
      // OCR fallback for low-text pages
      if (ocrEngine.shouldRun(text)) {
        emitProgress({
          phase: 'ocr',
          page: pageNumber,
          pages: pageCount,
          message: `Running OCR for page ${pageNumber}`,
          progress
        });

        const ocrText = await ocrEngine.recognize(rendered.blob);
        if (ocrText.trim()) {
          text = ocrText;
        }
      }

      searchIndex.addPage(pageNumber, text);
      textLayers.set(pageNumber, extracted.spans);
      assets.push({ url: rendered.url, width: rendered.width, height: rendered.height });
      renderedPages.push(rendered);
    }

    // Create the view
    const baseWidth = assets[0]?.width ?? 600;
    const baseHeight = assets[0]?.height ?? 800;
    const pageOffset = hardCover ? 1 : 0;

    if (hardCover) {
      // Pad blank pages to mimic covers while keeping StPageFlip in showCover=false mode
      const blankFront = createBlankPage(baseWidth, baseHeight);
      const blankBack = createBlankPage(baseWidth, baseHeight);
      renderedPages.push(blankFront, blankBack);
      assets.unshift({ url: blankFront.url, width: blankFront.width, height: blankFront.height });
      assets.push({ url: blankBack.url, width: blankBack.width, height: blankBack.height });
    }

    view = new FlipbookView(container, {
      hardCover,
      basePageWidth: baseWidth,
      basePageHeight: baseHeight,
      textLayers,
      highlightColor: search.highlightColor,
      pageOffset,
      totalPages: pageCount,
      onFlip: (page) => {
        onPageChange?.(page, pageCount);
        emit('pagechange', { page, totalPages: pageCount });
      }
    });

    view.loadFromAssets(assets);

    // Navigate to start page (default 1) to skip padding blanks
    const initialPage = Math.max(1, Math.min(pageCount, startPage));
    view.goToPage(initialPage, false);

    // Create the instance
    const instance: FlipbookInstance = {
      // Navigation
      goToPage: (page: number, animate = true) => {
        view?.goToPage(page, animate);
      },
      nextPage: () => view?.nextPage(),
      previousPage: () => view?.previousPage(),
      firstPage: () => view?.goToPage(1),
      lastPage: () => view?.goToPage(pageCount),
      getPageCount: () => pageCount,
      getCurrentPage: () => view?.getCurrentPage() ?? 1,

      // Search
      search: async (query: string): Promise<SearchResult[]> => {
        const minLength = search.minQueryLength ?? 2;
        if (query.trim().length < minLength) {
          searchResults = [];
          searchQuery = null;
          currentHighlightIndex = -1;
          return [];
        }

        const index = searchIndex;
        if (!index) {
          return [];
        }

        searchQuery = query;
        searchResults = index.search(query, search.maxResults);
        currentHighlightIndex = -1;
        
        onSearch?.(query, searchResults);
        emit('search', { query, results: searchResults });
        
        return searchResults;
      },

      highlight: (result: SearchResult) => {
        const idx = searchResults.findIndex(
          r => r.page === result.page && r.index === result.index
        );
        currentHighlightIndex = idx >= 0 ? idx : -1;
        view?.highlightMatch(result.page, result.index, result.length);
        
        if (currentHighlightIndex >= 0) {
          onHighlight?.(result, currentHighlightIndex);
          emit('highlight', { result, index: currentHighlightIndex });
        }
      },

      clearHighlights: () => {
        view?.clearHighlights();
        currentHighlightIndex = -1;
      },

      getSearchResults: () => [...searchResults],

      getCurrentHighlightIndex: () => currentHighlightIndex,

      nextHighlight: () => {
        if (searchResults.length === 0) return;
        const nextIdx = currentHighlightIndex < searchResults.length - 1 
          ? currentHighlightIndex + 1 
          : 0;
        const result = searchResults[nextIdx];
        if (result) instance.highlight(result);
      },

      previousHighlight: () => {
        if (searchResults.length === 0) return;
        const prevIdx = currentHighlightIndex > 0 
          ? currentHighlightIndex - 1 
          : searchResults.length - 1;
        const result = searchResults[prevIdx];
        if (result) instance.highlight(result);
      },

      // Events
      on: <K extends FlipbookEventType>(
        event: K,
        handler: (data: FlipbookEventMap[K]) => void
      ): (() => void) => {
        if (!eventHandlers.has(event)) {
          eventHandlers.set(event, new Set());
        }
        eventHandlers.get(event)!.add(handler as (data: unknown) => void);
        return () => instance.off(event, handler);
      },

      off: <K extends FlipbookEventType>(
        event: K,
        handler?: (data: FlipbookEventMap[K]) => void
      ) => {
        if (!handler) {
          eventHandlers.delete(event);
        } else {
          eventHandlers.get(event)?.delete(handler as (data: unknown) => void);
        }
      },

      // UI Control
      showSearchUI: () => searchUIInstance?.show(),
      hideSearchUI: () => searchUIInstance?.hide(),
      toggleSearchUI: () => searchUIInstance?.toggle(),
      focusSearch: () => searchUIInstance?.focus(),

      // State
      getState: (): FlipbookState => ({
        ready: isReady,
        currentPage: view?.getCurrentPage() ?? 1,
        pageCount,
        searchQuery,
        searchResults: [...searchResults],
        highlightIndex: currentHighlightIndex,
        orientation: view?.getOrientation() ?? 'portrait'
      }),

      isReady: () => isReady,

      // Lifecycle
      update: () => view?.update(),

      destroy: () => {
        emit('destroy', {});
        searchUIInstance?.destroy();
        view?.destroy();
        renderedPages.forEach((page) => page.cleanup());
        void ocrEngine?.terminate();
        void documentProxy?.destroy();
        destroyPdfWorker();
        activeInstances.delete(instance);
        eventHandlers.clear();
      }
    };

    // Initialize search UI if enabled
    if (searchUIOptions?.enabled) {
      searchUIInstance = new SearchUI(container, {
        ...searchUIOptions,
        onSearch: async (query) => {
          const results = await instance.search(query);
          return results;
        },
        onHighlight: (result, index) => {
          instance.highlight(result);
        },
        onNavigate: (direction) => {
          if (direction === 'next') {
            instance.nextHighlight();
          } else {
            instance.previousHighlight();
          }
        }
      });
    }

    // Track instance
    activeInstances.add(instance);

    // Mark as ready
    isReady = true;
    emitProgress({ phase: 'ready', pages: pageCount, message: 'Flipbook ready', progress: 100 });
    emit('ready', { pageCount });
    onReady?.(instance);

    // Handle initial search
    const queryToSearch = initialSearch ?? (readSearchFromUrl ? getSearchQueryFromUrl() : null);
    if (queryToSearch) {
      const results = await instance.search(queryToSearch);
      const firstResult = results[0];
      if (firstResult && autoHighlightFirst) {
        instance.highlight(firstResult);
      }
      searchUIInstance?.setQuery(queryToSearch);
      searchUIInstance?.setResults(results);
    }

    return instance;

  } catch (error) {
    searchUIInstance?.destroy();
    view?.destroy();
    renderedPages.forEach((page) => page.cleanup());
    renderedPages = [];
    void ocrEngine?.terminate();
    void documentProxy?.destroy();

    const err = error instanceof Error ? error : new Error(String(error));
    emitProgress({
      phase: 'error',
      message: err.message,
      error: err
    });
    emit('error', { error: err });
    onError?.(err);
    throw err;
  }
}

/**
 * Get all active flipbook instances.
 */
export function getInstances(): FlipbookInstance[] {
  return Array.from(activeInstances);
}

/**
 * Destroy all active flipbook instances.
 */
export function destroyAll(): void {
  activeInstances.forEach(instance => instance.destroy());
}

// Export for UMD/global usage
export const ElkFlipbook = {
  version: VERSION,
  create: createFlipbook,
  createFlipbook,
  getInstances,
  destroyAll
};

// Attach to window for script tag usage
if (typeof window !== 'undefined') {
  (window as unknown as { ElkFlipbook: typeof ElkFlipbook }).ElkFlipbook = ElkFlipbook;
}
