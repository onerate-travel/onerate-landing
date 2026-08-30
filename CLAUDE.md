# onerate-landing — Agent Instructions

The OneRate promo page: one static HTML file served at `onerate.travel`. Split out of
`onerate-travel/onerate-app` on 2026-07-25 — see `docs/ADR-0009-landing-repo-split.md` there.

## Four things that look wrong and are not

1. **The deployed directory is `public/`, never the repo root.** Cloudflare Pages Direct Upload
   publishes every file in the directory it is given. Deploying the root would put this project's
   roadmap on the public internet at `onerate.travel/ROADMAP.md`.

   Do not try to verify that with a status code. This project has no custom `404.html`, so Pages
   answers *every* unmatched path with `index.html` at **200** — `GET /ROADMAP.md` returning 200 is
   normal and means the file is absent. Assert on the body instead, and corroborate with the deploy
   log's manifest size:

   ```bash
   curl -sS https://onerate.travel/ROADMAP.md | grep -c 'R3.4.4'   # expect 0
   gh run view <id> --log | grep -i 'already uploaded'             # expect 1 file
   ```

2. **The Pages project is Direct Upload and cannot become Git-connected.** Cloudflare: *"If you
   choose Direct Upload, you cannot switch to Git integration later. You will have to create a new
   project."* Converting would mean standing up a second Pages project and migrating a live apex
   domain onto it. That is why deploys go through GitHub Actions and `wrangler`.
3. **The package manager is npm, not pnpm** — deliberately unlike the monorepo. Three
   devDependencies and no workspaces; pnpm would add a `corepack enable` CI step and a lockfile
   format `actions/setup-node` does not cache out of the box. Likewise there is no TypeScript: the
   only source file is an HTML page, so there is nothing for `tsc` to check.
4. **`public/fonts/` holds four `.woff2` files, and they are checked in.** The two applications
   get Inter and Space Grotesk from `@fontsource-variable/*` and a bundler
   (`onerate-ui/src/styles.css:1-4`); with no build step this page cannot, and a font CDN would
   hand every visitor's IP to a third party across six EU markets. So the four subsets the seven
   languages actually need are copied in verbatim, with both SIL OFL licences beside them.
   `test/design.test.js` refuses a `@font-face` whose file is missing and a family named in
   `--font-ui` that nothing ships — a page that CLAIMS the product's typeface and renders in
   system-ui would otherwise pass every other test.

## TDD — the Iron Law

```text
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Red → Green → Refactor. Every bug fix starts with a failing regression test that reproduces it.

`test/lang.test.js`, `test/bilingual.test.js` and `test/design.test.js` parse the *shipped*
`public/index.html` — never a copy of its script or its stylesheet — so editing the page is exactly
what makes them fail. Keep it that way. `bilingual.test.js` goes further and RUNS the page once per language, because the
`TEXT` dictionary is inside an IIFE with nothing exported: reading what the page actually rendered
is the only way to check it without keeping a second copy of the copy.

## The design system, and why the values are copied

The page carries `@onerate/ui`'s brand values — `--teal`, `--teal-on-ink`, `--focus`, the type
stack, the spacing scale, `--touch` — under `@onerate/ui`'s own names, copied by hand. It cannot
import `tokens.css`: there is no build step (point 3 above), and adding one to publish a static
page would be the tail wagging the dog.

**A copy with nothing watching it is how this page came to be blue in front of a teal product.** So
the copy lives in `test/design-system.js` as well as in the page, and `test/design.test.js` checks
it in two directions:

- `index.html` against `design-system.js` — always, including CI. This catches a hex edited by
  hand here.
- `design-system.js` against `onerate-ui/src/tokens.css` — only when that repo is checked out
  beside this one, and it reports itself **skipped** otherwise rather than passing over nothing.
  This catches drift, and drift starts upstream.

Changing a brand value means changing it in **both** files. If the second test is skipped in your
run, check out `onerate-ui` beside this repo and run again before pushing.

The page's own ground — `--bg`, `--panel`, `--fg`, `--muted`, `--border` — is NOT from the design
system and is not meant to be. A poster is not a portal.

## Language conventions

- Code, comments, commits, docs, tests: **English**.
- End-user copy: **seven languages** — English (default and fallback), Türkçe, Български, Magyar,
  Italiano, Polski, Română. Same set, same order and same endonym labels as the portal's own
  `LOCALES` (`packages/core/src/locales.ts` in `onerate-travel/onerate-app`).
- The copy lives in ONE `TEXT` dictionary in the page's inline script, keyed by language, with the
  markup carrying `data-i18n` keys. It used to be paired `data-en`/`data-tr` spans; at seven
  languages that would be seven spans per sentence, and forgetting one would be easy to do and hard
  to see.
- **The English copy is written into the MARKUP as well**, and the script only replaces it. A
  visitor with JavaScript off — and every crawler that does not run it — sees the raw HTML, so
  empty elements filled entirely by script would ship a blank page. `test/bilingual.test.js`
  asserts this directly.
- A key present in the markup and missing from a language ships a half-translated page, and does it
  invisibly: the element keeps the English it already had. Same rule as the old span pairing, one
  level up. `test/bilingual.test.js` is what makes it a failure rather than a silent regression.

## Open work

`ROADMAP.md` — open items only; completed ones are deleted, never checked off. Its single item,
R3.4.4, spans this repo and `onerate-travel/onerate-app`. Do not close either half alone.

## Commits

Conventional Commits. Run `npm test` before pushing.

A push to `main` runs the gate and publishes `onerate.travel` if it passes. This no longer mirrors
`onerate-travel/onerate-app`, which went back to `workflow_dispatch` only — its gate is far heavier
and a red one there blocked shipping entirely. The `staging` branch is deliberately NOT wired to a trigger —
a rehearsal is `gh workflow run deploy.yml --ref main -f environment=staging`. Run `npm test`
locally anyway: a red suite on `main` now costs a failed deploy rather than a quiet nothing.
