import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

// The *shipped* page, like every other suite here: editing public/index.html is what must make
// these fail.
const PAGE = readFileSync(fileURLToPath(new URL('../public/index.html', import.meta.url)), 'utf8');

/**
 * The id the page ships with until someone pastes the real one in. It is shaped like a valid
 * measurement id ON PURPOSE — a regex alone would accept it — so the only thing that can tell the
 * two apart is this constant, and the test below that refuses it.
 *
 * A placeholder that reaches production is the failure this whole file is built around: gtag loads,
 * every request answers 200, the banner works, and the property stays empty forever. Nothing in a
 * status code or a deploy log says so. A red suite blocks the deploy (CLAUDE.md, "Commits"), which
 * is the intended behaviour rather than a nuisance.
 */
const PLACEHOLDER_ID = 'G-XXXXXXXXXX';

const CONSENT_KEY = 'onerate.consent';

/**
 * Parse the page with a fresh (optionally seeded) localStorage and report what it told Google.
 *
 * gtag.js is never fetched: jsdom loads no external script without `resources: 'usable'`, and the
 * real one is not wanted here anyway. What IS wanted is the command queue the inline snippet
 * builds, which is the whole of what this page controls — everything after `dataLayer.push` is
 * Google's code, and testing that would be testing Google.
 */
function render({ stored, locale = 'en-US' } = {}) {
  const store = new Map(stored ? [[CONSENT_KEY, stored]] : []);
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
  /** `gtag()` pushes its `arguments` object, not an array — normalize before asserting. */
  const commands = () => [...(dom.window.dataLayer ?? [])].map((entry) => [...entry]);
  const click = (el) => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  return {
    document,
    commands,
    click,
    banner: () => document.getElementById('consent'),
    /** Every `gtag('event', …)` name, in the order the page queued them. */
    events: () => commands().filter(([kind]) => kind === 'event').map(([, name]) => name),
    /** The parameters of the last event of that name. */
    paramsOf: (name) => {
      const hit = commands().filter(([kind, n]) => kind === 'event' && n === name).pop();
      return hit?.[2];
    },
    stored: () => store.get(CONSENT_KEY),
    close: () => dom.window.close(),
  };
}

const STATIC = new JSDOM(PAGE).window.document;

describe('the measurement id', () => {
  const configured = () => {
    const match = PAGE.match(/gtag\('config',\s*'([^']+)'\)/);
    return match?.[1];
  };

  it('is a GA4 measurement id', () => {
    expect(configured(), 'nothing on the page calls gtag config').toBeTruthy();
    expect(configured()).toMatch(/^G-[A-Z0-9]{10}$/);
  });

  it('is the owner’s, not the placeholder', () => {
    // Red until the real id lands. See PLACEHOLDER_ID above for why this is a test and not a TODO.
    expect(
      configured(),
      'public/index.html still ships the placeholder measurement id — paste the real G- id from ' +
        'GA4 Admin → Data streams'
    ).not.toBe(PLACEHOLDER_ID);
  });

  it('loads the tag for the SAME property it configures', () => {
    // Two ids in two places. A mismatch reports into a property nobody opens, and looks perfect
    // in the network tab.
    const loader = STATIC.querySelector('script[src*="googletagmanager.com/gtag/js"]');
    expect(loader, 'the gtag.js loader is missing').toBeTruthy();
    expect(new URL(loader.src).searchParams.get('id')).toBe(configured());
  });

  it('loads the tag asynchronously, so it cannot delay first paint', () => {
    const loader = STATIC.querySelector('script[src*="googletagmanager.com/gtag/js"]');
    expect(loader.hasAttribute('async')).toBe(true);
  });
});

describe('consent is denied until it is given', () => {
  /**
   * The ordering this suite exists for. `gtag('consent', 'default', …)` must be queued BEFORE the
   * `config` that starts measuring: reverse the two and GA treats the first hit as fully consented
   * and writes `_ga` before anyone was asked. Both orders look identical on screen, both pass every
   * other test in this repo, and only one of them is lawful in the five EU markets this page sells
   * into.
   */
  it('sets a default before it configures anything', () => {
    const page = render();
    const kinds = page.commands().map(([kind, target]) => `${kind}:${target}`);
    const firstDefault = kinds.indexOf('consent:default');
    const firstConfig = kinds.findIndex((entry) => entry.startsWith('config:'));

    expect(firstDefault, 'the page never sets a consent default').toBeGreaterThan(-1);
    expect(firstConfig, 'the page never configures GA').toBeGreaterThan(-1);
    expect(firstDefault, 'consent default is queued AFTER config').toBeLessThan(firstConfig);
    page.close();
  });

  it('denies all four Consent Mode v2 signals to a visitor who has not answered', () => {
    const page = render();
    const [, , signals] = page.commands().find(([kind, target]) => kind === 'consent' && target === 'default');
    // All four, not only `analytics_storage`: v2 added `ad_user_data` and `ad_personalization`,
    // and a signal left unset defaults to GRANTED.
    expect(signals).toMatchObject({
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
    });
    page.close();
  });

  it('never updates consent on its own', () => {
    const page = render();
    const updates = page.commands().filter(([kind, target]) => kind === 'consent' && target === 'update');
    expect(updates, 'the page granted consent nobody gave').toEqual([]);
    page.close();
  });
});

describe('the banner', () => {
  it('is hidden from a visitor who already answered, either way', () => {
    for (const answer of ['granted', 'denied']) {
      const page = render({ stored: answer });
      expect(page.banner().hidden, `the banner asks again after "${answer}"`).toBe(true);
      page.close();
    }
  });

  it('is shown to a visitor who has not', () => {
    const page = render();
    expect(page.banner().hidden).toBe(false);
    page.close();
  });

  it('is hidden in the MARKUP, so a reader with no JavaScript is not asked', () => {
    // With no script there is no gtag, nothing is collected, and there is nothing to consent to.
    // A banner that renders anyway would ask a question its own answer cannot change.
    expect(STATIC.getElementById('consent').hasAttribute('hidden')).toBe(true);
  });

  it('grants and remembers when the visitor allows', () => {
    const page = render();
    page.click(page.document.getElementById('consent-accept'));

    const updates = page.commands().filter(([kind, target]) => kind === 'consent' && target === 'update');
    expect(updates.length).toBe(1);
    // ONLY `analytics_storage`. The banner asks to count visits and says so in seven languages;
    // granting the two advertising signals as well would take more than was asked for, and this
    // property runs no ads to spend them on.
    expect(updates[0][2]).toEqual({ analytics_storage: 'granted' });
    expect(page.stored()).toBe('granted');
    expect(page.banner().hidden).toBe(true);
    page.close();
  });

  it('remembers a refusal too, and sends no update', () => {
    // A refusal that is not stored is a banner on every page view — the dark pattern of asking
    // until the visitor gives in.
    const page = render();
    page.click(page.document.getElementById('consent-decline'));

    expect(page.commands().filter(([kind, target]) => kind === 'consent' && target === 'update')).toEqual([]);
    expect(page.stored()).toBe('denied');
    expect(page.banner().hidden).toBe(true);
    page.close();
  });

  it('restores the grant on the next visit, before GA is configured', () => {
    const page = render({ stored: 'granted' });
    const kinds = page.commands().map(([kind, target]) => `${kind}:${target}`);
    const update = kinds.indexOf('consent:update');
    const config = kinds.findIndex((entry) => entry.startsWith('config:'));

    expect(update, 'a stored grant was not restored').toBeGreaterThan(-1);
    // After config, the first page_view has already gone out cookieless and the returning
    // visitor is counted as a new one on every single visit.
    expect(update, 'the stored grant is applied too late to count the page view').toBeLessThan(config);
    page.close();
  });
});

describe('the events worth having', () => {
  /**
   * This page IS the demand funnel (CLAUDE.md), and a page view alone cannot tell the owner which
   * end of it is leaking. Four events, each answering a question someone actually asks:
   *
   *   generate_lead    did the access mail get opened — the only conversion this page has
   *   portal_click     an existing customer passing through, which is NOT a lead
   *   docs_click       the reader who wanted to understand before writing
   *   language_select  which of the seven translations earn their keep (they cost seven each)
   *
   * Deliberately absent: the theme toggle and the comparison slider. No decision hangs on either.
   */
  it('counts an access-mail click as the conversion', () => {
    const page = render({ stored: 'granted' });
    page.click(page.document.querySelector('[data-mail-template]'));
    expect(page.events()).toContain('generate_lead');
    page.close();
  });

  it('tells the lead apart from a customer signing in', () => {
    const page = render({ stored: 'granted' });
    page.click(page.document.querySelector('a[href^="https://app.onerate.travel"]'));
    expect(page.events()).toContain('portal_click');
    expect(page.events()).not.toContain('generate_lead');
    page.close();
  });

  it('counts a docs click', () => {
    const page = render({ stored: 'granted' });
    page.click(page.document.querySelector('a[href^="https://docs.onerate.travel"]'));
    expect(page.events()).toContain('docs_click');
    page.close();
  });

  it('records which language a visitor chose, in the event itself', () => {
    // The page is one URL in seven languages, so GA's own `language` dimension reports the
    // BROWSER's setting and never the choice. Without this parameter, "should we keep Hungarian?"
    // has no answer in the property at all.
    const page = render({ stored: 'granted' });
    const select = page.document.getElementById('lang');
    select.value = 'hu';
    select.dispatchEvent(new page.document.defaultView.Event('change', { bubbles: true }));

    expect(page.events()).toContain('language_select');
    expect(page.paramsOf('language_select')).toMatchObject({ language: 'hu' });
    page.close();
  });

  it('still queues its events when consent was refused', () => {
    // Consent Mode's own design: the events keep flowing, cookieless and without an identifier.
    // Dropping them here as well would throw away the aggregate the denied mode exists to preserve
    // — and would do it silently, since a missing event looks exactly like an event nobody fired.
    const page = render({ stored: 'denied' });
    page.click(page.document.querySelector('[data-mail-template]'));
    expect(page.events()).toContain('generate_lead');
    page.close();
  });
});
