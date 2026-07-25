# onerate-landing — Roadmap

Open work only. Completed items are deleted rather than checked off; history lives in git.

## R3.4.4 the landing page and the portal disagree on the default language — P3

Moved here from `suphero/onerate`'s `ROADMAP.md` on 2026-07-25 with the landing-repo split
(ADR-0009). **The item spans two repositories** — resolving it may change the portal rather than
this page, so it cannot be closed here alone. The monorepo's roadmap keeps a stub pointing back.

- [ ] `public/index.html` auto-detects: `navigator.language` starting `tr` → Turkish, English
      otherwise. The portal pins `lng: localStorage.getItem('onerate.lang') ?? 'en'`
      (`apps/web/src/i18n.ts:16` in `suphero/onerate`) — a hard `en` default with no browser
      detection, asserted by `apps/web/src/i18n.test.ts:9`. So a Turkish-locale visitor reads this
      page in Turkish and lands in an English portal one click later. R3.4.1 recorded the owner's
      **en-default** decision (2026-07-18), and `ONERATE_BUILD_BRIEF.md` §0 + `CLAUDE.md` were
      updated to match the portal's code; this page was not. Decide which behaviour is intended —
      both surfaces cannot be right — then make the other match.

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
