import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import {
  FAVICON_TOKENS,
  PAGE_TOKENS,
  UPSTREAM_PATH,
  readUpstreamTokens,
  upstreamIsCheckedOut,
} from './design-system.js';

// The *shipped* page, for the same reason the other two suites read it.
const PAGE = readFileSync(fileURLToPath(new URL('../public/index.html', import.meta.url)), 'utf8');
const FAVICON = readFileSync(fileURLToPath(new URL('../public/favicon.svg', import.meta.url)), 'utf8');

const dom = new JSDOM(PAGE);
const doc = dom.window.document;
const sheet = doc.styleSheets[0];
const rules = [...sheet.cssRules];

const isStyleRule = (rule) => rule.constructor.name === 'CSSStyleRule';
/** `selectorText` keeps the source's line breaks; a selector is one line for comparison. */
const selectorOf = (rule) => rule.selectorText.replace(/\s+/g, ' ').trim();
const ruleFor = (selector) => rules.filter(isStyleRule).find((r) => selectorOf(r) === selector);
/** jsdom's CSSStyleDeclaration is indexed but neither iterable nor equipped with `item()`. */
const propertyNames = (style) => Array.from({ length: style.length }, (_, i) => style[i]);
const declarationsOf = (rule) =>
  propertyNames(rule.style).map((name) => [name, rule.style.getPropertyValue(name)]);

const ROOT = ruleFor(':root');
const REDUCED_MOTION = rules.find(
  (rule) => rule.constructor.name === 'CSSMediaRule' && rule.conditionText.includes('prefers-reduced-motion')
);
const FONT_FACES = rules.filter((rule) => rule.constructor.name === 'CSSFontFaceRule');
const PAINTING_RULES = rules.filter(isStyleRule).filter((rule) => selectorOf(rule) !== ':root');

/**
 * This suite is the thing the landing page has never had. Its 33 existing tests are all about
 * language, and they are good ones — but every finding a design review raised here (a blue accent
 * in front of a teal product, a page that cut off its own top, a 27px control the product holds to
 * 40, a document with no heading in it) passed all 33 without a murmur.
 */
describe('the brand this page copies from @onerate/ui', () => {
  it('declares every copied value under the design system’s own name', () => {
    // Under its own NAME, which is half the point: this page used to call #5b8cff `--accent`, and
    // `--accent` is the exact name whose undefined reads painted the wrong teal across the product
    // (tokens.css:5-11). One word, three meanings, two repositories.
    for (const [name, value] of Object.entries(PAGE_TOKENS)) {
      expect(ROOT.style.getPropertyValue(name).trim(), `:root is missing ${name}`).toBe(value);
    }
  });

  it('spends every token it declares, and declares every token it spends', () => {
    // Both directions, because each catches a different rot. A token nothing reads is a second
    // place a reader has to look; a `var()` nothing defines renders from a FALLBACK, which is a
    // definition written where nobody looks for one. The admin panel's guard asks only the second
    // question and that is how ~55 dead lines survived in its sheet.
    const declared = propertyNames(ROOT.style).filter((name) => name.startsWith('--'));
    const read = new Set([...PAGE.matchAll(/var\((--[\w-]+)/g)].map(([, name]) => name));

    expect(declared.filter((name) => !read.has(name)), 'declared and never read').toEqual([]);
    expect(
      [...read].filter((name) => !declared.includes(name)),
      'read and never declared — these render from a fallback'
    ).toEqual([]);
  });

  it('never writes a colour anywhere but :root', () => {
    // The design system's own rule (tokens.css:1-3), which is why the glow and the button shadow
    // are `color-mix(… var(--teal) …)` rather than the same teal spelled out in channels.
    const literal = /#[0-9a-f]{3,8}\b|\brgba?\(/i;
    const offenders = PAINTING_RULES.flatMap((rule) =>
      declarationsOf(rule)
        .filter(([, value]) => literal.test(value))
        .map(([name]) => `${selectorOf(rule)} { ${name} }`)
    );
    expect(offenders).toEqual([]);
  });

  it('pins the one colour that cannot be a var(): the switcher’s chevron', () => {
    // A data URI is a separate document and `var()` does not cross into it, so the arrow's stroke
    // is a second copy of `--muted` by necessity. Asserted rather than tolerated.
    const muted = ROOT.style.getPropertyValue('--muted').trim();
    const chevron = ruleFor('.langs select').style.getPropertyValue('background-image');
    expect(chevron).toContain(`stroke='%23${muted.slice(1)}'`);
  });

  it.skipIf(!upstreamIsCheckedOut())(
    'still agrees with tokens.css, when onerate-ui is checked out beside this repo',
    () => {
      // The drift half. It is skipped rather than absent in CI — see test/design-system.js for why
      // that is the honest shape and what would have to change to close it.
      const upstream = readUpstreamTokens();
      const drifted = Object.entries(PAGE_TOKENS)
        .filter(([name, value]) => upstream.resolve(name) !== value)
        .map(([name, value]) => `${name}: ${value} here, ${upstream.resolve(name)} in ${UPSTREAM_PATH}`);
      expect(drifted).toEqual([]);
    }
  );
});

describe('the mark', () => {
  it('is the product’s ring, not an emoji', () => {
    const icon = doc.querySelector('link[rel="icon"]');
    expect(icon?.getAttribute('href')).toBe('/favicon.svg');
    expect(FAVICON).toContain('<circle');
  });

  it('is drawn in design-system colours', () => {
    expect(FAVICON).toContain(`fill="${FAVICON_TOKENS['--paper']}"`);
    expect(FAVICON).toContain(`stroke="${FAVICON_TOKENS['--teal']}"`);
  });

  it.skipIf(!upstreamIsCheckedOut())('takes those two from the light palette, unchanged', () => {
    const { light } = readUpstreamTokens();
    expect(light['--paper']).toBe(FAVICON_TOKENS['--paper']);
    expect(light['--teal']).toBe(FAVICON_TOKENS['--teal']);
  });
});

describe('the faces it declares are the faces it ships', () => {
  /**
   * The guard that makes copying the type stack worth doing. Naming `'Inter Variable'` in a
   * `--font-ui` that no `@font-face` backs is a page that renders in system-ui while every test
   * about token parity passes — existence answered, fitness unasked. That is precisely the gap the
   * admin panel's three green guards left open, one repo over.
   */
  const families = ['--font-display', '--font-ui'].flatMap((token) =>
    ROOT.style
      .getPropertyValue(token)
      .split(',')
      .map((part) => part.trim().replace(/^['"]|['"]$/g, ''))
      // The tail of every stack is a keyword the platform resolves itself.
      .filter((family) => family && !['system-ui', 'sans-serif', 'serif', 'monospace'].includes(family))
  );

  it('has faces and families to check', () => {
    // Never vacuous, the rule bilingual.test.js already works to: a page that stopped declaring a
    // type stack, or stopped shipping a font, would otherwise sail through every assertion below
    // over an empty set — which is the exact failure this whole describe exists to catch.
    expect(families).toEqual(expect.arrayContaining(['Space Grotesk Variable', 'Inter Variable']));
    expect(FONT_FACES.length).toBeGreaterThan(0);
  });

  it.each(families)('%s is either loaded here or a fallback for one that is', (family) => {
    const loaded = FONT_FACES.some(
      (face) => face.style.getPropertyValue('font-family').replace(/['"]/g, '').trim() === family
    );
    // `'Space Grotesk'` and `'Inter'` are the non-variable names, listed so a visitor who has the
    // family installed uses it; only the Variable names are shipped.
    const coveredByVariable = families.includes(`${family} Variable`);
    expect(loaded || coveredByVariable, `${family} is named but neither shipped nor a fallback`).toBe(true);
  });

  it.each(FONT_FACES.map((face) => face.style.getPropertyValue('src')))(
    'ships the file behind %s',
    (src) => {
      const [, url] = src.match(/url\(([^)]+)\)/);
      const file = new URL(`../public${url.replace(/['"]/g, '')}`, import.meta.url);
      expect(existsSync(fileURLToPath(file)), `${url} is declared and not in public/`).toBe(true);
    }
  );

  it('gives every face a unicode-range, so a language never asks for a file without its glyphs', () => {
    // Space Grotesk has no Cyrillic at all. Without the range the browser would still try it for a
    // Bulgarian heading; with it, the heading falls straight through to Inter — which is what the
    // portal's own headings do.
    for (const face of FONT_FACES) {
      expect(face.cssText, `${face.style.getPropertyValue('src')} has no unicode-range`).toContain(
        'unicode-range'
      );
    }
  });
});

describe('the layout can outgrow the viewport', () => {
  /**
   * The bug this suite exists for, and the one that had to be fixed before the page could grow an
   * access-request form: `html, body { height: 100% }` plus `place-items: center` centred the
   * content inside a box pinned to the viewport, so content taller than it overflowed in BOTH
   * directions — and no amount of scrolling reaches the half above the top.
   */
  it('never pins its height to the viewport', () => {
    for (const selector of ['html', 'body', 'main']) {
      const rule = ruleFor(selector);
      if (!rule) continue;
      expect(rule.style.getPropertyValue('height'), `${selector} sets a fixed height`).toBe('');
    }
    expect(ruleFor('body').style.getPropertyValue('min-height')).toMatch(/^100(dvh|vh)$/);
  });

  it('centres with auto margins, which collapse under overflow instead of cutting', () => {
    const body = ruleFor('body');
    expect(body.style.getPropertyValue('place-items')).toBe('');
    expect(body.style.getPropertyValue('justify-content')).toBe('');
    expect(ruleFor('main').style.getPropertyValue('margin')).toBe('auto');
  });

  it('keeps the language switcher in the flow, off the content’s layer', () => {
    // Fixed, it drew on top of a vertically centred <main> on a short viewport — a phone held
    // sideways is 375px tall.
    expect(ruleFor('.langs').style.getPropertyValue('position')).toBe('');
  });
});

describe('motion', () => {
  const movers = PAINTING_RULES.filter((rule) => rule.style.getPropertyValue('transform'));

  it('answers a reduced-motion preference at all', () => {
    expect(REDUCED_MOTION, 'the page has no prefers-reduced-motion block').toBeTruthy();
    const universal = [...REDUCED_MOTION.cssRules].find((rule) => selectorOf(rule).startsWith('*'));
    expect(universal.style.getPropertyValue('transition-duration')).toMatch(/^0\.01ms/);
  });

  it('stops every element it moves, rather than only shortening the move', () => {
    // A `transform` at a 0.01ms duration still JUMPS. Killing the duration is not killing the
    // movement, which is what the preference asks for.
    const stopped = [...REDUCED_MOTION.cssRules]
      .filter((rule) => rule.style.getPropertyValue('transform') === 'none')
      .flatMap((rule) => selectorOf(rule).split(',').map((part) => part.trim()));

    expect(movers.length).toBeGreaterThan(0);
    expect(
      movers.map(selectorOf).filter((selector) => !stopped.includes(selector)),
      'these move and are not stopped under prefers-reduced-motion'
    ).toEqual([]);
  });
});

describe('the document a screen reader walks', () => {
  it('has exactly one h1, and it is what the page is ABOUT', () => {
    const headings = [...doc.querySelectorAll('h1, h2, h3, h4, h5, h6')];
    const h1s = headings.filter((el) => el.tagName === 'H1');
    expect(h1s).toHaveLength(1);
    // Translated like every other string, which is only true if it carries a key — and carrying one
    // is what puts it under bilingual.test.js's seven-language parity check as well.
    expect(h1s[0].getAttribute('data-i18n')).toBeTruthy();
  });

  it('never skips a heading level', () => {
    const levels = [...doc.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((el) =>
      Number(el.tagName.slice(1))
    );
    // A page with no headings at all skips no level; it also has no outline. Start at h1.
    expect(levels[0]).toBe(1);
    levels.reduce((previous, level) => {
      expect(level, `h${previous} is followed by h${level}`).toBeLessThanOrEqual(previous + 1);
      return level;
    }, 0);
  });

  it('puts its contentinfo where it counts as one', () => {
    // A <footer> inside <main> is main's footer and carries no landmark at all.
    const footer = doc.querySelector('footer');
    expect(footer).toBeTruthy();
    expect(footer.closest('main'), '<footer> is nested inside <main>').toBeNull();
    expect(footer.querySelectorAll('p.foot')).toHaveLength(2);
  });

  it('tells the screen reader which language each endonym is in', () => {
    // The endonyms are deliberate (a Polish visitor looks for "Polski"), and they are exactly why
    // this attribute is needed: "Български" under <html lang="en"> is read with an English phoneme
    // table. WCAG 3.1.2.
    for (const option of doc.querySelectorAll('#lang option')) {
      expect(option.getAttribute('lang'), `<option value="${option.value}"> has no lang`).toBe(
        option.value
      );
    }
  });
});

describe('touch targets', () => {
  it('holds the language switcher to the same floor the portal holds it to', () => {
    // 40px is `--touch`, the fleet's own baseline (tokens.css:192-197) rather than WCAG's 24px.
    // The identical control is tested against it in onerate-ui/src/rhythm.test.tsx:98; this page
    // gave it 6px of padding around 13px type, about 27px.
    expect(ruleFor('.langs select').style.getPropertyValue('min-height')).toBe('var(--touch)');
    expect(PAGE_TOKENS['--touch']).toBe('40px');
  });
});
