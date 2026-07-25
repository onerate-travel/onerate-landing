# onerate-landing

The OneRate promo page — the single static page served at <https://onerate.travel>.

Split out of [`suphero/onerate`](https://github.com/suphero/onerate) on 2026-07-25 so a copy change
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

Push. `staging` publishes a preview, `main` publishes production. Both run `npm test` first.

Manual deploys, if the workflow is ever unavailable:

```bash
npm run deploy:staging
npm run deploy:production
```
