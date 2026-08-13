import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

// The *shipped* page, for the same reason lang.test.js reads it: editing public/index.html is what
// must make these fail.
const PAGE = readFileSync(fileURLToPath(new URL('../public/index.html', import.meta.url)), 'utf8');

/**
 * The page's own `TEXT` dictionary, read out of the running page rather than re-declared here.
 *
 * The script is an IIFE with nothing exported, so it is executed and the dictionary is recovered by
 * asking the page to render each language and reading what it put on screen. That is a longer road
 * than importing a module would be, and it is the road that tests the SHIPPED artifact — the same
 * choice this repo's CLAUDE.md pins for `lang.test.js`.
 */
function copyFor(locale) {
  const dom = new JSDOM(PAGE, {
    runScripts: 'dangerously',
    beforeParse(window) {
      Object.defineProperty(window.navigator, 'language', { value: locale, configurable: true });
    },
  });
  const { document } = dom.window;
  // A <meta> keeps its copy in `content`, not in text — mirror the page's own loop, which makes
  // the same distinction, so the meta description is checked as strictly as the visible strings.
  const copyOf = (el) =>
    el.tagName === 'META' ? (el.getAttribute('content') ?? '').trim() : el.textContent.trim();
  const entries = [...document.querySelectorAll('[data-i18n]')].map((el) => [
    el.getAttribute('data-i18n'),
    copyOf(el),
  ]);
  const result = { lang: document.documentElement.lang, copy: Object.fromEntries(entries) };
  dom.window.close();
  return result;
}

const STATIC = new JSDOM(PAGE).window.document;
const KEYS = [...STATIC.querySelectorAll('[data-i18n]')].map((el) => el.getAttribute('data-i18n'));
const LOCALES = [...STATIC.querySelectorAll('#lang option')].map((option) => option.value);

/**
 * CLAUDE.md used to state this rule about spans: "A `data-en` span without its `data-tr` sibling
 * ships a half-translated page." The page no longer has paired spans — the copy moved into one
 * dictionary keyed by language — but the rule survives the refactor and is what this file enforces,
 * now across SEVEN languages rather than two.
 *
 * The failure mode changed shape and did not go away. An element whose key is missing from a
 * language keeps whatever text it already had, which is the ENGLISH written into the markup: the
 * page renders one English sentence in the middle of six Polish ones, looks complete, and passes
 * every other test. That is exactly what a reviewer's eye skips.
 */
describe('every string is translated into every language', () => {
  it('has keys and locales to check', () => {
    // Never vacuous: if the markup stopped carrying `data-i18n`, or the switcher stopped carrying
    // options, every assertion below would pass over an empty set.
    expect(KEYS.length).toBeGreaterThan(0);
    expect(LOCALES.length).toBe(7);
    expect(LOCALES).toContain('en');
  });

  it.each(LOCALES)('%s says every one of them in its own words', (locale) => {
    const english = copyFor('en-US').copy;
    const { lang, copy } = copyFor(locale);
    expect(lang, `the page did not switch to ${locale}`).toBe(locale);

    const missing = KEYS.filter((key) => !copy[key]);
    expect(missing, `${locale} has no copy for these keys`).toEqual([]);

    if (locale === 'en') return;
    // Left-behind English is the whole failure this test exists for, so it is asserted rather than
    // inferred from the key being present.
    const untranslated = KEYS.filter((key) => copy[key] === english[key]);
    expect(untranslated, `${locale} still shows the English text for these keys`).toEqual([]);
  });
});

describe('the default language is in the markup, not only in the script', () => {
  /**
   * A visitor with JavaScript off, and every crawler that does not run it, sees the raw HTML. When
   * the copy moved into a dictionary the obvious implementation — empty elements filled by the
   * script — would have shipped a blank page to both. The English text is therefore written into
   * the markup and the script only ever replaces it.
   */
  it('renders real sentences with no script run at all', () => {
    const noScript = new JSDOM(PAGE).window.document;
    for (const key of KEYS) {
      const el = noScript.querySelector(`[data-i18n="${key}"]`);
      const text =
        el?.tagName === 'META' ? el.getAttribute('content')?.trim() : el?.textContent.trim();
      expect(text, `[data-i18n="${key}"] is empty without JavaScript`).toBeTruthy();
    }
    expect(noScript.querySelector('[data-i18n="tagline"]').textContent).toContain('B2B hotel');
  });
});

describe('the head a crawler reads, with no script run', () => {
  /**
   * Pages answers every unmatched path with this page at 200 (no custom 404.html — CLAUDE.md,
   * point 1), so to a crawler /anything is a duplicate of /. The canonical link is what collapses
   * them back into one URL, which makes it the one head tag this project cannot do without.
   */
  it('declares one canonical URL, because every path serves this page', () => {
    const canonical = STATIC.querySelector('link[rel="canonical"]');
    expect(canonical?.getAttribute('href')).toBe('https://onerate.travel/');
  });

  it('carries Open Graph and Twitter card copy for link unfurlers', () => {
    const og = (prop) => STATIC.querySelector(`meta[property="${prop}"]`)?.getAttribute('content');
    expect(og('og:title')).toBeTruthy();
    expect(og('og:description')).toBeTruthy();
    expect(og('og:type')).toBe('website');
    expect(og('og:url')).toBe('https://onerate.travel/');
    expect(STATIC.querySelector('meta[name="twitter:card"]')?.getAttribute('content')).toBe(
      'summary'
    );
  });

  it('ships a robots.txt that allows everything', () => {
    const robots = readFileSync(
      fileURLToPath(new URL('../public/robots.txt', import.meta.url)),
      'utf8'
    );
    expect(robots).toMatch(/^User-agent: \*$/m);
    expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).not.toMatch(/^Disallow:/m);
  });
});

describe('the outbound links', () => {
  const hrefs = () => [...STATIC.querySelectorAll('a')].map((a) => a.getAttribute('href'));

  it('offers the portal', () => {
    expect(hrefs()).toContain('https://app.onerate.travel');
  });

  it('offers the documentation', () => {
    // The reader who is not ready to sign in has, until now, had nowhere to go but an email
    // address. docs.onerate.travel is the answer to "what is this and how does it work".
    expect(hrefs()).toContain('https://docs.onerate.travel');
  });

  it('keeps its links through a language change', () => {
    // The script writes `textContent`, which would erase a nested <a> if a key ever wrapped one.
    // The CTAs ARE the anchors, so their href must survive being retranslated.
    const dom = new JSDOM(PAGE, { runScripts: 'dangerously' });
    const select = dom.window.document.getElementById('lang');
    select.value = 'ro';
    select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    const links = [...dom.window.document.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toContain('https://app.onerate.travel');
    expect(links).toContain('https://docs.onerate.travel');
    expect(links).toContain('mailto:hello@onerate.travel');
    dom.window.close();
  });
});
