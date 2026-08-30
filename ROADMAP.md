# onerate-landing — Roadmap

Open work only. Completed items are deleted rather than checked off; history lives in git.

## R3.4.4 the landing page and the portal disagree on the default language — P3

Moved here from `onerate-travel/onerate-app`'s `ROADMAP.md` on 2026-07-25 with the landing-repo split
(ADR-0009). **The item spans two repositories** — resolving it may change the portal rather than
this page, so it cannot be closed here alone. This is the item's only copy: the monorepo's roadmap
carries no stub (a second copy would be one more thing to keep in sync), so a change landing in
`onerate-travel/onerate-app` has to be driven from here.

- [ ] `public/index.html` auto-detects from `navigator.language` across all SEVEN languages, and
      remembers an explicit choice in this origin's `localStorage`. The portal pins
      `lng: localStorage.getItem('onerate.lang') ?? DEFAULT_LOCALE` (`apps/web/src/i18n.ts` in
      `onerate-travel/onerate-app`) — a hard `en` default with no browser detection. So a Turkish-locale
      visitor reads this page in Turkish and lands in an English portal one click later, and the
      seven-language rollout WIDENED the gap rather than closing it: the same now happens to a
      Bulgarian, Hungarian, Italian, Polish or Romanian visitor.

      R3.4.1 recorded the owner's **en-default** decision (2026-07-18), and
      `ONERATE_BUILD_BRIEF.md` §0 + `CLAUDE.md` were updated to match the portal's code; this page
      was not. Decide which behaviour is intended — both surfaces cannot be right — then make the
      other match.

      Note the landing page's `localStorage` write does not close this item. It uses the portal's
      own key name (`onerate.lang`) on purpose, so that the day a shared-origin or cookie hand-off
      is built the two already agree on what the value is called — but `localStorage` is
      origin-scoped and this page is not the portal's origin. See the paragraph below, which said
      so before the write existed and is still what has to be built.

      **The hand-off needs a cookie or a query parameter, not `localStorage`.** The original wording
      of this item said the switcher "never writes `onerate.lang`", implying that writing it would
      carry an explicit choice into the portal. It would not: this page is `onerate.travel` and the
      portal is `app.onerate.travel` — different origins, and `localStorage` is origin-scoped. A
      cookie scoped to `.onerate.travel`, or an explicit `?lang=` appended to the portal link, is
      what actually crosses.

      - [ ] scenario: a `tr-TR` browser gets the same initial language on this page and in the
            portal
      - [ ] scenario: an explicit language choice made here survives the hand-off into the portal
      - [ ] scenario: whichever default is chosen is asserted for both surfaces —
            `test/lang.test.js` covers this page, `apps/web/src/i18n.test.ts` covers the portal

## R4.1 the access-request form (K6) has a mechanism and no destination — P2

Opened 2026-08-30 by the design review (`teams/tasarim/kabuk.md` §3/L4, `teams/urun.md:315-325`).
The page is now able to carry the form and does not carry it, which is the honest state: the
groundwork landed, the one thing that decides its shape did not.

**Done, and it is the part that had to come first.** The layout no longer cuts off content taller
than the viewport (`public/index.html`, `body`/`main`), so a form can lengthen the page without
making its own top unreachable; there is an `<h1>` for a form's `<h2>` to sit under; and
`test/design.test.js` holds all of it.

**Verified, so it is no longer an open question.** `wrangler pages deploy public` DOES compile a
`functions/` directory — from the process's working directory, not from the published one:

```js
const functionsDirectory = customFunctionsDirectory || path.join(process.cwd(), "functions");
if (!_workerJS && fs.existsSync(functionsDirectory)) { /* buildFunctions(...) */ }
```

(`node_modules/wrangler/wrangler-dist/cli.js`, the `pages deploy` implementation, wrangler 4.) So a
root `functions/api/access-request.js` would be picked up by this repo's existing deploy command
with no change to `deploy.yml` and no `pages_build_output_dir`. This had been recorded as needing a
rehearsal deploy to settle; it does not.

- [ ] **Owner decision — where does a submitted request go, and under whose Turnstile keys?**
      The mechanism is settled and the destination is not, and nothing should be built until it is:
      a form that POSTs to a path with no function behind it gets `index.html` at 200 (CLAUDE.md,
      point 1), so the visitor is told it worked and no one ever hears from them. That is worse than
      the page not having a form.
      Candidates: an ops mailbox via Cloudflare Email Sending (the fleet already sends and smokes
      it); a KV or D1 record read from the admin panel; a ticket in the support surface (ADR-0019).
      The decision also has to say which Turnstile sitekey/secret pair the page and the function use.
- [ ] Once answered: the form's markup and `<h2>`, a form CSS vocabulary, and — the piece with no
      workaround — attribute translation. `setLang` writes `textContent` and `<meta content>` and
      nothing else (`public/index.html`), so a `data-i18n` on an `<input>` writes the text content
      of a void element and does **nothing, silently**. A `placeholder`, an `<option>` label, an
      error string and a success message all need it, in seven languages.
- [ ] scenario: the form is fully translated in all seven languages, asserted by extending
      `test/bilingual.test.js`'s parity check to translated attributes
- [ ] scenario: with JavaScript off the page is still readable and the form still submits
      (`CLAUDE.md`, "Language conventions")
- [ ] scenario: an empty or invalid field produces an in-page error, not a browser bubble, and the
      page keeps its scroll position on a successful submit
