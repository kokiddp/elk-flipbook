import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { DocumentInitParameters, PDFDocumentProxy } from 'pdfjs-dist';
import type { PdfSource } from '../types/api';

let pdfWorker: Worker | null = null;

function ensureWorker(): Worker {
  if (pdfWorker) {
    return pdfWorker;
  }

  const workerUrl = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url);
  pdfWorker = new Worker(workerUrl, {
    type: 'module'
  });

  // pdf.js will reuse this worker for all documents.
  (GlobalWorkerOptions as unknown as { workerPort?: Worker }).workerPort = pdfWorker;
  GlobalWorkerOptions.workerSrc = workerUrl.toString();
  return pdfWorker;
}

async function normalizeSource(source: PdfSource): Promise<DocumentInitParameters> {
  if (typeof source === 'string') {
    return { url: source };
  }

  if (source instanceof URL) {
    return { url: source.toString() };
  }

  if (source instanceof ArrayBuffer) {
    return { data: new Uint8Array(source) };
  }

  if (source instanceof Uint8Array) {
    return { data: source };
  }

  if (source instanceof Blob) {
    const buffer = await source.arrayBuffer();
    return { data: new Uint8Array(buffer) };
  }

  throw new Error('Unsupported PDF source type.');
}

export async function loadPdfDocument(source: PdfSource): Promise<PDFDocumentProxy> {
  ensureWorker();
  const init = await normalizeSource(source);
  const loadingTask = getDocument(init);
  return loadingTask.promise;
}

export function destroyPdfWorker(): void {
  if (pdfWorker) {
    pdfWorker.terminate();
    pdfWorker = null;
  }
}
