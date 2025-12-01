declare module 'page-flip' {
  export interface PageFlipOptions {
    width?: number;
    height?: number;
    size?: 'fixed' | 'stretch';
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    maxShadowOpacity?: number;
    showCover?: boolean;
    mobileScrollSupport?: boolean;
    autoSize?: boolean;
    clickEventForward?: boolean;
    useMouseEvents?: boolean;
    startPage?: number;
    flippingTime?: number;
    disableFlipByClick?: boolean;
    usePortrait?: boolean;
    drawShadow?: boolean;
    startZIndex?: number;
  }

  export class PageFlip {
    constructor(element: HTMLElement, options?: PageFlipOptions);
    loadFromHTML(elements: HTMLElement[] | NodeListOf<HTMLElement>): void;
    loadFromImages(images: string[] | NodeListOf<HTMLImageElement>): void;
    flip(page: number): void;
    flipNext(): void;
    flipPrev(): void;
    turnToPage(page: number): void;
    turnToNextPage(): void;
    turnToPrevPage(): void;
    getPageCount(): number;
    getCurrentPageIndex(): number;
    getOrientation(): 'portrait' | 'landscape';
    getBoundsRect(): PageRect;
    getPage(pageIndex: number): Page | null;
    update(): void;
    on(eventName: 'flip' | 'changeOrientation' | 'changeState', handler: (event: { data: unknown }) => void): void;
    off(eventName: string): void;
    destroy(): void;
  }

  export interface Page {
    getElement(): HTMLElement;
  }

  export interface PageRect {
    left: number;
    top: number;
    width: number;
    height: number;
    pageWidth: number;
  }
}
