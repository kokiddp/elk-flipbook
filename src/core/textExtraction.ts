import type { PDFPageProxy } from 'pdfjs-dist';
import type { TextItem as PdfjsTextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api';

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

/** 6-element transformation matrix [a, b, c, d, e, f] */
type Transform = [number, number, number, number, number, number];

interface TextItem {
  str: string;
  transform: Transform;
  width: number;
  height?: number;
}

function multiplyTransform(m1: Transform, m2: Transform): Transform {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
  ];
}

function isTextItem(item: PdfjsTextItem | TextMarkedContent): item is PdfjsTextItem {
  return 'str' in item && 'transform' in item;
}

function toTextItem(item: PdfjsTextItem): TextItem {
  // Ensure the transform is exactly 6 elements
  const t = item.transform;
  return {
    str: item.str,
    transform: [t[0] ?? 0, t[1] ?? 0, t[2] ?? 0, t[3] ?? 0, t[4] ?? 0, t[5] ?? 0],
    width: item.width,
    height: item.height
  };
}

function buildSpans(items: TextItem[], viewportTransform: Transform, _viewportHeight: number): { spans: TextSpan[]; combined: string } {
  const spans: TextSpan[] = [];
  let cursor = 0;
  const parts: string[] = [];

  items.forEach((item, index) => {
    const text = item.str ?? '';
    const start = cursor;
    const end = start + text.length;

    const transform = multiplyTransform(viewportTransform, item.transform);
    const scaleX = Math.abs(viewportTransform[0]);
    const width = item.width * scaleX;
    // Height from the transform matrix
    const height = Math.max(Math.abs(transform[3]), Math.abs(transform[1]), item.height ?? 0);
    
    // transform[4] is the X position (already in screen coordinates)
    const left = transform[4];
    
    // transform[5] is Y in PDF coordinates (origin at bottom-left, Y up)
    // We need to convert to screen coordinates (origin at top-left, Y down)
    // The viewport transform already handles the Y flip, but we need to account for the baseline
    // After the transform, transform[5] gives us the baseline Y in screen coordinates
    // We subtract height to get the top of the text box
    const top = transform[5] - height;

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
  const textContent = await page.getTextContent();
  const rawItems = textContent.items.filter(isTextItem);
  const items = rawItems.map(toTextItem);

  const vt = viewport.transform;
  const viewportTransform: Transform = [vt[0] ?? 0, vt[1] ?? 0, vt[2] ?? 0, vt[3] ?? 0, vt[4] ?? 0, vt[5] ?? 0];
  
  const { spans, combined } = buildSpans(items, viewportTransform, viewport.height);

  const density = combined.replace(/\s+/g, '').length;
  return { text: combined, density, spans };
}
