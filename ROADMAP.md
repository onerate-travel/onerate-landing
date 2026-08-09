# onerate-landing — Roadmap

Open work only. Completed items are deleted rather than checked off; history lives in git.

## R3.4.4 the landing page and the portal disagree on the default language — P3

Moved here from `suphero/onerate-app`'s `ROADMAP.md` on 2026-07-25 with the landing-repo split
(ADR-0009). **The item spans two repositories** — resolving it may change the portal rather than
this page, so it cannot be closed here alone. This is the item's only copy: the monorepo's roadmap
carries no stub (a second copy would be one more thing to keep in sync), so a change landing in
`suphero/onerate-app` has to be driven from here.

- [ ] `public/index.html` auto-detects from `navigator.language` across all SEVEN languages, and
      remembers an explicit choice in this origin's `localStorage`. The portal pins
      `lng: localStorage.getItem('onerate.lang') ?? DEFAULT_LOCALE` (`apps/web/src/i18n.ts` in
      `suphero/onerate-app`) — a hard `en` default with no browser detection. So a Turkish-locale
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
