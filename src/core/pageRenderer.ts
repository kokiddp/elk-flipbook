import type { PDFPageProxy } from 'pdfjs-dist';

export interface RenderedPage {
  url: string;
  blob: Blob;
  width: number;
  height: number;
  cleanup: () => void;
}

export async function renderPageToBlobUrl(
  page: PDFPageProxy,
  scale = 1.4,
  mimeType: string = 'image/png'
): Promise<RenderedPage> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });

  if (!context) {
    throw new Error('Canvas 2D context is not available in this environment.');
  }

  const width = Math.ceil(viewport.width);
  const height = Math.ceil(viewport.height);

  canvas.width = width;
  canvas.height = height;

  await page.render({ canvasContext: context, viewport }).promise;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) {
        resolve(value);
        return;
      }

      try {
        resolve(dataUrlToBlob(canvas.toDataURL(mimeType)));
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Failed to create page blob.'));
      }
    }, mimeType);
  });

  const url = URL.createObjectURL(blob);

  return {
    url,
    blob,
    width,
    height,
    cleanup: () => URL.revokeObjectURL(url)
  };
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [prefix, data] = dataUrl.split(',');
  const matches = /data:(.*);base64/.exec(prefix);
  const mime = matches?.[1] ?? 'image/png';
  const binary = atob(data);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}
