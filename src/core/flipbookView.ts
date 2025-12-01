import { PageFlip } from 'page-flip';

export interface PageAsset {
  url: string;
  width: number;
  height: number;
}

export interface FlipbookViewOptions {
  hardCover?: boolean;
  width?: number;
  height?: number;
  onFlip?: (page: number) => void;
  highlightColor?: string;
}

export class FlipbookView {
  private readonly root: HTMLElement;
  private readonly stage: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly pageFlip: PageFlip;
  private highlightTimer: number | null = null;

  constructor(private container: HTMLElement, private options: FlipbookViewOptions = {}) {
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

    this.pageFlip = new PageFlip(this.stage, {
      width: this.options.width ?? 960,
      height: this.options.height ?? 640,
      size: 'stretch',
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
      this.options.onFlip?.(pageNumber);
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
    this.pageFlip.flipNext();
  }

  previousPage(): void {
    this.pageFlip.flipPrev();
  }

  getPageCount(): number {
    return this.pageFlip.getPageCount();
  }

  getCurrentPage(): number {
    return this.pageFlip.getCurrentPageIndex() + 1;
  }

  highlightPage(page: number): void {
    this.goToPage(page);
    this.overlay.classList.add('elk-flipbook__overlay--highlight');
    if (this.highlightTimer !== null) {
      window.clearTimeout(this.highlightTimer);
    }
    this.highlightTimer = window.setTimeout(() => {
      this.overlay.classList.remove('elk-flipbook__overlay--highlight');
      this.highlightTimer = null;
    }, 900);
  }

  destroy(): void {
    this.pageFlip.destroy();
    this.root.remove();
  }
}
