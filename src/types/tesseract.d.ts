declare module 'tesseract.js' {
  export type RecognizeOutput = { data: { text: string } };

  export interface Worker {
    load: () => Promise<void>;
    loadLanguage: (lang: string) => Promise<void>;
    initialize: (lang: string) => Promise<void>;
    recognize: (image: ImageBitmapSource | string | Blob | ArrayBufferView) => Promise<RecognizeOutput>;
    terminate: () => Promise<void>;
  }

  export function createWorker(options?: unknown): Worker;
  export function recognize(image: ImageBitmapSource | string | Blob | ArrayBufferView, lang?: string): Promise<RecognizeOutput>;
}
