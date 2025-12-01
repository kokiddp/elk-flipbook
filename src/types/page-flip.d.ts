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
  }

  export class PageFlip {
    constructor(element: HTMLElement, options?: PageFlipOptions);
    loadFromHTML(elements: HTMLElement[] | NodeListOf<HTMLElement>): void;
    loadFromImages(images: string[] | NodeListOf<HTMLImageElement>): void;
    flip(page: number): void;
    flipNext(): void;
    flipPrev(): void;
    turnToPage(page: number): void;
    getPageCount(): number;
    getCurrentPageIndex(): number;
    on(eventName: 'flip', handler: (event: { data: number }) => void): void;
    destroy(): void;
  }
}
