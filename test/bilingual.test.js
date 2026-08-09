import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

// The *shipped* page, for the same reason lang.test.js reads it: editing public/index.html is what
// must make these fail.
const PAGE = readFileSync(fileURLToPath(new URL('../public/index.html', import.meta.url)), 'utf8');
const doc = new JSDOM(PAGE).window.document;

/**
 * CLAUDE.md states the rule this file enforces: "A `data-en` span without its `data-tr` sibling
 * ships a half-translated page. Keep them in sync." Until now nothing checked it — the page's only
 * test covered which language is CHOSEN, not whether the chosen one has anything to show.
 *
 * The failure mode is silent and specific: `[data-tr] { display: none }` plus
 * `html[lang="tr"] [data-en] { display: none }` means an unpaired `data-en` span renders as
 * NOTHING for a Turkish visitor. Not English, not a warning — a gap where a sentence was. That is
 * exactly what a reviewer's eye skips, because the page still looks fine in the language they are
 * reading it in.
 */
describe('every translatable string is paired', () => {
  // Pairs live as adjacent spans inside one parent. Checking counts per parent catches both the
  // missing translation and the orphaned one, without asserting on document order.
  const parentsOf = (selector) => new Set([...doc.querySelectorAll(selector)].map((el) => el.parentElement));

  it('has at least one pair to check', () => {
    expect(doc.querySelectorAll('[data-en]').length).toBeGreaterThan(0);
  });

  it('gives every data-en span a data-tr sibling, and vice versa', () => {
    const unpaired = [];
    for (const parent of new Set([...parentsOf('[data-en]'), ...parentsOf('[data-tr]')])) {
      const en = parent.querySelectorAll(':scope > [data-en]').length;
      const tr = parent.querySelectorAll(':scope > [data-tr]').length;
      if (en !== tr) unpaired.push(`<${parent.tagName.toLowerCase()} class="${parent.className}">: ${en} en, ${tr} tr`);
    }
    expect(unpaired).toEqual([]);
  });

  it('leaves no translatable span empty', () => {
    // A paired-but-blank span passes the count check above and still ships a gap.
    const blank = [...doc.querySelectorAll('[data-en], [data-tr]')]
      .filter((el) => el.textContent.trim() === '')
      .map((el) => el.outerHTML);
    expect(blank).toEqual([]);
  });
});

describe('the outbound links', () => {
  const hrefs = () => [...doc.querySelectorAll('a')].map((a) => a.getAttribute('href'));

  it('offers the portal', () => {
    expect(hrefs()).toContain('https://app.onerate.travel');
  });

  it('offers the documentation', () => {
    // The reader who is not ready to sign in has, until now, had nowhere to go but an email
    // address. docs.onerate.travel is the answer to "what is this and how does it work".
    expect(hrefs()).toContain('https://docs.onerate.travel');
  });
});
