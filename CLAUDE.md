# onerate-landing — Agent Instructions

The OneRate promo page: one static HTML file served at `onerate.travel`. Split out of
`suphero/onerate` on 2026-07-25 — see `docs/ADR-0009-landing-repo-split.md` there.

## Three things that look wrong and are not

1. **The deployed directory is `public/`, never the repo root.** Cloudflare Pages Direct Upload
   publishes every file in the directory it is given. Deploying the root would put this project's
   roadmap on the public internet at `onerate.travel/ROADMAP.md`.
2. **The Pages project is Direct Upload and cannot become Git-connected.** Cloudflare: *"If you
   choose Direct Upload, you cannot switch to Git integration later. You will have to create a new
   project."* Converting would mean standing up a second Pages project and migrating a live apex
   domain onto it. That is why deploys go through GitHub Actions and `wrangler`.
3. **The package manager is npm, not pnpm** — deliberately unlike the monorepo. Three
   devDependencies and no workspaces; pnpm would add a `corepack enable` CI step and a lockfile
   format `actions/setup-node` does not cache out of the box. Likewise there is no TypeScript: the
   only source file is an HTML page, so there is nothing for `tsc` to check.

## TDD — the Iron Law

```text
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Red → Green → Refactor. Every bug fix starts with a failing regression test that reproduces it.

`test/lang.test.js` parses the *shipped* `public/index.html` — never a copy of its script — so
editing the page's inline JavaScript is exactly what makes it fail. Keep it that way.

## Language conventions

- Code, comments, commits, docs, tests: **English**.
- End-user copy: **English default, Turkish second**, as paired `data-en` / `data-tr` spans.
- A `data-en` span without its `data-tr` sibling ships a half-translated page. Keep them in sync.

## Open work

`ROADMAP.md` — open items only; completed ones are deleted, never checked off. Its single item,
R3.4.4, spans this repo and `suphero/onerate`. Do not close either half alone.

## Commits

Conventional Commits. Run `npm test` before pushing — the workflow runs it too and refuses to
deploy on red, but finding out locally is faster than finding out in Actions.
