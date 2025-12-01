export type PdfSource = string | URL | File | Blob | ArrayBuffer | Uint8Array;

export interface SearchOptions {
  highlightColor?: string;
  maxResults?: number;
}

export interface OcrOptions {
  enabled?: boolean;
  lang?: string;
  minTextLength?: number;
}

export interface FlipbookOptions {
  container: HTMLElement;
  source: PdfSource;
  hardCover?: boolean;
  renderScale?: number;
  search?: SearchOptions;
  ocr?: OcrOptions;
  onProgress?: (info: FlipbookProgressEvent) => void;
}

export interface FlipbookProgressEvent {
  phase: 'loading' | 'rendering' | 'ocr' | 'ready' | 'error';
  page?: number;
  pages?: number;
  message?: string;
  error?: Error;
}

export interface SearchResult {
  page: number;
  index: number;
  length: number;
  snippet: string;
}

export interface FlipbookInstance {
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  getPageCount: () => number;
  getCurrentPage: () => number;
  search: (query: string) => Promise<SearchResult[]>;
  highlight: (result: SearchResult) => void;
  destroy: () => void;
}
