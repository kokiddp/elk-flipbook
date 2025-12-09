/**
 * Built-in Search UI Component
 * 
 * Provides an optional search panel with input, results list, and navigation.
 */

import type { SearchResult, SearchUIOptions, SearchUILabels, SearchUIPosition } from '../types/api';

/** Default labels for the search UI */
const DEFAULT_LABELS: Required<SearchUILabels> = {
  search: 'Search',
  placeholder: 'Search in document...',
  noResults: 'No results found',
  resultsCount: '{count} results',
  hitNumber: 'Result {current} of {total}',
  prevHit: '← Previous',
  nextHit: 'Next →',
  page: 'Page {page}',
  close: '×'
};

/** Options for SearchUI with callbacks */
export interface SearchUIInternalOptions extends SearchUIOptions {
  onSearch?: (query: string) => Promise<SearchResult[]>;
  onHighlight?: (result: SearchResult, index: number) => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
}

/**
 * Built-in search UI panel component.
 */
export class SearchUI {
  private container: HTMLElement;
  private root: HTMLElement;
  private input: HTMLInputElement;
  private resultsContainer: HTMLElement;
  private resultsList: HTMLElement;
  private countDisplay: HTMLElement;
  private prevButton: HTMLButtonElement;
  private nextButton: HTMLButtonElement;
  private options: SearchUIInternalOptions;
  private labels: Required<SearchUILabels>;
  private results: SearchResult[] = [];
  private currentIndex = -1;
  private isVisible = true;
  private searchTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(container: HTMLElement, options: SearchUIInternalOptions = {}) {
    this.container = container;
    this.options = options;
    this.labels = { ...DEFAULT_LABELS, ...options.labels };

    this.root = this.createRoot();
    this.input = this.root.querySelector('.elk-search__input') as HTMLInputElement;
    this.resultsContainer = this.root.querySelector('.elk-search__results') as HTMLElement;
    this.resultsList = this.root.querySelector('.elk-search__list') as HTMLElement;
    this.countDisplay = this.root.querySelector('.elk-search__count') as HTMLElement;
    this.prevButton = this.root.querySelector('.elk-search__prev') as HTMLButtonElement;
    this.nextButton = this.root.querySelector('.elk-search__next') as HTMLButtonElement;

    this.setupEventListeners();
    this.updateUI();

    // Insert into container
    this.container.style.position = 'relative';
    this.container.appendChild(this.root);
  }

  private createRoot(): HTMLElement {
    const position = this.options.position ?? 'top-left';
    const showResults = this.options.showResults !== false;
    const showNavigation = this.options.showNavigation !== false;
    const maxHeight = this.options.resultsMaxHeight ?? 300;

    const root = document.createElement('div');
    root.className = `elk-search elk-search--${position} ${this.options.className ?? ''}`.trim();

    root.innerHTML = `
      <div class="elk-search__panel">
        <div class="elk-search__header">
          <input 
            type="search" 
            class="elk-search__input" 
            placeholder="${this.labels.placeholder}"
            autocomplete="off"
          />
          <span class="elk-search__count"></span>
          ${showNavigation ? `
            <button type="button" class="elk-search__prev elk-search__nav" title="${this.labels.prevHit}">‹</button>
            <button type="button" class="elk-search__next elk-search__nav" title="${this.labels.nextHit}">›</button>
          ` : ''}
        </div>
        ${showResults ? `
          <div class="elk-search__results" style="max-height: ${maxHeight}px">
            <div class="elk-search__list"></div>
          </div>
        ` : ''}
      </div>
    `;

    return root;
  }

  private setupEventListeners(): void {
    // Search on input with debouncing
    this.input.addEventListener('input', () => {
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
      }
      this.searchTimeout = setTimeout(() => {
        this.performSearch();
      }, 200);
    });

    // Search on Enter
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (this.searchTimeout) {
          clearTimeout(this.searchTimeout);
        }
        this.performSearch();
      } else if (e.key === 'ArrowDown' && this.results.length > 0) {
        e.preventDefault();
        this.navigateNext();
      } else if (e.key === 'ArrowUp' && this.results.length > 0) {
        e.preventDefault();
        this.navigatePrev();
      } else if (e.key === 'Escape') {
        this.input.blur();
      }
    });

    // Navigation buttons
    this.prevButton?.addEventListener('click', () => this.navigatePrev());
    this.nextButton?.addEventListener('click', () => this.navigateNext());

    // Result item clicks (delegated)
    this.resultsList?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const item = target.closest('.elk-search__item') as HTMLElement;
      if (item && item.dataset['index']) {
        const index = parseInt(item.dataset['index'], 10);
        this.highlightResult(index);
      }
    });
  }

  private async performSearch(): Promise<void> {
    const query = this.input.value.trim();
    
    if (!query) {
      this.results = [];
      this.currentIndex = -1;
      this.updateUI();
      return;
    }

    if (this.options.onSearch) {
      this.results = await this.options.onSearch(query);
      this.currentIndex = -1;
      this.updateUI();

      // Auto-highlight first result
      if (this.results.length > 0 && this.options.autoExpandResults !== false) {
        this.highlightResult(0);
      }
    }
  }

  private highlightResult(index: number): void {
    if (index < 0 || index >= this.results.length) return;

    this.currentIndex = index;
    const result = this.results[index];

    if (result) {
      this.options.onHighlight?.(result, index);
    }
    this.updateUI();

    // Scroll result into view
    const item = this.resultsList?.querySelector(`[data-index="${index}"]`);
    item?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  private navigateNext(): void {
    if (this.results.length === 0) return;
    const nextIndex = this.currentIndex < this.results.length - 1 ? this.currentIndex + 1 : 0;
    this.highlightResult(nextIndex);
    this.options.onNavigate?.('next');
  }

  private navigatePrev(): void {
    if (this.results.length === 0) return;
    const prevIndex = this.currentIndex > 0 ? this.currentIndex - 1 : this.results.length - 1;
    this.highlightResult(prevIndex);
    this.options.onNavigate?.('prev');
  }

  private updateUI(): void {
    // Update count display
    if (this.results.length === 0) {
      this.countDisplay.textContent = this.input.value.trim() ? this.labels.noResults : '';
    } else if (this.currentIndex >= 0) {
      this.countDisplay.textContent = this.labels.hitNumber
        .replace('{current}', String(this.currentIndex + 1))
        .replace('{total}', String(this.results.length));
    } else {
      this.countDisplay.textContent = this.labels.resultsCount
        .replace('{count}', String(this.results.length));
    }

    // Update navigation buttons
    if (this.prevButton) {
      this.prevButton.disabled = this.results.length === 0;
    }
    if (this.nextButton) {
      this.nextButton.disabled = this.results.length === 0;
    }

    // Update results list
    this.renderResults();
  }

  private renderResults(): void {
    if (!this.resultsList) return;

    if (this.results.length === 0) {
      this.resultsList.innerHTML = '';
      this.resultsContainer?.classList.remove('elk-search__results--visible');
      return;
    }

    this.resultsContainer?.classList.add('elk-search__results--visible');

    this.resultsList.innerHTML = this.results.map((result, index) => `
      <button 
        type="button" 
        class="elk-search__item ${index === this.currentIndex ? 'elk-search__item--active' : ''}"
        data-index="${index}"
      >
        <span class="elk-search__item-page">${this.labels.page.replace('{page}', String(result.page))}</span>
        <span class="elk-search__item-snippet">${this.escapeHtml(result.snippet)}</span>
      </button>
    `).join('');
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Public API

  /** Set the search query programmatically */
  setQuery(query: string): void {
    this.input.value = query;
  }

  /** Set results programmatically (e.g., from initial search) */
  setResults(results: SearchResult[]): void {
    this.results = results;
    this.currentIndex = -1;
    this.updateUI();
  }

  /** Show the search panel */
  show(): void {
    this.isVisible = true;
    this.root.classList.remove('elk-search--hidden');
  }

  /** Hide the search panel */
  hide(): void {
    this.isVisible = false;
    this.root.classList.add('elk-search--hidden');
  }

  /** Toggle visibility */
  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /** Focus the search input */
  focus(): void {
    this.input.focus();
  }

  /** Destroy the search UI */
  destroy(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.root.remove();
  }
}
