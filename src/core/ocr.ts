import type { Worker } from 'tesseract.js';
import { createWorker } from 'tesseract.js';
import type { OcrOptions } from '../types/api';

export class OcrEngine {
  private workerPromise: Promise<Worker> | null = null;
  private readonly options: Required<OcrOptions>;

  constructor(options: OcrOptions = {}) {
    this.options = {
      enabled: options.enabled ?? true,
      lang: options.lang ?? 'eng',
      minTextLength: options.minTextLength ?? 16
    };
  }

  shouldRun(existingText: string): boolean {
    if (!this.options.enabled) return false;
    const density = existingText.replace(/\s+/g, '').length;
    return density < this.options.minTextLength;
  }

  async recognize(image: ImageBitmapSource | Blob): Promise<string> {
    if (!this.options.enabled) {
      return '';
    }

    const worker = await this.ensureWorker();
    const { data } = await worker.recognize(image);
    return (data.text ?? '').trim();
  }

  async terminate(): Promise<void> {
    if (this.workerPromise) {
      const worker = await this.workerPromise;
      await worker.terminate();
      this.workerPromise = null;
    }
  }

  private ensureWorker(): Promise<Worker> {
    if (!this.workerPromise) {
      this.workerPromise = (async () => {
        const worker = createWorker();
        await worker.load();
        await worker.loadLanguage(this.options.lang);
        await worker.initialize(this.options.lang);
        return worker;
      })();
    }

    return this.workerPromise;
  }
}
