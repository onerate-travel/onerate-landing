import { defineConfig } from 'vitest/config';

// No `environment` — the language test builds its own JSDOM per case so it can set
// navigator.language before the page's inline script reads it. A global DOM would not help.
export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
  },
});
