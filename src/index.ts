// Main API
export { 
  createFlipbook, 
  ElkFlipbook, 
  VERSION, 
  getInstances, 
  destroyAll 
} from './flipbook';

// UI Components
export { SearchUI } from './ui/SearchUI';

// Types
export type {
  FlipbookInstance,
  FlipbookOptions,
  FlipbookProgressEvent,
  FlipbookState,
  FlipbookEventType,
  FlipbookEventMap,
  OcrOptions,
  PdfSource,
  SearchOptions,
  SearchResult,
  SearchUIOptions,
  SearchUIPosition,
  SearchUILabels
} from './types/api';
