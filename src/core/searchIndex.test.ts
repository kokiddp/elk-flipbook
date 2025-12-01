import { describe, expect, it } from 'vitest';
import { SearchIndex } from './searchIndex';

describe('SearchIndex', () => {
  it('finds multiple hits on a page', () => {
    const index = new SearchIndex();
    index.addPage(1, 'hello world, hello elk');

    const results = index.search('hello');
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ page: 1, index: 0, length: 5 });
  });

  it('respects maxResults', () => {
    const index = new SearchIndex();
    index.addPage(1, 'a b c a b c');
    const results = index.search('a', 1);
    expect(results).toHaveLength(1);
  });

  it('returns empty for blank queries', () => {
    const index = new SearchIndex();
    index.addPage(1, 'anything');
    expect(index.search('')).toHaveLength(0);
  });
});
