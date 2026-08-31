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

**Also done, 2026-08-31 — two of the three things the form needs, and an interim funnel.**

- **Attribute translation, the piece the note below called "the piece with no workaround".**
  `setLang` now carries an `ATTRIBUTE_HOOKS` map; `data-i18n-label` writes `aria-label` today and a
  `placeholder` is one more row of that map. `test/bilingual.test.js` checks attribute keys with the
  same seven-language parity it applies to text, which is the acceptance line below, met early.
- **A prefilled `mailto:` in place of the bare address.** It asks the qualifying question in the
  visitor's own language — which supplier API contracts the agency already holds — so every request
  that arrives answers §15.1 for that agency (`teams/urun.md`, T5). Composed by `setLang` from
  `requestSubject`/`requestBody` rather than stored as seven encoded urls; asserted by
  `bilingual.test.js`, `design.test.js` and `make smoke`.
- **The page around it.** A hero and seven sections, so the form has somewhere to belong other
  than under a poster.

This does NOT close the item. A `mailto:` loses the reader whose browser has no mail handler, it
cannot validate a field, and it collects nothing anyone can query. The decision below is still what
the form is waiting on.

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
- [ ] Once answered: the form's markup and `<h2>`, and a form CSS vocabulary. The page still has no
      `input`, `label`, `textarea`, `button` or `fieldset` rule — `.langs select` and the comparison
      slider are its only controls — and `@onerate/ui`'s `.kv-input`/`.kv-field`/`.kv-btn` are the
      smallest set worth copying. Attribute translation is no longer part of this bullet: it landed
      on 2026-08-31 and a `placeholder` is one row of `ATTRIBUTE_HOOKS`.
- [ ] Re-ask `teams/tasarim/kabuk.md` O3 when the form lands, as that note says to: `color-scheme:
      dark` was enough for a page whose only control is a select, and the moment there are text
      inputs the platform may draw them by its own scheme again.
- [ ] scenario: the form itself is fully translated in all seven languages, placeholders and error
      strings included. The parity check that asserts it already exists and already runs — the
      attribute half of `test/bilingual.test.js` — so this is copy, not mechanism.
- [ ] scenario: with JavaScript off the page is still readable and the form still submits
      (`CLAUDE.md`, "Language conventions")
- [ ] scenario: an empty or invalid field produces an in-page error, not a browser bubble, and the
      page keeps its scroll position on a successful submit

## R4.2 the consent banner names Google Analytics and links to no privacy notice — P2

Opened 2026-08-31 with the analytics work. GA4 ships behind Consent Mode v2 with all four signals
denied by default and a seven-language bar (`CLAUDE.md`, point 8), which is the mechanism. The
DOCUMENT that mechanism is supposed to point at does not exist.

What the bar can honestly say today is what it does say: that visits are counted with Google
Analytics and that nothing is stored until the visitor allows it. What it cannot say — because
nobody has written it down — is who the controller is, how long GA retains an event, that the
processor is outside the EEA, or how a visitor withdraws a consent they have already given. Right
now withdrawing means clearing this origin's `localStorage`, which is not an instruction anyone
can be expected to follow.

This is not a blocker for the analytics themselves: denied-by-default with no identifier is the
conservative state, and a visitor who never answers is never measured beyond a cookieless ping.
It is a blocker for the page CLAIMING to have asked properly.

**It overlaps a fleet item and should not be answered twice.** `teams/yonetim.md:62` carries KVKK
*veri sorumlusu / VERBİS / açık rıza metni* (R2.2.3 in `onerate-travel/onerate-app`) as open and
as a signing blocker for enterprise contracts. The controller identity and the retention wording
that item has to produce are the same two facts this page needs. Take them from there when it
lands rather than inventing a second set here — two privacy texts that disagree is worse than one
that is late.

- [ ] Decide where the notice lives. A second HTML file in `public/` is the cheap answer and costs
      a seven-language translation of a legal text; a page in `onerate-docs` is already
      multilingual and already has a URL scheme, but is written for customers who have signed in
      rather than for a visitor who has not.
- [ ] A way to change an answer that is not "clear your browser storage" — at minimum a footer
      link that reopens the bar. The bar already stores both answers, so this is a control, not a
      mechanism.
- [ ] scenario: the banner links to a notice that names the controller and the retention period,
      in the language the visitor is reading the page in
- [ ] scenario: a visitor who allowed can withdraw from the page itself, and the withdrawal
      survives a reload
