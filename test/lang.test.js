import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

// The *shipped* page, not a copy of its script. Editing the inline JavaScript in index.html is
// what must make these tests fail — that is the whole point of reading from disk.
const PAGE = readFileSync(fileURLToPath(new URL('../public/index.html', import.meta.url)), 'utf8');

/**
 * Parse the page with `navigator.language` forced to `locale` and a fresh (optionally seeded)
 * localStorage, then report what the page did.
 *
 * `beforeParse` is the only moment either can be set: the page's inline script reads both once,
 * while the document is being parsed.
 */
function render(locale, { stored } = {}) {
  const store = new Map(stored ? [['onerate.lang', stored]] : []);
  const dom = new JSDOM(PAGE, {
    runScripts: 'dangerously',
    beforeParse(window) {
      Object.defineProperty(window.navigator, 'language', { value: locale, configurable: true });
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: {
          getItem: (key) => (store.has(key) ? store.get(key) : null),
          setItem: (key, value) => store.set(key, String(value)),
          removeItem: (key) => store.delete(key),
        },
      });
    },
  });
  const { document } = dom.window;
  const description = () =>
    document.querySelector('meta[name="description"]')?.getAttribute('content');
  const result = {
    lang: document.documentElement.lang,
    title: document.title,
    description: description(),
    select: document.querySelector('#lang'),
    text: (key) => document.querySelector(`[data-i18n="${key}"]`)?.textContent.trim(),
    /** Choose a language the way a visitor does, then re-read the page. */
    choose(value) {
      const select = document.querySelector('#lang');
      select.value = value;
      select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
      return {
        lang: document.documentElement.lang,
        title: document.title,
        description: description(),
        text: (key) => document.querySelector(`[data-i18n="${key}"]`)?.textContent.trim(),
        stored: store.get('onerate.lang'),
      };
    },
    close: () => dom.window.close(),
  };
  return result;
}

// Characterization tests: they record what the page does TODAY, so R3.4.4 (see ROADMAP.md) has a
// concrete red-to-green target if the owner decides the portal's en-default should win instead.
describe('landing language default', () => {
  it.each([
    ['tr-TR', 'tr'],
    ['en-US', 'en'],
    ['bg-BG', 'bg'],
    ['hu-HU', 'hu'],
    ['it-IT', 'it'],
    ['pl-PL', 'pl'],
    ['ro-RO', 'ro'],
  ])('picks %s for a %s browser', (locale, expected) => {
    const page = render(locale);
    expect(page.lang).toBe(expected);
    page.close();
  });

  it('falls back to English for a language the page does not speak', () => {
    const page = render('de-DE');
    expect(page.lang).toBe('en');
    page.close();
  });

  /**
   * A three-letter tag that merely BEGINS with a known language is not that language.
   *
   * `roa` is the ISO 639-2 collective code for the Romance languages, not Romanian. The page used
   * to test its browser tag with `indexOf(prefix) === 0`, which was unambiguous while the only
   * prefixes were `tr` and `en` and stops being so the moment `ro` is one of them.
   */
  it('does not mistake a longer tag for a language it knows', () => {
    const page = render('roa');
    expect(page.lang).toBe('en');
    page.close();
  });
});

describe('choosing a language', () => {
  it('rewrites the copy on the page, not just the lang attribute', () => {
    const page = render('en-US');
    expect(page.text('tagline')).toBe('B2B hotel distribution, cheapest-first.');

    const after = page.choose('pl');
    expect(after.lang).toBe('pl');
    expect(after.text('tagline')).toBe('Dystrybucja hotelowa B2B, najtańsze na początku.');
    expect(after.text('ctaDocs')).toBe('Przeczytaj dokumentację');
    page.close();
  });

  it('retitles the browser tab and the meta description, not only the body', () => {
    // The tab title and the search snippet are copy like any other string on the page. Before
    // they joined the TEXT dictionary, a visitor who switched to Turkish kept an English tab —
    // the one piece of the page still visible after they moved to another one.
    const page = render('en-US');
    expect(page.title).toBe('OneRate — B2B Hotel Distribution');

    const after = page.choose('tr');
    expect(after.title).toBe('OneRate — B2B Otel Dağıtımı');
    expect(after.description).toContain('otel dağıtımı');
    page.close();
  });

  it('can go back to English, which is not a special case', () => {
    const page = render('bg-BG');
    expect(page.text('questions')).toBe('Въпроси?');
    expect(page.choose('en').text('questions')).toBe('Questions?');
    page.close();
  });

  it('remembers the choice for the next visit', () => {
    const first = render('en-US');
    expect(first.choose('hu').stored).toBe('hu');
    first.close();

    // A stored choice beats the browser's own language: the visitor said so explicitly.
    const second = render('en-US', { stored: 'hu' });
    expect(second.lang).toBe('hu');
    second.close();
  });

  it('ignores a stored value that is not a language the page has', () => {
    // localStorage is visitor-writable and survives a redeploy that drops a language.
    const page = render('it-IT', { stored: 'xx' });
    expect(page.lang).toBe('it');
    page.close();
  });

  it('ignores a stored value that only exists on Object.prototype', () => {
    // 'xx' above misses TEXT honestly; 'constructor' does not — every object answers for it
    // through the prototype chain, so a truthiness check (`TEXT[stored]`) accepts it and ships
    // <html lang="constructor">. The lookup must ask about OWN keys only.
    const page = render('it-IT', { stored: 'constructor' });
    expect(page.lang).toBe('it');
    page.close();
  });
});

describe('the language control', () => {
  it('is a combobox, not a row of toggles', () => {
    const page = render('en-US');
    expect(page.select.tagName).toBe('SELECT');
    expect(page.select.multiple).toBe(false);
    page.close();
  });

  it('names every language in itself, so a reader can find their own', () => {
    const page = render('en-US');
    expect([...page.select.options].map((option) => option.textContent)).toEqual([
      'English',
      'Türkçe',
      'Български',
      'Magyar',
      'Italiano',
      'Polski',
      'Română',
    ]);
    page.close();
  });

  it('carries an accessible name in the language on screen', () => {
    // There is no visible label beside it, so this attribute is the only name the control has —
    // and leaving it in English on a Turkish page would announce the wrong word to a screen reader.
    const page = render('tr-TR');
    expect(page.select.getAttribute('aria-label')).toBe('Dil');
    page.close();
  });
});
