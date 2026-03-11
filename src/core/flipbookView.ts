import { PageFlip } from 'page-flip';
import type { TextSpan } from './textExtraction';

export interface PageAsset {
  url: string;
  width: number;
  height: number;
}

export interface FlipbookViewOptions {
  hardCover?: boolean;
  basePageWidth: number;
  basePageHeight: number;
  onFlip?: (page: number) => void;
  highlightColor?: string;
  textLayers?: Map<number, TextSpan[]>;
  pageOffset?: number;
  totalPages?: number;
}

export class FlipbookView {
  private readonly root: HTMLElement;
  private readonly stage: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly pageFlip: PageFlip;
  private highlights: HTMLElement[] = [];
  private readonly basePageWidth: number;
  private readonly basePageHeight: number;
  private readonly pageOffset: number;
  private readonly totalPages: number;
  private isAdjustingPage = false;
  private pointerGuard: (event: PointerEvent) => void;
  private activeHighlight: { page: number; start: number; length: number } | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeHandler: () => void;
  private pendingHighlightRender: number | null = null;
  private pendingHighlightTimeout: number | null = null;

  /**
   * Convert a CSS color to rgba string with the given multiplier for alpha.
   * Supports hex and rgb/rgba formats; falls back to the original string otherwise.
   */
  private toRgba(color: string, alpha: number): string {
    const trimmed = color.trim();
    if (!trimmed) return color;

    const hexMatch = /^#(?<value>[0-9a-fA-F]{3,8})$/.exec(trimmed);
    if (hexMatch?.groups?.['value']) {
      let value = hexMatch.groups['value'];
      if (value.length === 3 || value.length === 4) {
        value = value.split('').map((c) => c + c).join('');
      }

      let baseAlpha = 1;
      if (value.length === 8) {
        baseAlpha = parseInt(value.slice(6, 8), 16) / 255;
        value = value.slice(0, 6);
      }

      const r = parseInt(value.slice(0, 2), 16);
      const g = parseInt(value.slice(2, 4), 16);
      const b = parseInt(value.slice(4, 6), 16);
      const finalAlpha = Math.max(0, Math.min(1, baseAlpha * alpha));
      return `rgba(${r}, ${g}, ${b}, ${finalAlpha})`;
    }

    const rgbMatch = /^rgba?\((\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([0-9.]+))?\)$/.exec(trimmed);
    if (rgbMatch) {
      const [, rStr, gStr, bStr, aStr] = rgbMatch;
      if (rStr && gStr && bStr) {
        const r = parseInt(rStr, 10);
        const g = parseInt(gStr, 10);
        const b = parseInt(bStr, 10);
        const baseAlpha = aStr ? parseFloat(aStr) : 1;
        const finalAlpha = Math.max(0, Math.min(1, baseAlpha * alpha));
        return `rgba(${r}, ${g}, ${b}, ${finalAlpha})`;
      }
    }

    return color;
  }

  constructor(private container: HTMLElement, private options: FlipbookViewOptions = {} as FlipbookViewOptions) {
    this.root = document.createElement('div');
    this.root.className = 'elk-flipbook';

    this.basePageWidth = this.options.basePageWidth;
    this.basePageHeight = this.options.basePageHeight;
    this.pageOffset = Math.max(0, this.options.pageOffset ?? 0);
    this.totalPages = this.options.totalPages ?? 0;

    if (this.options.highlightColor) {
      this.root.style.setProperty('--elk-highlight-color', this.toRgba(this.options.highlightColor, 0.8));
      this.root.style.setProperty('--elk-highlight-bg', this.toRgba(this.options.highlightColor, 0.35));
    }

    this.stage = document.createElement('div');
    this.stage.className = 'elk-flipbook__stage';
    this.root.appendChild(this.stage);

    this.overlay = document.createElement('div');
    this.overlay.className = 'elk-flipbook__overlay';
    this.root.appendChild(this.overlay);

    this.container.replaceChildren(this.root);

    const baseWidth = this.basePageWidth || 800;
    const baseHeight = this.basePageHeight || 1000;

    this.pageFlip = new PageFlip(this.stage, {
      width: baseWidth,
      height: baseHeight,
      size: 'stretch',
      minWidth: 320,
      minHeight: 320,
      maxShadowOpacity: 0.5,
      showCover: false,
      usePortrait: true,
      autoSize: true
    });

    this.pageFlip.on('flip', (event) => {
      const physicalIndex = typeof event.data === 'number' ? event.data : Number(event.data);

      // Prevent landing on padded blank pages (hard cover) regardless of input method
      if (!this.isAdjustingPage) {
        const logicalIndex = physicalIndex - this.pageOffset;
        const maxLogicalIndex = this.getPageCount() - 1;

        if (logicalIndex < 0) {
          this.isAdjustingPage = true;
          this.pageFlip.turnToPage(this.pageOffset);
          this.isAdjustingPage = false;
          return;
        }

        if (logicalIndex > maxLogicalIndex) {
          this.isAdjustingPage = true;
          this.pageFlip.turnToPage(this.pageOffset + maxLogicalIndex);
          this.isAdjustingPage = false;
          return;
        }
      }

      const pageNumber = physicalIndex + 1;
      const logicalPage = Math.max(1, Math.min(this.getPageCount(), pageNumber - this.pageOffset));
      // Delay highlight rendering to ensure page flip animation has settled
      this.scheduleHighlightRender();
      this.options.onFlip?.(logicalPage);
    });

    // Hide highlight overlay as soon as a flip begins (desktop or mobile)
    this.pageFlip.on('changeState', (payload: { data: unknown }) => {
      const state = typeof payload?.data === 'string' ? payload.data : '';
      if (state === 'flipping' || state === 'user_fold') {
        this.clearHighlightDom();
      }
    });

    // Re-render highlights when orientation changes (portrait <-> landscape)
    this.pageFlip.on('changeOrientation', () => {
      this.clampToLogicalRange();
      this.scheduleHighlightRender();
    });

    // Block clicks that would navigate into padded blank pages
    this.pointerGuard = (event: PointerEvent) => {
      const rect = this.stage.getBoundingClientRect();
      const isForward = event.clientX - rect.left > rect.width / 2;
      const logicalPage = this.getCurrentPage();
      const lastLogical = this.getPageCount();
      if ((isForward && logicalPage >= lastLogical) || (!isForward && logicalPage <= 1)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    this.stage.addEventListener('pointerdown', this.pointerGuard, { capture: true });

    this.resizeHandler = () => {
      this.pageFlip.update();
      this.clampToLogicalRange();
      this.scheduleHighlightRender();
    };

    window.addEventListener('resize', this.resizeHandler);
    this.resizeObserver = new ResizeObserver(this.resizeHandler);
    this.resizeObserver.observe(this.stage);
  }

  /**
   * Schedule a highlight render with debouncing to avoid flicker during animations
   */
  private scheduleHighlightRender(): void {
    if (this.pendingHighlightRender !== null) {
      window.cancelAnimationFrame(this.pendingHighlightRender);
    }
    this.pendingHighlightRender = window.requestAnimationFrame(() => {
      this.pendingHighlightRender = null;
      this.renderActiveHighlight();
    });
  }

  loadFromAssets(assets: PageAsset[]): void {
    if (!assets.length) {
      throw new Error('No page assets provided to FlipbookView.');
    }
    this.pageFlip.loadFromImages(assets.map((asset) => asset.url));
    this.clampToLogicalRange();
  }

  goToPage(page: number, animate = true): void {
    const total = this.getPageCount();
    if (total === 0) {
      return;
    }
    this.clearHighlightDom();
    const clampedPage = Math.max(1, Math.min(total, page));
    const target = clampedPage - 1 + this.pageOffset;
    if (animate) {
      this.pageFlip.flip(target);
    } else {
      this.pageFlip.turnToPage(target);
    }
  }

  nextPage(): void {
    const total = this.getPageCount();
    if (total === 0) {
      return;
    }
    this.clearHighlightDom();
    const currentIndex = this.pageFlip.getCurrentPageIndex();
    if (currentIndex < total - 1 + this.pageOffset) {
      this.pageFlip.flipNext();
    }
  }

  previousPage(): void {
    const total = this.getPageCount();
    if (total === 0) {
      return;
    }
    this.clearHighlightDom();
    const currentIndex = this.pageFlip.getCurrentPageIndex();
    if (currentIndex > this.pageOffset) {
      this.pageFlip.flipPrev();
    }
  }

  getPageCount(): number {
    return this.totalPages || Math.max(0, this.pageFlip.getPageCount() - this.pageOffset * 2);
  }

  getCurrentPage(): number {
    const logicalIndex = this.pageFlip.getCurrentPageIndex() - this.pageOffset;
    return Math.max(1, Math.min(this.getPageCount(), logicalIndex + 1));
  }

  private clampToLogicalRange(): void {
    const physicalCount = this.pageFlip.getPageCount();
    if (physicalCount === 0) {
      return;
    }

    const firstIndex = this.pageOffset;
    const lastIndex = this.pageOffset + Math.max(0, this.getPageCount() - 1);
    const currentIndex = this.pageFlip.getCurrentPageIndex();

    if (currentIndex < firstIndex) {
      this.pageFlip.turnToPage(firstIndex);
      return;
    }

    if (currentIndex > lastIndex) {
      this.pageFlip.turnToPage(lastIndex);
    }
  }

  /**
   * Get the current orientation ('portrait' or 'landscape')
   */
  getOrientation(): 'portrait' | 'landscape' {
    return this.pageFlip.getOrientation() as 'portrait' | 'landscape';
  }

  /**
   * Force an update/re-render of the flipbook
   */
  update(): void {
    this.pageFlip.update();
    this.scheduleHighlightRender();
  }

  /**
   * Clear all active highlights (public API)
   */
  clearHighlights(): void {
    this.clearHighlightDom();
    this.activeHighlight = null;
  }

  /**
   * Clear highlight DOM elements only (internal use)
   */
  private clearHighlightDom(): void {
    this.highlights.forEach((node) => node.remove());
    this.highlights = [];
  }

  /**
   * Determine if a page is currently visible given the current page index and orientation.
   * In landscape mode, we show 2 pages at once (except cover pages).
   * In portrait mode, we show 1 page at a time.
   */
  private isPageVisible(pageNumber: number): boolean {
    const currentIndex = this.pageFlip.getCurrentPageIndex();
    const orientation = this.pageFlip.getOrientation();
    const targetIndex = pageNumber - 1 + this.pageOffset;

    if (orientation === 'portrait') {
      return targetIndex === currentIndex;
    }

    const leftPageIndex = currentIndex % 2 === 0 ? currentIndex : currentIndex - 1;
    const rightPageIndex = leftPageIndex + 1;

    return targetIndex === leftPageIndex || targetIndex === rightPageIndex;
  }

  /**
   * Get the position of a page within the stage.
   * Returns null if the page is not currently visible.
   * 
   * PageFlip uses a canvas renderer - pages are drawn at positions determined by getBoundsRect().
   * The rect.left/top values are the position within the canvas, and pageWidth/height are the page dimensions.
   */
  private getPagePosition(pageNumber: number): { x: number; y: number; width: number; height: number } | null {
    const pageIndex = pageNumber - 1 + this.pageOffset;
    const orientation = this.pageFlip.getOrientation();
    const bookRect = this.pageFlip.getBoundsRect();
    
    // Get the canvas element that PageFlip renders to
    const canvas = this.stage.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) {
      return null;
    }
    
    // Get the overlay and canvas positions to calculate the offset
    const overlayRect = this.overlay.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    
    // Calculate scale between canvas logical size and display size
    // Canvas might be scaled via CSS
    const canvasScaleX = canvasRect.width / canvas.width;
    const canvasScaleY = canvasRect.height / canvas.height;
    
    // PageFlip's bookRect values are in canvas logical coordinates
    // We need to convert to screen coordinates
    const displayPageWidth = bookRect.pageWidth * canvasScaleX;
    const displayPageHeight = bookRect.height * canvasScaleY;
    const bookLeftInCanvas = bookRect.left * canvasScaleX;
    const bookTopInCanvas = bookRect.top * canvasScaleY;
    
    // Calculate the book's position relative to the overlay
    const bookOriginX = canvasRect.left + bookLeftInCanvas - overlayRect.left;
    const bookOriginY = canvasRect.top + bookTopInCanvas - overlayRect.top;

    if (orientation === 'portrait') {
      // In portrait mode PageFlip renders a single page on the right half of the spread
      return {
        x: bookOriginX + displayPageWidth,
        y: bookOriginY,
        width: displayPageWidth,
        height: displayPageHeight
      };
    }

    // Landscape mode: 2-page spread (no cover; blank padding handled by offset)
    const currentIndex = this.pageFlip.getCurrentPageIndex();
    const leftPageIndex = currentIndex % 2 === 0 ? currentIndex : currentIndex - 1;
    const rightPageIndex = leftPageIndex + 1;

    if (pageIndex === leftPageIndex) {
      return {
        x: bookOriginX,
        y: bookOriginY,
        width: displayPageWidth,
        height: displayPageHeight
      };
    }
    
    if (pageIndex === rightPageIndex) {
      return {
        x: bookOriginX + displayPageWidth,
        y: bookOriginY,
        width: displayPageWidth,
        height: displayPageHeight
      };
    }

    return null; // Page not visible
  }

  private renderActiveHighlight(): void {
    this.clearHighlightDom();

    const active = this.activeHighlight;
    if (!active) {
      return;
    }

    // Check if the target page is visible
    if (!this.isPageVisible(active.page)) {
      return;
    }

    const spans = this.options.textLayers?.get(active.page);
    if (!spans || !spans.length) {
      return;
    }

    const pagePos = this.getPagePosition(active.page);
    if (!pagePos) {
      return;
    }

    const scaleX = pagePos.width / this.basePageWidth;
    const scaleY = pagePos.height / this.basePageHeight;

    this.paintMatches(spans, active, pagePos.x, pagePos.y, scaleX, scaleY);
  }

  private paintMatches(
    spans: TextSpan[],
    active: { start: number; length: number },
    pageOriginX: number,
    pageOriginY: number,
    scaleX: number,
    scaleY: number
  ): void {
    const end = active.start + active.length;
    const matches = spans.filter((span) => span.end > active.start && span.start < end);
    const fragment = document.createDocumentFragment();

    matches.forEach((span) => {
      const overlapStart = Math.max(span.start, active.start);
      const overlapEnd = Math.min(span.end, end);
      const ratio = (overlapEnd - overlapStart) / (span.end - span.start || 1);

      const highlight = document.createElement('div');
      highlight.className = 'elk-flipbook__highlight';
      highlight.style.left = `${pageOriginX + span.left * scaleX}px`;
      highlight.style.top = `${pageOriginY + span.top * scaleY}px`;
      highlight.style.width = `${span.width * scaleX}px`;
      highlight.style.height = `${span.height * scaleY}px`;
      highlight.style.opacity = `${Math.min(1, 0.4 + ratio * 0.6)}`;
      fragment.appendChild(highlight);
      this.highlights.push(highlight);
    });

    this.overlay.appendChild(fragment);
  }

  highlightMatch(page: number, start: number, length: number): void {
    this.activeHighlight = { page, start, length };

    const targetIndex = page - 1 + this.pageOffset;
    
    // Check if we're already on the target page
    if (this.isPageVisible(page)) {
      // Already visible, just render the highlight
      this.scheduleHighlightRender();
    } else {
      // Navigate to the page
      // Use turnToPage for immediate jump, or flip for animation
      this.clearHighlightDom();
      this.pageFlip.turnToPage(targetIndex);
      // Give PageFlip time to update DOM, then render highlight
      if (this.pendingHighlightTimeout !== null) {
        window.clearTimeout(this.pendingHighlightTimeout);
      }
      this.pendingHighlightTimeout = window.setTimeout(() => {
        this.pendingHighlightTimeout = null;
        this.scheduleHighlightRender();
      }, 100);
    }
  }

  destroy(): void {
    if (this.pendingHighlightRender !== null) {
      window.cancelAnimationFrame(this.pendingHighlightRender);
    }
    if (this.pendingHighlightTimeout !== null) {
      window.clearTimeout(this.pendingHighlightTimeout);
    }
    this.pageFlip.destroy();
    this.root.remove();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    if (this.pointerGuard) {
      this.stage.removeEventListener('pointerdown', this.pointerGuard, { capture: true } as EventListenerOptions);
    }
  }
}
