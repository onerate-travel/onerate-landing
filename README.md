# onerate-landing

The OneRate promo page — the single static page served at <https://onerate.travel>.

Split out of [`suphero/onerate-app`](https://github.com/suphero/onerate-app) on 2026-07-25 so a copy change
does not wait behind the product monorepo's miniflare and Playwright suites. Reasoning:
`docs/ADR-0009-landing-repo-split.md` in that repo.

## Layout

| Path | What it is |
| --- | --- |
| `public/` | **the deployed site** — everything here is published, nothing outside it is |
| `test/lang.test.js` | pins the page's language default against the shipped HTML |
| `.github/workflows/deploy.yml` | `staging` → Pages preview, `main` → `onerate.travel` |

## Working on it

```bash
npm install
npm test
open public/index.html
```

There is no build step and no dev server. The page is one self-contained file.

## Deploying

**Nothing deploys on a push.** The workflow has no push trigger at all — same shape as
`suphero/onerate-app`'s `ci.yml`. Every deploy is dispatched by hand, and every dispatch runs
`npm test` before it publishes.

```bash
gh workflow run deploy.yml --ref staging -f environment=staging
gh workflow run deploy.yml --ref main    -f environment=production
```

Production refuses to run from any ref but `main`, loudly.

### From a laptop, when Actions cannot run

```bash
make help              # every target, with what it does
make deploy-staging    # a Pages preview
make deploy-prod       # onerate.travel
make smoke             # verify what is actually live
```

`make` is the path to use, not the raw `npm run deploy:*` scripts. Those are the bare wrangler
calls; the Makefile runs `npm test` first and refuses on three facts a laptop cannot otherwise
promise — a clean working tree, the right branch, and that branch pushed.

`make smoke` checks the live page for the portal link, the docs link and the Turkish copy, and then
checks that `ROADMAP.md` is **not** published. That last one asserts on the response **body**, never
the status code: this project has no custom `404.html`, so Pages answers every unmatched path with
`index.html` at 200 and a status code there proves nothing.
