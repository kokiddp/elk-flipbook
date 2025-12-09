import type { SearchResult } from '../types/api';

export class SearchIndex {
  private pages = new Map<number, { raw: string; lower: string }>();

  addPage(page: number, text: string): void {
    const raw = text ?? '';
    this.pages.set(page, { raw, lower: raw.toLowerCase() });
  }

  search(query: string, maxResults?: number): SearchResult[] {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return [];
    }

    const results: SearchResult[] = [];

    const hardLimit = typeof maxResults === 'number' && maxResults > 0 ? maxResults : undefined;

    for (const [page, entry] of this.pages) {
      const haystack = entry.lower;
      let start = 0;

      while (start <= haystack.length) {
        const index = haystack.indexOf(normalized, start);
        if (index === -1) break;

        results.push({
          page,
          index,
          length: normalized.length,
          snippet: buildSnippet(entry.raw, index, normalized.length)
        });

        if (hardLimit && results.length >= hardLimit) {
          return results;
        }

        start = index + normalized.length;
      }

      if (hardLimit && results.length >= hardLimit) {
        return results;
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
