import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The design system's values, written down once, outside `public/index.html`.
 *
 * This file is the price of a decision recorded in CLAUDE.md: this repo has no build step, so it
 * cannot import `@onerate/ui`'s `tokens.css` the way the two applications do. It copies the values
 * instead — and a copy with nothing watching it is exactly how the landing page came to be a blue
 * page in front of a teal product. So the copy lives HERE rather than only in the page, and
 * `design.test.js` compares it in two directions:
 *
 *   index.html  ←→  this file        always, in every run, including CI
 *   this file   ←→  tokens.css       whenever `onerate-ui` is checked out beside this repo
 *
 * The second direction is the one that catches DRIFT, and it is honest about when it cannot run:
 * `onerate-landing` is a standalone repository and CI checks out nothing else, so that test reports
 * itself skipped rather than passing vacuously. What CI still guards is that nobody edits a hex in
 * the page by hand — which is the failure this repo can actually cause on its own. Drift starts in
 * `onerate-ui`, and the guard that would catch it AT THE SOURCE has to live there; see
 * `teams/tasarim/uygulama-landing.md`.
 */

/**
 * The design system's values the page copies, now in BOTH palettes.
 *
 * It used to be one flat map, and it could be: the page had a single theme and `:root` held the
 * dark answer to every role. The page follows `prefers-color-scheme` now and takes an override, so
 * a role has two answers and the file has to say which is which — `light` is what `:root` declares
 * and `dark` is what the two dark blocks re-declare.
 *
 * Only COLOUR roles appear under `dark`. The scale, the radius, the touch floor and the type stack
 * are not opinions about light, which is the same split `tokens.css` makes and the same sentence it
 * uses to explain it.
 */
export const PAGE_TOKENS = {
  light: {
    '--teal': '#0e6b5c',
    '--teal-text': '#0a5347',
    '--teal-on-ink': '#7fd0be',
    '--on-accent': '#ffffff',
    '--focus': '#2f7cf6',
    '--font-display': "'Space Grotesk Variable', 'Space Grotesk', sans-serif",
    '--font-ui': "'Inter Variable', 'Inter', system-ui, sans-serif",
    '--text-sm': '12px',
    '--text-md': '13px',
    '--radius': '10px',
    '--space-2': '8px',
    '--space-3': '12px',
    '--space-4': '16px',
    '--space-5': '24px',
    '--space-6': '32px',
    '--space-7': '48px',
    '--touch': '40px',
  },
  dark: {
    '--teal': '#127a68',
    '--teal-text': '#5fd6bb',
    // The one role that is the SAME in both, and `tokens.css` repeats it in its dark block rather
    // than omitting it, so that a reader of either palette sees it stated. Copied the same way.
    '--teal-on-ink': '#7fd0be',
    '--on-accent': '#ffffff',
    '--focus': '#5b9bff',
  },
};

/**
 * The page's own ground — NOT the design system, and deliberately so, but it has two palettes now
 * for the same reason the brand does. It is pinned here because a page that reads its own `--fg`
 * from a block that forgot to declare it renders from a FALLBACK, and a fallback is a definition
 * written where nobody looks for one.
 */
export const GROUND_TOKENS = {
  light: {
    '--bg': '#f7f6f2',
    '--panel': 'rgba(16, 26, 43, 0.04)',
    '--panel-lift': 'rgba(16, 26, 43, 0.06)',
    '--fg': '#101a2b',
    '--muted': '#5b6478',
    '--border': 'rgba(16, 26, 43, 0.14)',
    '--border-soft': 'rgba(16, 26, 43, 0.08)',
  },
  dark: {
    '--bg': '#0b1020',
    '--panel': 'rgba(255, 255, 255, 0.04)',
    '--panel-lift': 'rgba(255, 255, 255, 0.07)',
    '--fg': '#eef2ff',
    '--muted': '#9aa4bf',
    '--border': 'rgba(255, 255, 255, 0.1)',
    '--border-soft': 'rgba(255, 255, 255, 0.06)',
  },
};

/**
 * The favicon's two colours, and they come from the LIGHT palette on purpose: a favicon is drawn in
 * the browser's chrome, which has a theme of its own that the page never learns. See
 * `public/favicon.svg` for why the plate is paper and the ring is the brand.
 */
export const FAVICON_TOKENS = {
  '--paper': '#f7f6f2',
  '--teal': '#0e6b5c',
};

/**
 * The palette the illustrated portal screen is drawn in — BOTH themes, at once, on a page that has
 * only one.
 *
 * The screenshot section shows the product in light and in dark side by side, which is the one
 * place on this page where `@onerate/ui`'s two palettes have to coexist. A role name can only mean
 * one colour per document, so the page cannot say `--paper` twice; it says `--shot-light-paper` and
 * `--shot-dark-paper` and this map is what keeps both halves honest — each entry names the theme
 * and the ROLE it was copied from, so `design.test.js` can resolve it against `tokens.css` exactly
 * the way it resolves the brand tokens above.
 *
 * Without this the illustration would be fourteen hand-typed hexes claiming to be the product, and
 * "a copy with nothing watching it" is the sentence at the top of this file.
 */
export const SHOT_TOKENS = {
  '--shot-light-paper': ['light', '--paper', '#f7f6f2'],
  '--shot-light-card': ['light', '--paper-card', '#ffffff'],
  '--shot-light-line': ['light', '--line', '#e4e1d8'],
  '--shot-light-text': ['light', '--text', '#1b2333'],
  '--shot-light-text-soft': ['light', '--text-soft', '#5b6478'],
  '--shot-light-teal': ['light', '--teal', '#0e6b5c'],
  '--shot-light-teal-tint': ['light', '--teal-tint', '#e3f1ec'],
  '--shot-light-sunken': ['light', '--paper-sunken', '#edeae1'],
  '--shot-dark-paper': ['dark', '--paper', '#0f1521'],
  '--shot-dark-card': ['dark', '--paper-card', '#161d2b'],
  '--shot-dark-line': ['dark', '--line', '#273044'],
  '--shot-dark-text': ['dark', '--text', '#e4e8f0'],
  '--shot-dark-text-soft': ['dark', '--text-soft', '#aab3c4'],
  '--shot-dark-teal': ['dark', '--teal', '#127a68'],
  '--shot-dark-teal-tint': ['dark', '--teal-tint', '#12302a'],
  '--shot-dark-sunken': ['dark', '--paper-sunken', '#1e2637'],
};

const UPSTREAM = new URL('../../onerate-ui/src/tokens.css', import.meta.url);

/** Where the values above were copied from, for a failure message that can be acted on. */
export const UPSTREAM_PATH = fileURLToPath(UPSTREAM);

export const upstreamIsCheckedOut = () => existsSync(UPSTREAM_PATH);

/** Every `--x: y` in one balanced `{ … }` block, comments already gone. */
function declarationsIn(source, from) {
  const open = source.indexOf('{', from);
  let depth = 0;
  let i = open;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) break;
  }
  const body = source.slice(open + 1, i);
  const found = {};
  for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    found[name] = value.trim().replace(/\s+/g, ' ');
  }
  return found;
}

/**
 * `tokens.css`'s two palettes, read from the file rather than from a summary of it.
 *
 * Only the light block defines the scale, the type stack and the touch floor; the dark block
 * re-answers the COLOUR roles alone (`tokens.css` says so and its own `tokens.test.ts` pins it).
 * A dark-only page therefore reads `dark[name] ?? light[name]`, which is what `resolve` does.
 */
export function readUpstreamTokens() {
  const source = readFileSync(UPSTREAM_PATH, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const light = declarationsIn(source, source.indexOf("[data-tone='light']"));
  const dark = declarationsIn(source, source.indexOf(":root[data-theme='dark']"));
  return { light, dark, resolve: (name) => dark[name] ?? light[name] };
}
