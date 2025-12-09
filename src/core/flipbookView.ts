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
}

export class FlipbookView {
  private readonly root: HTMLElement;
  private readonly stage: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly pageFlip: PageFlip;
  private highlights: HTMLElement[] = [];
  private readonly basePageWidth: number;
  private readonly basePageHeight: number;
  private activeHighlight: { page: number; start: number; length: number } | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private resizeHandler: () => void;
  private pendingHighlightRender: number | null = null;
  private readonly hasHardCover: boolean;

  /**
   * Convert a CSS color to rgba string with the given multiplier for alpha.
   * Supports hex and rgb/rgba formats; falls back to the original string otherwise.
   */
  private toRgba(color: string, alpha: number): string {
    const hex = /^#([0-9a-fA-F]{3,8})$/;
    const rgb = /^rgba?\((\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([0-9.]+))?\)$/;

    const hexMatch = hex.exec(color.trim());
    if (hexMatch) {
      let value = hexMatch[1];
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

    const rgbMatch = rgb.exec(color.trim());
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1], 10);
      const g = parseInt(rgbMatch[2], 10);
      const b = parseInt(rgbMatch[3], 10);
      const baseAlpha = rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1;
      const finalAlpha = Math.max(0, Math.min(1, baseAlpha * alpha));
      return `rgba(${r}, ${g}, ${b}, ${finalAlpha})`;
    }

    return color;
  }

  constructor(private container: HTMLElement, private options: FlipbookViewOptions = {} as FlipbookViewOptions) {
    this.root = document.createElement('div');
    this.root.className = 'elk-flipbook';

    this.basePageWidth = this.options.basePageWidth;
    this.basePageHeight = this.options.basePageHeight;
    this.hasHardCover = !!this.options.hardCover;

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
      showCover: !!this.options.hardCover,
      usePortrait: true,
      autoSize: true
    });

    this.pageFlip.on('flip', (event) => {
      const pageNumber = typeof event.data === 'number' ? event.data + 1 : Number(event.data) + 1;
      // Delay highlight rendering to ensure page flip animation has settled
      this.scheduleHighlightRender();
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
    this.pageFlip.loadFromImages(assets.map((asset) => asset.url));
  }

  goToPage(page: number, animate = true): void {
    const total = this.getPageCount();
    if (total === 0) {
      return;
    }
    const clampedPage = Math.max(1, Math.min(total, page));
    const target = clampedPage - 1;
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
    const currentIndex = this.pageFlip.getCurrentPageIndex();
    if (currentIndex < total - 1) {
      this.pageFlip.flipNext();
    }
  }

  previousPage(): void {
    const total = this.getPageCount();
    if (total === 0) {
      return;
    }
    const currentIndex = this.pageFlip.getCurrentPageIndex();
    if (currentIndex > 0) {
      this.pageFlip.flipPrev();
    }
  }

  getPageCount(): number {
    return this.pageFlip.getPageCount();
  }

  getCurrentPage(): number {
    return this.pageFlip.getCurrentPageIndex() + 1;
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
    const targetIndex = pageNumber - 1;

    if (orientation === 'portrait') {
      return targetIndex === currentIndex;
    }

    // Landscape mode: handle both cover and no-cover flows
    if (this.hasHardCover && currentIndex === 0) {
      return targetIndex === 0;
    }

    const leftPageIndex = this.hasHardCover
      ? currentIndex % 2 === 1
        ? currentIndex
        : currentIndex - 1
      : currentIndex % 2 === 0
        ? currentIndex
        : currentIndex - 1;

    const normalizedLeft = Math.max(0, leftPageIndex);
    const rightPageIndex = normalizedLeft + 1;

    return targetIndex === normalizedLeft || targetIndex === rightPageIndex;
  }

  /**
   * Get the position of a page within the stage.
   * Returns null if the page is not currently visible.
   * 
   * PageFlip uses a canvas renderer - pages are drawn at positions determined by getBoundsRect().
   * The rect.left/top values are the position within the canvas, and pageWidth/height are the page dimensions.
   */
  private getPagePosition(pageNumber: number): { x: number; y: number; width: number; height: number } | null {
    const pageIndex = pageNumber - 1;
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
      // Portrait: book width equals pageWidth, keep centered
      const availableWidth = bookRect.width * canvasScaleX;
      const centerOffset = Math.max(0, (availableWidth - displayPageWidth) / 2);
      return {
        x: bookOriginX + centerOffset,
        y: bookOriginY,
        width: displayPageWidth,
        height: displayPageHeight
      };
    }

    // Landscape mode: 2-page spread
    const currentIndex = this.pageFlip.getCurrentPageIndex();
    
    // With hard cover:
    // - Index 0 (cover) is shown alone on the right half
    // - Subsequent spreads pair odd+even indices: [1,2], [3,4], [5,6]
    if (this.hasHardCover && currentIndex === 0 && pageIndex === 0) {
      return {
        x: bookOriginX + displayPageWidth,
        y: bookOriginY,
        width: displayPageWidth,
        height: displayPageHeight
      };
    }

    // Determine left/right positioning for spread pages
    const leftPageIndex = this.hasHardCover
      ? currentIndex % 2 === 1
        ? currentIndex
        : currentIndex - 1
      : currentIndex % 2 === 0
        ? currentIndex
        : currentIndex - 1;

    const normalizedLeft = Math.max(0, leftPageIndex);
    const rightPageIndex = normalizedLeft + 1;
    
    if (pageIndex === normalizedLeft) {
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
