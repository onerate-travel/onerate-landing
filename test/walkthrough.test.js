import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

// The *shipped* page, like every other suite here: editing public/index.html is what must make
// these fail.
const PAGE = readFileSync(fileURLToPath(new URL('../public/index.html', import.meta.url)), 'utf8');

/**
 * The suite for the shape the page took on when it stopped being a column of prose and became a
 * WALKTHROUGH: four steps that scroll past a screen which is pinned beside them and redraws itself
 * at each one.
 *
 * Everything below exists because that shape has one failure mode the rest of this repo's tests
 * cannot see. The page's whole argument is carried by copy — seven languages of it, guarded to the
 * key — and the walkthrough adds a second channel that carries no copy at all: a drawn screen whose
 * STATE is the sentence. A beat that stops changing is a page that still reads correctly, still
 * translates correctly, still deploys, and no longer shows anybody anything.
 *
 * The other half is the reader the effect must not cost anything: no JavaScript, no
 * IntersectionObserver, or a stated preference for less motion. Every animation here is opt-IN
 * from a hidden state, and a hidden state whose reveal never fires is a blank page. That is the
 * one bug an animated landing page can ship that looks, in every screenshot, exactly like success.
 */

/**
 * Render the page with an IntersectionObserver that reports to the test instead of to a layout.
 *
 * jsdom implements no IntersectionObserver at all, which is useful twice: the stub below is the
 * only way to drive the walkthrough, and its ABSENCE — `render({ observer: false })` — is a
 * faithful rehearsal of a browser too old to have one.
 */
function render({ observer = true, locale = 'en-US' } = {}) {
  const observers = [];
  const store = new Map();
  const dom = new JSDOM(PAGE, {
    runScripts: 'dangerously',
    beforeParse(window) {
      Object.defineProperty(window.navigator, 'language', { value: locale, configurable: true });
      // A real store, because the page writes to it and Safari-in-private-mode is already handled
      // by the page's own try/catch — what is being exercised here is the observer, not storage.
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: {
          getItem: (key) => (store.has(key) ? store.get(key) : null),
          setItem: (key, value) => store.set(key, String(value)),
          removeItem: (key) => store.delete(key),
        },
      });
      if (!observer) return;
      window.IntersectionObserver = class {
        constructor(callback, options) {
          this.callback = callback;
          this.options = options || {};
          this.targets = [];
          observers.push(this);
        }
        observe(element) {
          this.targets.push(element);
        }
        unobserve(element) {
          this.targets = this.targets.filter((target) => target !== element);
        }
        disconnect() {
          this.targets = [];
        }
      };
    },
  });
  const { document } = dom.window;
  /** The observer watching a given element — the page installs more than one. */
  const watching = (element) => observers.find((each) => each.targets.includes(element));
  /** Report a set of [element, isIntersecting] pairs to whichever observer is watching them. */
  const cross = (pairs) => {
    const [[first]] = pairs;
    const target = watching(first);
    expect(target, 'nothing is observing that element').toBeTruthy();
    target.callback(
      pairs.map(([element, isIntersecting]) => ({
        target: element,
        isIntersecting,
        intersectionRatio: isIntersecting ? 1 : 0,
      })),
      target
    );
  };
  return {
    document,
    observers,
    watching,
    cross,
    steps: () => [...document.querySelectorAll('.walk-step')],
    stage: () => document.getElementById('stage'),
    beat: () => document.getElementById('stage').getAttribute('data-beat'),
    close: () => dom.window.close(),
  };
}

const STATIC = new JSDOM(PAGE).window.document;
const rules = [...STATIC.styleSheets[0].cssRules];
const isStyleRule = (rule) => rule.constructor.name === 'CSSStyleRule';
const selectorOf = (rule) => rule.selectorText.replace(/\s+/g, ' ').trim();
const ruleFor = (selector) => rules.filter(isStyleRule).find((r) => selectorOf(r) === selector);

describe('the walkthrough a reader scrolls through', () => {
  const steps = [...STATIC.querySelectorAll('.walk-step')];

  it('is four beats, and every one of them is a step the page already translates', () => {
    /**
     * The budget this section was built under, asserted rather than remembered: a scroll narrative
     * is worth having only if it costs no new sentences, because every sentence on this page is
     * seven sentences (CLAUDE.md, "Language conventions"). The steps were already written and
     * already translated; the walkthrough gives them a picture, not a rewrite.
     */
    expect(steps).toHaveLength(4);
    const keys = steps.flatMap((step) =>
      [...step.querySelectorAll('[data-i18n]')].map((el) => el.getAttribute('data-i18n'))
    );
    expect(keys).toEqual([
      'step1Title', 'step1Body',
      'step2Title', 'step2Body',
      'step3Title', 'step3Body',
      'step4Title', 'step4Body',
    ]);
  });

  it('pins the screen while the steps scroll past it', () => {
    // The whole mechanism. Without `sticky` the canvas scrolls away with its first step and the
    // other three redraw a screen nobody is looking at any more.
    expect(ruleFor('.walk-canvas').style.getPropertyValue('position')).toBe('sticky');
  });

  it('ships already showing its first beat, so a reader with no script gets a screen', () => {
    // An empty frame that fills in on scroll is the naive form of this, and it is the same bug as
    // an empty <p> filled in by a dictionary: with no JavaScript it is a box of nothing.
    expect(STATIC.getElementById('stage').getAttribute('data-beat')).toBe('1');
  });

  it('keeps the argument in the text and the screen decorative', () => {
    /**
     * The drawn screen says what the step says, in a second channel. To a screen reader that is
     * not emphasis, it is the same sentence twice — once as prose and once as a pile of prices
     * with no sentence in them at all. The steps are the accessible copy; the canvas is a picture
     * of them.
     */
    const stage = STATIC.getElementById('stage');
    expect(stage.getAttribute('aria-hidden')).toBe('true');
    for (const step of steps) expect(stage.contains(step)).toBe(false);
  });

  it('numbers its beats to match the steps, so the two cannot drift apart', () => {
    expect(steps.map((step) => step.getAttribute('data-beat-step'))).toEqual(['1', '2', '3', '4']);
  });
});

describe('scrolling moves the screen', () => {
  it('redraws the screen at the step the reader has reached', () => {
    const page = render();
    const steps = page.steps();
    page.cross([[steps[2], true]]);
    expect(page.beat()).toBe('3');
    page.close();
  });

  it('rebuilds its viewport-height band after a resize, below the mobile screen', () => {
    const page = render();
    const win = page.document.defaultView;
    const first = page.watching(page.steps()[0]);
    expect(first.options.rootMargin).toBe('-307px 0px -384px 0px');
    win.innerWidth = 390;
    win.innerHeight = 844;
    win.dispatchEvent(new win.Event('resize'));
    expect(first.targets).toHaveLength(0);
    expect(page.watching(page.steps()[0]).options.rootMargin).toBe('-591px 0px -169px 0px');
    page.cross([[page.steps()[2], true]]);
    expect(page.beat()).toBe('3');
    page.close();
  });

  it('marks the step that is being read, so the others can recede', () => {
    const page = render();
    const steps = page.steps();
    page.cross([[steps[1], true]]);
    expect(steps.map((step) => step.classList.contains('is-active'))).toEqual([
      false, true, false, false,
    ]);
    page.close();
  });

  it('keeps the chapter links in sync when scrolling forward and backward', () => {
    const page = render();
    const links = [...page.document.querySelectorAll('.walk-chapters a')];
    expect(links).toHaveLength(4);
    links.forEach((link, index) => {
      expect(page.document.querySelector(link.getAttribute('href'))).toBe(page.steps()[index]);
    });
    for (const index of [3, 1, 0]) {
      page.cross(page.steps().map((step, at) => [step, at === index]));
      expect(links.map((link) => link.getAttribute('aria-current'))).toEqual(
        links.map((_, at) => at === index ? 'step' : null)
      );
    }
    page.close();
  });

  it('holds the last beat it reached rather than resetting between two steps', () => {
    // The band the observer watches is a slice across the middle of the viewport, and between two
    // steps NOTHING is in it. Falling back to beat one there would make the screen flicker back to
    // the start every time the reader crossed a gap.
    const page = render();
    const steps = page.steps();
    page.cross([[steps[2], true]]);
    page.cross([[steps[2], false]]);
    expect(page.beat()).toBe('3');
    page.close();
  });

  it('follows the reader down when two steps are in the band at once', () => {
    // Scrolling down, the step being entered is the one being read.
    const page = render();
    const steps = page.steps();
    page.cross([[steps[0], true], [steps[1], true]]);
    expect(page.beat()).toBe('2');
    page.close();
  });

  it('marks the steps already behind the reader, so the spine reads as progress', () => {
    /**
     * `is-active` alone cannot draw a progress spine: it says where the reader IS and nothing about
     * where they have been, so the filled segment would jump from step to step instead of growing.
     * Two classes, and the second one is what makes the rail a measure of the section rather than a
     * decoration on one step of it.
     */
    const page = render();
    const steps = page.steps();
    page.cross([[steps[2], true]]);
    expect(steps.map((step) => step.classList.contains('is-past'))).toEqual([
      true, true, false, false,
    ]);
    page.close();
  });

  it('takes that mark back when the reader scrolls up again', () => {
    // The spine has to run backwards as readily as forwards; a rail that only ever fills is a rail
    // that lies the moment somebody scrolls up to re-read a step.
    const page = render();
    const steps = page.steps();
    page.cross([[steps[3], true]]);
    page.cross([[steps[3], false], [steps[0], true]]);
    expect(steps.map((step) => step.classList.contains('is-past'))).toEqual([
      false, false, false, false,
    ]);
    page.close();
  });

  it('draws no spine at all until the observer is running', () => {
    // Same rule as the dimming below, one decoration further out: a rail with nothing on it, for
    // ever, is worse than no rail — it reads as a progress bar that is broken.
    const spine = rules
      .filter(isStyleRule)
      .filter((rule) => selectorOf(rule).includes('.walk-step::'));
    expect(spine.length, 'there is no spine').toBeGreaterThan(0);
    expect(
      spine.map(selectorOf).filter((selector) => !selector.includes('[data-live]')),
      'these draw a rail a reader with no observer can never fill'
    ).toEqual([]);
  });

  it('never dims a step until the observer is actually running', () => {
    /**
     * The receding of the inactive steps is the effect's cost centre: it is the one rule that can
     * leave real, translated copy at reduced contrast for a reader whose browser never fires the
     * callback that would bring it back. So it hangs off `data-live`, which the script writes only
     * once it has installed the observer — and the markup ships without it.
     */
    expect(STATIC.getElementById('walk').hasAttribute('data-live')).toBe(false);
    const dimmers = rules
      .filter(isStyleRule)
      .filter((rule) => selectorOf(rule).includes('.walk-step'))
      .filter((rule) => {
        const opacity = rule.style.getPropertyValue('opacity');
        return opacity !== '' && opacity !== '1';
      });
    expect(dimmers.length, 'nothing recedes at all — the effect is not there').toBeGreaterThan(0);
    expect(
      dimmers.map(selectorOf).filter((selector) => !selector.includes('[data-live]')),
      'these dim a step without waiting for the observer to exist'
    ).toEqual([]);
    const live = render();
    expect(live.document.getElementById('walk').hasAttribute('data-live')).toBe(true);
    live.close();
  });
});

describe('the reveal that carries the rest of the page', () => {
  it('has something to reveal', () => {
    expect([...STATIC.querySelectorAll('[data-reveal]')].length).toBeGreaterThan(4);
  });

  it('hides nothing before the script has said it can put it back', () => {
    /**
     * The bug an animated page ships that every screenshot calls success: `opacity: 0` in the
     * stylesheet, `opacity: 1` from a callback that a given browser never makes. The hidden state
     * is therefore written under a class the HEAD script adds, and adds only where the observer
     * that undoes it exists.
     */
    expect(STATIC.documentElement.className).not.toContain('js-reveal');
    const hiders = rules
      .filter(isStyleRule)
      .filter((rule) => selectorOf(rule).includes('[data-reveal]'))
      .filter((rule) => rule.style.getPropertyValue('opacity') === '0');
    expect(hiders.length, 'nothing is revealed at all — the effect is not there').toBeGreaterThan(0);
    expect(
      hiders.map(selectorOf).filter((selector) => !selector.startsWith('.js-reveal')),
      'these hide content for a reader whose browser cannot reveal it'
    ).toEqual([]);
  });

  it('arms the hidden state before first paint, not after it', () => {
    // Added at the end of the body, the class would land after the page had already been painted
    // with everything visible — a flash of the finished page, then the animation of it arriving.
    const head = PAGE.slice(0, PAGE.indexOf('</head>'));
    expect(head).toContain('js-reveal');
  });

  it('reveals an element when it comes into view, and then stops watching it', () => {
    const page = render();
    const card = page.document.querySelector('.card[data-reveal]');
    expect(card, 'the feature cards do not take part in the reveal').toBeTruthy();
    page.cross([[card, true]]);
    expect(card.classList.contains('is-in')).toBe(true);
    expect(page.watching(card), 'a revealed element is still being observed').toBeUndefined();
    page.close();
  });
});

describe('a browser with no IntersectionObserver', () => {
  /**
   * Not a hypothetical: this page sells into six EU markets and Türkiye, where an agency's back
   * office is as likely to be a decade-old desktop as a new laptop. The rule the whole file turns
   * on is that the walkthrough is an ENHANCEMENT — the steps are readable prose either way.
   */
  it('gets the whole page, with nothing hidden and nothing thrown', () => {
    const page = render({ observer: false });
    expect(page.steps()).toHaveLength(4);
    expect(page.beat()).toBe('1');
    expect(page.document.documentElement.className).not.toContain('js-reveal');
    expect(page.document.getElementById('walk').hasAttribute('data-live')).toBe(false);
    page.close();
  });

  it('still runs every line of script that comes after the walkthrough', () => {
    /**
     * A bare `new IntersectionObserver(...)` throws a ReferenceError, and the script is one IIFE:
     * everything below the throw — the consent banner, and the language the page renders in —
     * simply never happens. The banner is the canary because it is the LAST block in the file.
     */
    const page = render({ observer: false, locale: 'tr-TR' });
    expect(page.document.documentElement.lang).toBe('tr');
    expect(page.document.getElementById('consent').hidden).toBe(false);
    page.close();
  });
});
