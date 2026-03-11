declare module 'tesseract.js' {
  export type RecognizeOutput = { data: { text: string } };

  export interface Worker {
    recognize: (image: ImageBitmapSource | string | Blob | ArrayBufferView) => Promise<RecognizeOutput>;
    terminate: () => Promise<void>;
  }

  export function createWorker(lang?: string | string[]): Promise<Worker>;
  export function recognize(image: ImageBitmapSource | string | Blob | ArrayBufferView, lang?: string): Promise<RecognizeOutput>;
}
