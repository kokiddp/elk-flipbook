import type { SearchResult } from '../types/api';

export class SearchIndex {
  private pages = new Map<number, string>();

  addPage(page: number, text: string): void {
    this.pages.set(page, text);
  }

  search(query: string, maxResults?: number): SearchResult[] {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return [];
    }

    const results: SearchResult[] = [];

    for (const [page, text] of this.pages) {
      const haystack = text.toLowerCase();
      let start = 0;

      while (start <= haystack.length) {
        const index = haystack.indexOf(normalized, start);
        if (index === -1) break;

        results.push({
          page,
          index,
          length: normalized.length,
          snippet: buildSnippet(text, index, normalized.length)
        });

        if (maxResults && results.length >= maxResults) {
          return results;
        }

        start = index + normalized.length;
      }
    }

    return results;
  }
}

function buildSnippet(text: string, index: number, length: number, radius = 40): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + length + radius);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${text.slice(start, end)}${suffix}`;
}
