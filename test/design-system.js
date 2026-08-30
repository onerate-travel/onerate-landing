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

/** Values the page declares in its own `:root`, resolved for a page that is only ever dark. */
export const PAGE_TOKENS = {
  '--teal': '#127a68',
  '--teal-on-ink': '#7fd0be',
  '--on-accent': '#ffffff',
  '--focus': '#5b9bff',
  '--font-display': "'Space Grotesk Variable', 'Space Grotesk', sans-serif",
  '--font-ui': "'Inter Variable', 'Inter', system-ui, sans-serif",
  '--text-md': '13px',
  '--space-2': '8px',
  '--space-3': '12px',
  '--space-4': '16px',
  '--space-5': '24px',
  '--space-6': '32px',
  '--touch': '40px',
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
