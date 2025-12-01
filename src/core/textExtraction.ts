import type { PDFPageProxy } from 'pdfjs-dist';

export interface TextExtractionResult {
  text: string;
  density: number;
}

export async function extractPageText(page: PDFPageProxy): Promise<TextExtractionResult> {
  const textContent = await page.getTextContent();
  const combined = textContent.items
    .map((item) => ('str' in item ? item.str : (item as { unicode?: string }).unicode ?? ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const density = combined.replace(/\s+/g, '').length;
  return { text: combined, density };
}
