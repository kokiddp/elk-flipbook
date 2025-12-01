import './styles/base.css';

import { destroyPdfWorker, loadPdfDocument } from './core/pdfLoader';
import { renderPageToBlobUrl, type RenderedPage } from './core/pageRenderer';
import { extractPageText } from './core/textExtraction';
import { SearchIndex } from './core/searchIndex';
import { OcrEngine } from './core/ocr';
import { FlipbookView, type PageAsset } from './core/flipbookView';
import type { FlipbookInstance, FlipbookOptions, SearchResult } from './types/api';

export async function createFlipbook(options: FlipbookOptions): Promise<FlipbookInstance> {
  const {
    container,
    source,
    hardCover = true,
    renderScale = 1.4,
    search,
    ocr,
    onProgress
  } = options;

  if (!container) {
    throw new Error('A container HTMLElement is required.');
  }

  const emitProgress = (event: Parameters<NonNullable<FlipbookOptions['onProgress']>>[0]) =>
    onProgress?.(event);

  try {
    emitProgress({ phase: 'loading', message: 'Loading PDF…' });
    const documentProxy = await loadPdfDocument(source);

    const pageCount = documentProxy.numPages;
    const searchIndex = new SearchIndex();
    const renderedPages: RenderedPage[] = [];
  const assets: PageAsset[] = [];
  const ocrEngine = new OcrEngine(ocr);

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await documentProxy.getPage(pageNumber);
      emitProgress({
        phase: 'rendering',
        page: pageNumber,
        pages: pageCount,
        message: `Rendering page ${pageNumber}/${pageCount}`
      });

      const [rendered, extracted] = await Promise.all([
        renderPageToBlobUrl(page, renderScale),
        extractPageText(page)
      ]);

      let text = extracted.text;
      if (ocrEngine.shouldRun(text)) {
        emitProgress({
          phase: 'ocr',
          page: pageNumber,
          pages: pageCount,
          message: `Running OCR for page ${pageNumber}`
        });

        const ocrText = await ocrEngine.recognize(rendered.blob);
        if (ocrText.trim()) {
          text = ocrText;
        }
      }

      searchIndex.addPage(pageNumber, text);
      assets.push({ url: rendered.url, width: rendered.width, height: rendered.height });
      renderedPages.push(rendered);
  }

  const view = new FlipbookView(container, {
    hardCover,
    width: assets[0]?.width,
    height: assets[0]?.height,
    highlightColor: search?.highlightColor,
    onFlip: (page) =>
      emitProgress({
        phase: 'rendering',
        page,
        pages: pageCount,
          message: `Navigated to page ${page}`
        })
    });

    view.loadFromAssets(assets);
    emitProgress({ phase: 'ready', pages: pageCount, message: 'Flipbook ready' });

    const instance: FlipbookInstance = {
      goToPage: (page: number) => view.goToPage(page),
      nextPage: () => view.nextPage(),
      previousPage: () => view.previousPage(),
      getPageCount: () => view.getPageCount(),
      getCurrentPage: () => view.getCurrentPage(),
      search: async (query: string): Promise<SearchResult[]> => {
        const results = searchIndex.search(query, search?.maxResults);
        return results;
      },
      highlight: (result: SearchResult) => {
        view.highlightPage(result.page);
      },
      destroy: () => {
        view.destroy();
        renderedPages.forEach((page) => page.cleanup());
        ocrEngine.terminate();
        documentProxy.destroy();
        destroyPdfWorker();
      }
    };

    return instance;
  } catch (error) {
    emitProgress({
      phase: 'error',
      message: (error as Error).message,
      error: error as Error
    });
    throw error;
  }
}
