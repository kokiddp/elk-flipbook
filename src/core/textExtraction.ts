import type { PDFPageProxy } from 'pdfjs-dist';

export interface TextExtractionResult {
  text: string;
  density: number;
  spans: TextSpan[];
}

export interface TextSpan {
  text: string;
  start: number;
  end: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

type TextItem = {
  str: string;
  transform: number[];
  width: number;
  height?: number;
};

function multiplyTransform(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
  ];
}

function buildSpans(items: TextItem[], viewportTransform: number[]): { spans: TextSpan[]; combined: string } {
  const spans: TextSpan[] = [];
  let cursor = 0;
  const parts: string[] = [];

  items.forEach((item, index) => {
    const text = item.str ?? '';
    const start = cursor;
    const end = start + text.length;

    const transform = multiplyTransform(viewportTransform, item.transform);
    const width = item.width * viewportTransform[0];
    const height = Math.max(Math.abs(transform[3]), Math.abs(transform[1]), item.height ?? 0);
    const left = transform[4];
    const top = transform[5] - height; // align to top-left origin

    spans.push({ text, start, end, left, top, width, height });

    parts.push(text);
    cursor = end;

    if (index < items.length - 1) {
      // insert a single separating space in the combined string
      cursor += 1;
      parts.push(' ');
    }
  });

  return { spans, combined: parts.join('') };
}

export async function extractPageText(page: PDFPageProxy, scale = 1): Promise<TextExtractionResult> {
  const viewport = page.getViewport({ scale });
  const textContent = await page.getTextContent({ normalizeWhitespace: true });
  const items = textContent.items.filter((item): item is TextItem => 'str' in item);

  const { spans, combined } = buildSpans(items, viewport.transform);

  const density = combined.replace(/\s+/g, '').length;
  return { text: combined, density, spans };
}
