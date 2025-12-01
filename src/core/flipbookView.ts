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
  renderScale?: number;
}

export class FlipbookView {
  private readonly root: HTMLElement;
  private readonly stage: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly pageFlip: PageFlip;
  private highlightTimer: number | null = null;
  private highlights: HTMLElement[] = [];
  private readonly basePageWidth: number;
  private readonly basePageHeight: number;
  private activeHighlight: { page: number; start: number; length: number } | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeHandler: () => void;
  private pendingHighlightRender: number | null = null;

  constructor(private container: HTMLElement, private options: FlipbookViewOptions = {} as FlipbookViewOptions) {
    this.root = document.createElement('div');
    this.root.className = 'elk-flipbook';

    if (this.options.highlightColor) {
      this.root.style.setProperty('--elk-highlight-color', this.options.highlightColor);
      this.root.style.setProperty('--elk-highlight-bg', this.options.highlightColor);
    }

    this.stage = document.createElement('div');
    this.stage.className = 'elk-flipbook__stage';
    this.root.appendChild(this.stage);

    this.overlay = document.createElement('div');
    this.overlay.className = 'elk-flipbook__overlay';
    this.root.appendChild(this.overlay);

    this.container.replaceChildren(this.root);

    this.basePageWidth = this.options.basePageWidth;
    this.basePageHeight = this.options.basePageHeight;

    const aspect = this.basePageHeight / this.basePageWidth;
    const containerWidth = this.container.clientWidth || this.basePageWidth;
    const responsiveWidth = Math.max(320, Math.min(this.basePageWidth, containerWidth));
    const responsiveHeight = Math.max(320, responsiveWidth * aspect);
    const minWidth = 200;

    this.pageFlip = new PageFlip(this.stage, {
      width: responsiveWidth,
      height: responsiveHeight,
      size: 'stretch',
      minWidth,
      minHeight: 400,
      maxWidth: 2000,
      maxHeight: 2000,
      drawShadow: true,
      flippingTime: 800,
      maxShadowOpacity: 0.5,
      showCover: !!this.options.hardCover,
      usePortrait: true,
      autoSize: true,
      useMouseEvents: true
    });

    this.pageFlip.on('flip', (event) => {
      const pageNumber = typeof event.data === 'number' ? event.data + 1 : Number(event.data) + 1;
      // Delay highlight rendering to ensure page flip animation has settled
      this.scheduleHighlightRender(pageNumber);
      this.options.onFlip?.(pageNumber);
    });

    // Re-render highlights when orientation changes (portrait <-> landscape)
    this.pageFlip.on('changeOrientation', () => {
      this.scheduleHighlightRender();
    });

    this.resizeHandler = () => {
      this.pageFlip.update();
      this.scheduleHighlightRender();
    };

    window.addEventListener('resize', this.resizeHandler);
    this.resizeObserver = new ResizeObserver(this.resizeHandler);
    this.resizeObserver.observe(this.stage);
  }

  /**
   * Schedule a highlight render with debouncing to avoid flicker during animations
   */
  private scheduleHighlightRender(pageNumber?: number): void {
    if (this.pendingHighlightRender !== null) {
      window.cancelAnimationFrame(this.pendingHighlightRender);
    }
    this.pendingHighlightRender = window.requestAnimationFrame(() => {
      this.pendingHighlightRender = null;
      this.renderActiveHighlight(pageNumber);
    });
  }

  loadFromAssets(assets: PageAsset[]): void {
    this.pageFlip.loadFromImages(assets.map((asset) => asset.url));
  }

  goToPage(page: number): void {
    const target = Math.max(0, page - 1);
    this.pageFlip.flip(target);
  }

  nextPage(): void {
    const current = this.getCurrentPage();
    this.goToPage(Math.min(this.getPageCount(), current + 1));
  }

  previousPage(): void {
    const current = this.getCurrentPage();
    this.goToPage(Math.max(1, current - 1));
  }

  getPageCount(): number {
    return this.pageFlip.getPageCount();
  }

  getCurrentPage(): number {
    return this.pageFlip.getCurrentPageIndex() + 1;
  }

  private clearHighlights(): void {
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
    const targetIndex = pageNumber - 1;

    if (orientation === 'portrait') {
      // Single page view
      return targetIndex === currentIndex;
    }

    // Landscape mode: 2-page spread
    // Page 0 (cover) is alone on the right
    // Then pages are paired: [1,2], [3,4], [5,6], etc.
    if (currentIndex === 0) {
      return targetIndex === 0;
    }

    // For spreads, determine which pair is showing
    // When currentIndex is odd, we show [currentIndex, currentIndex+1]
    // When currentIndex is even, we show [currentIndex-1, currentIndex]
    const leftPageIndex = currentIndex % 2 === 1 ? currentIndex : currentIndex - 1;
    const rightPageIndex = leftPageIndex + 1;

    return targetIndex === leftPageIndex || targetIndex === rightPageIndex;
  }

  /**
   * Get the position of a page within the stage.
   * Returns null if the page is not currently visible.
   */
  private getPagePosition(pageNumber: number): { x: number; y: number; width: number; height: number } | null {
    const pageIndex = pageNumber - 1;
    const orientation = this.pageFlip.getOrientation();
    const bookRect = this.pageFlip.getBoundsRect();
    
    // Get stage dimensions
    const stageRect = this.root.getBoundingClientRect();

    // Try to find the page element directly in the DOM
    // This is the most accurate method when available
    const pageElement = this.findPageElement(pageIndex);
    if (pageElement) {
      const pageRect = pageElement.getBoundingClientRect();
      // Validate the element has reasonable dimensions
      if (pageRect.width > 10 && pageRect.height > 10) {
        return {
          x: pageRect.left - stageRect.left,
          y: pageRect.top - stageRect.top,
          width: pageRect.width,
          height: pageRect.height
        };
      }
    }

    // Fallback: calculate position based on book geometry from getBoundsRect()
    // bookRect.left/top are relative to the stage element
    const displayPageWidth = bookRect.pageWidth;
    const displayPageHeight = bookRect.height;
    const bookOriginX = bookRect.left;
    const bookOriginY = bookRect.top;

    if (orientation === 'portrait') {
      // Single page view - the page fills the book area
      // In portrait, bookRect.width equals bookRect.pageWidth
      return {
        x: bookOriginX,
        y: bookOriginY,
        width: displayPageWidth,
        height: displayPageHeight
      };
    }

    // Landscape mode: 2-page spread
    const currentIndex = this.pageFlip.getCurrentPageIndex();
    
    // With showCover=true:
    // - Index 0 (cover) is shown alone on the right half
    // - Subsequent spreads pair odd+even indices: [1,2], [3,4], [5,6]
    
    if (currentIndex === 0 && pageIndex === 0) {
      // Cover page is on the right side
      return {
        x: bookOriginX + displayPageWidth,
        y: bookOriginY,
        width: displayPageWidth,
        height: displayPageHeight
      };
    }

    // Determine left/right positioning for spread pages
    // The spread showing when currentIndex=N:
    // - If N is odd: pages N (left) and N+1 (right)
    // - If N is even: pages N-1 (left) and N (right)
    const leftPageIndex = currentIndex % 2 === 1 ? currentIndex : currentIndex - 1;
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

  /**
   * Find the DOM element for a specific page index.
   * PageFlip creates elements that can be located in the DOM.
   */
  private findPageElement(pageIndex: number): HTMLElement | null {
    // Try PageFlip's getPage API first
    try {
      const pageObj = this.pageFlip.getPage(pageIndex);
      if (pageObj) {
        const element = pageObj.getElement();
        if (element && element.getBoundingClientRect) {
          const rect = element.getBoundingClientRect();
          // Only use if element is visible and has valid dimensions
          if (rect.width > 0 && rect.height > 0) {
            return element;
          }
        }
      }
    } catch {
      // getPage may throw or return null
    }

    // Fallback: search for page elements with specific class patterns
    // PageFlip uses class names like "stf__item" for page wrappers
    const stfItems = this.stage.querySelectorAll<HTMLElement>('.stf__item');
    for (const item of stfItems) {
      const pageAttr = item.getAttribute('data-page');
      if (pageAttr !== null && parseInt(pageAttr, 10) === pageIndex) {
        return item;
      }
    }

    return null;
  }

  private renderActiveHighlight(currentPage?: number): void {
    this.clearHighlights();

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
      // Fallback pulse if no text layer
      this.overlay.classList.add('elk-flipbook__overlay--highlight');
      if (this.highlightTimer !== null) {
        window.clearTimeout(this.highlightTimer);
      }
      this.highlightTimer = window.setTimeout(() => {
        this.overlay.classList.remove('elk-flipbook__overlay--highlight');
        this.highlightTimer = null;
      }, 900);
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
      this.overlay.appendChild(highlight);
      this.highlights.push(highlight);
    });
  }

  highlightMatch(page: number, start: number, length: number): void {
    this.activeHighlight = { page, start, length };
    
    const currentIndex = this.pageFlip.getCurrentPageIndex();
    const targetIndex = page - 1;
    
    // Check if we're already on the target page
    if (this.isPageVisible(page)) {
      // Already visible, just render the highlight
      this.scheduleHighlightRender();
    } else {
      // Navigate to the page
      // Use turnToPage for immediate jump, or flip for animation
      this.pageFlip.turnToPage(targetIndex);
      // Give PageFlip time to update DOM, then render highlight
      setTimeout(() => {
        this.scheduleHighlightRender();
      }, 100);
    }
  }

  destroy(): void {
    if (this.pendingHighlightRender !== null) {
      window.cancelAnimationFrame(this.pendingHighlightRender);
    }
    if (this.highlightTimer !== null) {
      window.clearTimeout(this.highlightTimer);
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
  }
}
