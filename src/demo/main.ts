import { createFlipbook, type FlipbookInstance } from '../index';

const viewer = document.getElementById('viewer');
const statusEl = document.getElementById('status');
const searchForm = document.getElementById('search-form') as HTMLFormElement | null;
const searchInput = document.getElementById('search-term') as HTMLInputElement | null;
const searchCount = document.getElementById('search-count');
const prevButton = document.getElementById('prev-page');
const nextButton = document.getElementById('next-page');

const demoPdf =
  'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf';

let flipbook: FlipbookInstance | null = null;

function setStatus(message: string): void {
  if (statusEl) {
    statusEl.textContent = message;
  }
}

async function bootstrap(): Promise<void> {
  if (!viewer) {
    throw new Error('Viewer container not found');
  }

  setStatus('Loading PDF…');
  try {
    flipbook = await createFlipbook({
      container: viewer,
      source: demoPdf,
      hardCover: true,
      renderScale: 1.5,
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
  if (!query) return;

  setStatus(`Searching for “${query}”`);
  const results = await flipbook.search(query);

  if (searchCount) {
    searchCount.textContent = results.length
      ? `${results.length} match${results.length === 1 ? '' : 'es'}`
      : 'No matches';
  }

  if (results[0]) {
    flipbook.highlight(results[0]);
    setStatus(`Highlighted first match on page ${results[0].page}`);
  } else {
    setStatus('No matches found');
  }
});

prevButton?.addEventListener('click', () => {
  if (!flipbook) return;
  flipbook.previousPage();
});

nextButton?.addEventListener('click', () => {
  if (!flipbook) return;
  flipbook.nextPage();
});
