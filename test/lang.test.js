import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

// The *shipped* page, not a copy of its script. Editing the inline JavaScript in index.html is
// what must make these tests fail — that is the whole point of reading from disk.
const PAGE = readFileSync(fileURLToPath(new URL('../public/index.html', import.meta.url)), 'utf8');

/**
 * Parse the page with `navigator.language` forced to `locale`, and report the language it chose.
 *
 * `beforeParse` is the only moment this can be set: the page's inline script reads
 * `navigator.language` once, while the document is being parsed.
 */
function langFor(locale) {
  const dom = new JSDOM(PAGE, {
    runScripts: 'dangerously',
    beforeParse(window) {
      Object.defineProperty(window.navigator, 'language', {
        value: locale,
        configurable: true,
      });
    },
  });
  const lang = dom.window.document.documentElement.lang;
  dom.window.close();
  return lang;
}

// Characterization tests: they record what the page does TODAY, so R3.4.4 (see ROADMAP.md) has a
// concrete red-to-green target if the owner decides the portal's en-default should win instead.
describe('landing language default', () => {
  it('picks Turkish for a tr-* browser', () => {
    expect(langFor('tr-TR')).toBe('tr');
  });

  it('picks English for an en-* browser', () => {
    expect(langFor('en-US')).toBe('en');
  });

  it('falls back to English for any other locale', () => {
    expect(langFor('de-DE')).toBe('en');
  });
});
