import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'ElkFlipbook',
      fileName: (format) => `elk-flipbook.${format}.js`
    },
    rollupOptions: {
      external: ['page-flip', 'pdfjs-dist', 'tesseract.js'],
      output: {
        globals: {
          'page-flip': 'pageFlip',
          'pdfjs-dist': 'pdfjsDist',
          'tesseract.js': 'tesseract_js'
        }
      }
    }
  }
});
