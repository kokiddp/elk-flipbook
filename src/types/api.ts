/**
 * Elk Flipbook - Type Definitions
 * 
 * A browser-friendly widget for rendering PDFs as interactive flipbooks
 * with optional hard cover, page-turn animations, and full-text search.
 */

// ============================================================================
// PDF Source Types
// ============================================================================

/**
 * Supported PDF source types for loading documents.
 * - `string`: URL to a PDF file
 * - `URL`: URL object pointing to a PDF file
 * - `File`: File object from file input
 * - `Blob`: Blob containing PDF data
 * - `ArrayBuffer`: Raw PDF data
 * - `Uint8Array`: Raw PDF data as typed array
 */
export type PdfSource = string | URL | File | Blob | ArrayBuffer | Uint8Array;

// ============================================================================
// Search Configuration
// ============================================================================

/**
 * Configuration options for search functionality.
 */
export interface SearchOptions {
  /** 
   * Color for search result highlights.
   * Accepts any valid CSS color value.
   * @default '#f59e0b' (amber)
   */
  highlightColor?: string;

  /** 
   * Maximum number of search results to return.
   * Set to limit memory usage for large documents.
   * @default undefined (no limit)
   */
  maxResults?: number;

  /**
   * Minimum query length to trigger search.
   * Prevents searching on very short strings.
   * @default 2
   */
  minQueryLength?: number;
}

/**
 * Position of the built-in search UI panel.
 */
export type SearchUIPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'bottom';

/**
 * Configuration for the optional built-in search UI.
 */
export interface SearchUIOptions {
  /**
   * Enable the built-in search UI panel.
   * @default false
   */
  enabled?: boolean;

  /**
   * Position of the search panel relative to the flipbook.
   * @default 'top-left'
   */
  position?: SearchUIPosition;

  /**
   * Placeholder text for the search input.
   * @default 'Search in document...'
   */
  placeholder?: string;

  /**
   * Show the results list panel.
   * @default true
   */
  showResults?: boolean;

  /**
   * Maximum height of the results panel in pixels.
   * @default 300
   */
  resultsMaxHeight?: number;

  /**
   * Auto-expand results panel when results are found.
   * @default true
   */
  autoExpandResults?: boolean;

  /**
   * Show navigation buttons (prev/next hit).
   * @default true
   */
  showNavigation?: boolean;

  /**
   * Custom CSS class to add to the search UI container.
   */
  className?: string;

  /**
   * Labels for UI elements (for internationalization).
   */
  labels?: SearchUILabels;
}

/**
 * Customizable labels for the search UI (i18n support).
 */
export interface SearchUILabels {
  search?: string;
  placeholder?: string;
  noResults?: string;
  resultsCount?: string;  // Use {count} as placeholder
  hitNumber?: string;     // Use {current} and {total} as placeholders
  prevHit?: string;
  nextHit?: string;
  page?: string;          // Use {page} as placeholder
  close?: string;
}

// ============================================================================
// OCR Configuration
// ============================================================================

/**
 * Configuration options for OCR (Optical Character Recognition).
 * Used for pages with image-based text that can't be extracted directly.
 */
export interface OcrOptions {
  /**
   * Enable OCR for pages with low text density.
   * @default false
   */
  enabled?: boolean;

  /**
   * Language code for OCR recognition.
   * @default 'eng'
   */
  lang?: string;

  /**
   * Minimum text length threshold. Pages with less text
   * than this will be processed with OCR.
   * @default 50
   */
  minTextLength?: number;
}

// ============================================================================
// Main Configuration
// ============================================================================

/**
 * Main configuration options for creating a flipbook instance.
 */
export interface FlipbookOptions {
  /**
   * Container element or CSS selector where the flipbook will be mounted.
   * Required.
   */
  container: HTMLElement | string;

  /**
   * PDF document source.
   * Required.
   */
  source: PdfSource;

  /**
   * Enable hard cover effect (pads a blank page at the start/end to simulate covers).
   * When true, extra blank pages are added in front/back while StPageFlip still renders with showCover=false.
   * @default true
   */
  hardCover?: boolean;

  /**
   * Scale factor for rendering pages. Higher values = better quality but more memory.
   * @default 1.4
   */
  renderScale?: number;

  /**
   * Initial page to display (1-indexed).
   * @default 1
   */
  startPage?: number;

  /**
   * Search functionality configuration.
   */
  search?: SearchOptions;

  /**
   * Built-in search UI configuration.
   */
  searchUI?: SearchUIOptions;

  /**
   * OCR configuration for image-based PDFs.
   */
  ocr?: OcrOptions;

  /**
   * Initial search query to execute after loading.
   * Can also be set via URL parameter `?q=query` or `?search=query`.
   */
  initialSearch?: string;

  /**
   * Automatically highlight first search result.
   * @default true
   */
  autoHighlightFirst?: boolean;

  /**
   * Read initial search query from URL parameters.
   * Looks for `q`, `search`, or `query` parameters.
   * @default true
   */
  readSearchFromUrl?: boolean;

  /**
   * Progress callback for loading, rendering, and OCR phases.
   */
  onProgress?: (event: FlipbookProgressEvent) => void;

  /**
   * Called when the flipbook is fully loaded and ready.
   */
  onReady?: (instance: FlipbookInstance) => void;

  /**
   * Called when an error occurs during loading or operation.
   */
  onError?: (error: Error) => void;

  /**
   * Called when the current page changes.
   */
  onPageChange?: (page: number, totalPages: number) => void;

  /**
   * Called when a search is performed.
   */
  onSearch?: (query: string, results: SearchResult[]) => void;

  /**
   * Called when a search result is highlighted.
   */
  onHighlight?: (result: SearchResult, index: number) => void;
}

// ============================================================================
// Events
// ============================================================================

/**
 * Progress event phases during flipbook initialization.
 */
export type ProgressPhase = 'loading' | 'rendering' | 'ocr' | 'ready' | 'error';

/**
 * Progress event data emitted during flipbook initialization.
 */
export interface FlipbookProgressEvent {
  /** Current phase of initialization */
  phase: ProgressPhase;
  /** Current page being processed (if applicable) */
  page?: number;
  /** Total number of pages */
  pages?: number;
  /** Human-readable status message */
  message?: string;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Error object (if phase is 'error') */
  error?: Error;
}

/**
 * Event types that can be subscribed to.
 */
export type FlipbookEventType = 
  | 'ready'
  | 'error'
  | 'pagechange'
  | 'search'
  | 'highlight'
  | 'destroy';

/**
 * Event data for different event types.
 */
export interface FlipbookEventMap {
  ready: { pageCount: number };
  error: { error: Error };
  pagechange: { page: number; totalPages: number };
  search: { query: string; results: SearchResult[] };
  highlight: { result: SearchResult; index: number };
  destroy: Record<string, never>;
}

// ============================================================================
// Search Results
// ============================================================================

/**
 * A single search result with location and context information.
 */
export interface SearchResult {
  /** Page number where the match was found (1-indexed) */
  page: number;
  /** Character index within the page text where the match starts */
  index: number;
  /** Length of the matched text */
  length: number;
  /** Text snippet with context around the match */
  snippet: string;
  /** The matched text itself */
  match?: string;
}

// ============================================================================
// Instance API
// ============================================================================

/**
 * The flipbook instance API returned by createFlipbook().
 * Use this to control the flipbook programmatically.
 */
export interface FlipbookInstance {
  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------

  /**
   * Navigate to a specific page.
   * @param page - Page number (1-indexed)
   * @param animate - Whether to animate the page turn (default: true)
   */
  goToPage(page: number, animate?: boolean): void;

  /**
   * Go to the next page.
   */
  nextPage(): void;

  /**
   * Go to the previous page.
   */
  previousPage(): void;

  /**
   * Go to the first page.
   */
  firstPage(): void;

  /**
   * Go to the last page.
   */
  lastPage(): void;

  /**
   * Get the total number of pages.
   */
  getPageCount(): number;

  /**
   * Get the current page number (1-indexed).
   */
  getCurrentPage(): number;

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------

  /**
   * Search for text in the document.
   * @param query - Search query string
   * @returns Promise resolving to array of search results
   */
  search(query: string): Promise<SearchResult[]>;

  /**
   * Highlight a specific search result.
   * @param result - The search result to highlight
   */
  highlight(result: SearchResult): void;

  /**
   * Clear all highlights.
   */
  clearHighlights(): void;

  /**
   * Get the current search results (from last search).
   */
  getSearchResults(): SearchResult[];

  /**
   * Get the currently highlighted result index (-1 if none).
   */
  getCurrentHighlightIndex(): number;

  /**
   * Highlight the next search result.
   */
  nextHighlight(): void;

  /**
   * Highlight the previous search result.
   */
  previousHighlight(): void;

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  /**
   * Subscribe to an event.
   * @param event - Event type
   * @param handler - Event handler function
   * @returns Unsubscribe function
   */
  on<K extends FlipbookEventType>(
    event: K,
    handler: (data: FlipbookEventMap[K]) => void
  ): () => void;

  /**
   * Unsubscribe from an event.
   * @param event - Event type
   * @param handler - Handler to remove (if not provided, removes all handlers)
   */
  off<K extends FlipbookEventType>(
    event: K,
    handler?: (data: FlipbookEventMap[K]) => void
  ): void;

  // -------------------------------------------------------------------------
  // UI Control
  // -------------------------------------------------------------------------

  /**
   * Show the search UI panel (if enabled).
   */
  showSearchUI(): void;

  /**
   * Hide the search UI panel.
   */
  hideSearchUI(): void;

  /**
   * Toggle the search UI panel visibility.
   */
  toggleSearchUI(): void;

  /**
   * Focus the search input field.
   */
  focusSearch(): void;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  /**
   * Get the current flipbook state.
   */
  getState(): FlipbookState;

  /**
   * Check if the flipbook is ready.
   */
  isReady(): boolean;

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Update the flipbook layout (call after container resize).
   */
  update(): void;

  /**
   * Destroy the flipbook instance and clean up resources.
   */
  destroy(): void;
}

/**
 * Current state of the flipbook.
 */
export interface FlipbookState {
  /** Whether the flipbook is fully loaded and ready */
  ready: boolean;
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Total number of pages */
  pageCount: number;
  /** Current search query (if any) */
  searchQuery: string | null;
  /** Current search results */
  searchResults: SearchResult[];
  /** Index of currently highlighted result (-1 if none) */
  highlightIndex: number;
  /** Current orientation: 'portrait' or 'landscape' */
  orientation: 'portrait' | 'landscape';
}

// ============================================================================
// Global API
// ============================================================================

/**
 * Global Elk Flipbook API exposed on the window object.
 */
export interface ElkFlipbookGlobal {
  /**
   * Library version string.
   */
  version: string;

  /**
   * Create a new flipbook instance.
   */
  create: typeof createFlipbook;

  /**
   * Shorthand for create() - same functionality.
   */
  createFlipbook: typeof createFlipbook;

  /**
   * Get all active flipbook instances.
   */
  getInstances(): FlipbookInstance[];

  /**
   * Destroy all active flipbook instances.
   */
  destroyAll(): void;
}

// Forward declaration for the create function type
declare function createFlipbook(options: FlipbookOptions): Promise<FlipbookInstance>;
