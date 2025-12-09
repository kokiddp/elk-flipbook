import { createFlipbook, type FlipbookInstance, type SearchResult } from '../index';

const viewer = document.getElementById('viewer');
const statusEl = document.getElementById('status');
const searchForm = document.getElementById('search-form') as HTMLFormElement | null;
const searchInput = document.getElementById('search-term') as HTMLInputElement | null;
const searchCount = document.getElementById('search-count');
const prevButton = document.getElementById('prev-page');
const nextButton = document.getElementById('next-page');
const hitPrevButton = document.getElementById('hit-prev');
const hitNextButton = document.getElementById('hit-next');
const hitsList = document.getElementById('hits-list');

const demoPdf = 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf';

let flipbook: FlipbookInstance | null = null;
let searchResults: SearchResult[] = [];
let currentHit = -1;

function setStatus(message: string): void {
  if (statusEl) {
    statusEl.textContent = message;
  }
}

function updateSearchMeta(): void {
  if (!searchCount) return;
  if (!searchResults.length) {
    searchCount.textContent = 'No matches';
    return;
  }
  const label = `Hit ${currentHit + 1} of ${searchResults.length}`;
  searchCount.textContent = label;
}

function renderHits(): void {
  if (!hitsList) return;

  if (!searchResults.length) {
    hitsList.textContent = 'No matches yet';
    return;
  }

  hitsList.textContent = '';

  searchResults.forEach((result, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hit-item';
    button.dataset['hitIndex'] = String(index);

    const page = document.createElement('span');
    page.className = 'hit-item__page';
    page.textContent = `Page ${result.page}`;

    const snippet = document.createElement('span');
    snippet.className = 'hit-item__snippet';
    snippet.textContent = result.snippet ?? '';

    button.appendChild(page);
    button.appendChild(snippet);

    button.addEventListener('click', () => {
      highlightHit(index);
    });

    hitsList.appendChild(button);
  });
}

function highlightHit(index: number): void {
  if (!flipbook || !searchResults.length) return;
  const clamped = Math.max(0, Math.min(index, searchResults.length - 1));
  currentHit = clamped;
  const hit = searchResults[clamped];
  if (hit) {
    flipbook.highlight(hit);
    setStatus(`Showing match ${clamped + 1}/${searchResults.length} on page ${hit.page}`);
  }
  updateSearchMeta();
}

async function runSearch(query: string, jumpToFirst = true): Promise<void> {
  if (!flipbook) return;
  if (!query.trim()) {
    setStatus('Enter a search term');
    searchResults = [];
    currentHit = -1;
    updateSearchMeta();
    renderHits();
    return;
  }

  setStatus(`Searching for “${query}”…`);
  searchResults = await flipbook.search(query);
  currentHit = -1;

  if (!searchResults.length) {
    setStatus('No matches found');
    updateSearchMeta();
    renderHits();
    return;
  }

  renderHits();
  if (jumpToFirst) {
    highlightHit(0);
  } else {
    updateSearchMeta();
  }
}

async function bootstrap(): Promise<void> {
  if (!viewer) {
    throw new Error('Viewer container not found');
  }

  const initialQuery = new URLSearchParams(window.location.search).get('q') ?? '';
  if (searchInput && initialQuery) {
    searchInput.value = initialQuery;
  }

  setStatus('Loading PDF…');
  try {
    flipbook = await createFlipbook({
      container: viewer,
      source: demoPdf,
      hardCover: true,
      renderScale: 1.5,
      search: { highlightColor: '#f59e0b' },
      onProgress: (event) => {
        const message = event.message ?? event.phase;
        if (typeof event.page === 'number' && typeof event.pages === 'number') {
          setStatus(`${message} (${event.page}/${event.pages})`);
        } else {
          setStatus(message);
        }
      }
    });

    setStatus('Ready — try searching');

    if (initialQuery) {
      void runSearch(initialQuery, true);
    }
  } catch (error) {
    console.error('Failed to bootstrap flipbook', error);
    setStatus(`Error: ${(error as Error).message}`);
  }
}

bootstrap();

searchForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!flipbook || !searchInput) return;

  const query = searchInput.value.trim();
  await runSearch(query, true);
});

hitPrevButton?.addEventListener('click', () => {
  if (!searchResults.length) return;
  const nextIndex = currentHit <= 0 ? searchResults.length - 1 : currentHit - 1;
  highlightHit(nextIndex);
});

hitNextButton?.addEventListener('click', () => {
  if (!searchResults.length) return;
  const nextIndex = currentHit >= searchResults.length - 1 ? 0 : currentHit + 1;
  highlightHit(nextIndex);
});

prevButton?.addEventListener('click', () => {
  if (!flipbook) return;
  flipbook.previousPage();
});

nextButton?.addEventListener('click', () => {
  if (!flipbook) return;
  flipbook.nextPage();
});
