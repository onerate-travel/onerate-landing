# onerate-landing — Agent Instructions

The OneRate promo page: one static HTML file served at `onerate.travel`. Split out of
`onerate-travel/onerate-app` on 2026-07-25 — see `docs/ADR-0009-landing-repo-split.md` there.

It stopped being a poster on 2026-08-31. The page is now a hero and seven sections — what the
product does,
which suppliers it speaks to, an illustration of the portal in both themes, the Model-A contrast
against a consolidator, the shipped feature set, what happens to a supplier credential, and an
access request — because the product team's own finding was that the page was the whole demand
funnel and carried a `mailto:` (`teams/urun.md`, B24). Sections are cheap; the SEVEN TRANSLATIONS
of each new sentence are not. Weigh a new paragraph accordingly.

## Seven things that look wrong and are not

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
4. **The illustrated portal screen carries a SECOND hand-copied palette, and it is deliberate.**
   The section that shows the product light beside dark is the only place on this page where
   `@onerate/ui`'s two palettes have to be true at the same time. A role name can mean one colour
   per document, so the page cannot say `--paper` twice — it says `--shot-light-paper` and
   `--shot-dark-paper`, and `SHOT_TOKENS` in `test/design-system.js` records the theme and the ROLE
   each one was copied from so `design.test.js` can resolve it against `tokens.css` exactly the way
   it resolves the brand. Sixteen hexes with nothing watching them is the failure this repo already
   had once.

   The screen is DRAWN, not photographed, and the caption on the page says so. A screenshot would
   be a picture of demo data whose photographs are still placeholders
   (`onerate-app/ROADMAP.md`); what is honest to show is the layout and the palette, both of which
   are the product's own.
5. **The suppliers the page names are checked against the product, not against the copy.**
   `data-supplier` / `data-supplier-state` in the markup are read by `test/design.test.js`: a name
   marked `live` must be in `SUPPLIER_CATALOG` (`onerate-supplier-sdk`, the only source of addable
   suppliers) and a name marked `integrating` must have an adapter directory in
   `onerate-supplier-gateway`. Both halves skip when the sibling repo is absent, like the tokens
   check. Promising an agency a supplier the product cannot take is the one lie this page can tell
   that no language test would catch.
6. **The `mailto:` you wrote is not the `mailto:` that ships, and that is accepted.** The zone has
   Cloudflare's Email Obfuscation on, so every `mailto:` in the served HTML comes back as
   `/cdn-cgi/l/email-protection#…`. Measured in Chrome against production: with JavaScript on the
   page's own `setLang` writes the composed `mailto:` over it and the buttons work — Cloudflare's
   decoder alone would restore only the ADDRESS and drop the subject and body, so the prefilled
   template survives because this page builds it, not because Cloudflare gives it back. With
   JavaScript off all three mail links lead to a Cloudflare 404.

   Owner decision, 2026-08-31: leave it. A visitor with JavaScript off is, for a page selling to
   travel agencies, close to nobody, and turning obfuscation off exposes the address on the one
   page whose whole job is to be written to. The fix, if it is ever wanted, is a Configuration Rule
   scoped to the apex hostname setting Email Obfuscation off — not the zone-wide toggle, which
   would also un-hide the addresses on `docs.` and `support.`.

   The consequence for `make smoke`: it cannot assert on the `href`, so it asserts on what survives
   the rewrite — the `data-mail-template` hook, the `requestSubject` template, and the
   `encodeURIComponent` line that assembles them. Do not "fix" it back to grepping the href; it
   will be red forever, and a check that is always red is a check nobody reads.
7. **`public/fonts/` holds four `.woff2` files, and they are checked in.** The two applications
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
stack, the spacing scale, `--radius`, `--touch` — under `@onerate/ui`'s own names, copied by hand,
plus the sixteen `--shot-*` values the illustrated screen is drawn in (point 4 above). It cannot
import `tokens.css`: there is no build step (point 3 above), and adding one to publish a static
page would be the tail wagging the dog.

**A copy with nothing watching it is how this page came to be blue in front of a teal product.** So
the copy lives in `test/design-system.js` as well as in the page, and `test/design.test.js` checks
it in two directions:

- `index.html` against `design-system.js` — always, including CI. This catches a hex edited by
  hand here. `PAGE_TOKENS` covers the brand; `SHOT_TOKENS` covers the illustration, and each of its
  entries carries the theme and the role it came from rather than only a value.
- `design-system.js` against `onerate-ui/src/tokens.css` — only when that repo is checked out
  beside this one, and it reports itself **skipped** otherwise rather than passing over nothing.
  This catches drift, and drift starts upstream.

Changing a brand value means changing it in **both** files. If the second test is skipped in your
run, check out `onerate-ui` beside this repo and run again before pushing.

The page's own ground — `--bg`, `--panel`, `--panel-lift`, `--fg`, `--muted`, `--border`,
`--border-soft` — is NOT from the design system and is not meant to be, and the distinction survived
the page growing: a marketing page is not the chrome an agent sits inside for eight hours. What has
to match the product is the BRAND and, inside the illustration, the product's own two palettes —
never the furniture around them.

## Language conventions

- Code, comments, commits, docs, tests: **English**.
- End-user copy: **seven languages** — English (default and fallback), Türkçe, Български, Magyar,
  Italiano, Polski, Română. Same set, same order and same endonym labels as the portal's own
  `LOCALES` (`packages/core/src/locales.ts` in `onerate-travel/onerate-app`).
- The copy lives in ONE `TEXT` dictionary in the page's inline script, keyed by language, with the
  markup carrying `data-i18n` keys. It used to be paired `data-en`/`data-tr` spans; at seven
  languages that would be seven spans per sentence, and forgetting one would be easy to do and hard
  to see.
- **Translated ATTRIBUTES go through `ATTRIBUTE_HOOKS`, one row per attribute.** `setLang` used to
  know about exactly one — a `<meta>`'s `content` — and a `data-i18n` on anything else wrote
  `textContent`, which on a void element does nothing at all, silently. Today
  `data-i18n-label` writes `aria-label`; a form's `placeholder` is one more row of that map rather
  than a rewrite (`ROADMAP.md`, R4.1). `bilingual.test.js` checks attribute keys with the same
  seven-language parity it applies to text.
- **The access mail is COMPOSED, not looked up.** `requestSubject` and `requestBody` are ordinary
  dictionary keys; `setLang` assembles them into the `mailto:` with `encodeURIComponent` and writes
  it to every `[data-mail-template]`. Storing seven pre-encoded urls instead would put seven blobs
  in the dictionary and make a typo in one of them invisible. The markup still ships the English url
  in full, for a reader with no JavaScript.
- **Never nest an element inside one that carries `data-i18n`.** The loop writes `textContent`, so a
  nested child is erased on the first language change. Where a cell needs both a tag and a sentence
  — the comparison table's mobile column labels — the two are SIBLINGS, each with its own key.
- **The English copy is written into the MARKUP as well**, and the script only replaces it. A
  visitor with JavaScript off — and every crawler that does not run it — sees the raw HTML, so
  empty elements filled entirely by script would ship a blank page. `test/bilingual.test.js`
  asserts this directly.
- A key present in the markup and missing from a language ships a half-translated page, and does it
  invisibly: the element keeps the English it already had. Same rule as the old span pairing, one
  level up. `test/bilingual.test.js` is what makes it a failure rather than a silent regression.

## Open work

`ROADMAP.md` — open items only; completed ones are deleted, never checked off.

- **R3.4.4** spans this repo and `onerate-travel/onerate-app`. Do not close either half alone.
- **R4.1** is the access-request FORM, and it is still blocked on the owner decision it has always
  been blocked on: where a submission goes, and under whose Turnstile keys. What shipped on
  2026-08-31 is a prefilled `mailto:` and the attribute-translation mechanism the form will need —
  not the form. Do not build one that POSTs to a path with no function behind it: Pages answers it
  with `index.html` at 200, the visitor is told it worked, and nobody ever hears from them.

## Commits

Conventional Commits. Run `npm test` before pushing.

A push to `main` runs the gate and publishes `onerate.travel` if it passes. This no longer mirrors
`onerate-travel/onerate-app`, which went back to `workflow_dispatch` only — its gate is far heavier
and a red one there blocked shipping entirely. The `staging` branch is deliberately NOT wired to a trigger —
a rehearsal is `gh workflow run deploy.yml --ref main -f environment=staging`. Run `npm test`
locally anyway: a red suite on `main` now costs a failed deploy rather than a quiet nothing.
