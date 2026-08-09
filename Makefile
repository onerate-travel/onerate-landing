# onerate-landing — deploying from a laptop when CI cannot.
#
# WHY THIS EXISTS. The GitHub Actions workflow is the normal path and should stay it: it deploys
# from a clean checkout of a named branch, and a laptop cannot promise that. This file is for the
# day Actions itself is unavailable — as on 2026-08-04, when every job in the monorepo refused to
# start on an account billing failure — and the choice is between shipping from here and not
# shipping. It mirrors `suphero/onerate`'s Makefile, target for target, for the same reasons.
#
# WHAT IT IS NOT. It is not a faster way to deploy. Every target that ships runs the SAME gate the
# workflow runs, first, and refuses on the same conditions. A deploy path that let you skip the gate
# would be worse than no deploy path, because it would get used on the good days too.
#
# The steps below mirror .github/workflows/deploy.yml. If you change one, change both — `ci-parity`
# prints them side by side so the drift is visible rather than assumed.

SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

PROD_URL    ?= https://onerate.travel
WRANGLER    := npx wrangler

# The deployed directory, in ONE place. Cloudflare Pages Direct Upload publishes every file in the
# directory it is handed, and the repo root holds ROADMAP.md — so a `.` here would put this
# project's open work on the public internet at onerate.travel/ROADMAP.md (CLAUDE.md, point 1).
# Named rather than repeated so the two deploy targets cannot drift into disagreeing about it.
PUBLISH_DIR := public

.PHONY: help
help: ## Show this help
	@echo "onerate-landing — local deploy (use only while CI cannot run)"
	@echo
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'
	@echo

# ---- The gate ---------------------------------------------------------------------------------

.PHONY: gate
gate: ## The workflow's only gate: the test suite
	npm test

# There is no build step and nothing for `tsc` to check — the only source file is an HTML page
# (CLAUDE.md, point 3). If that ever stops being true, this comment is the thing that is wrong.

# ---- Guards -----------------------------------------------------------------------------------
#
# CI deploys from a clean checkout of a named branch. A laptop can be on anything, with anything
# uncommitted, so the two facts CI gets for free are asserted here instead.

.PHONY: require-clean
require-clean:
	@if [ -n "$$(git status --porcelain)" ]; then \
	  echo "refusing: the working tree is dirty."; \
	  echo "A local deploy ships what is ON DISK. Uncommitted work would reach production with"; \
	  echo "nothing recording what was shipped — commit or stash it first."; \
	  git status --short; exit 1; fi

#
# `symbolic-ref`, not `rev-parse --abbrev-ref`: on a detached HEAD or a branch with no commits,
# `--abbrev-ref` prints a raw git fatal and then the literal string "HEAD", so the guard refuses
# with "on 'HEAD', not 'main'" — a true refusal reached by a false statement. A guard whose message
# you learn to distrust is a guard you learn to bypass. (Found in onerate-docs, whose branch had no
# commits yet; fixed in both files rather than only where it bit.)
.PHONY: require-branch-%
require-branch-%:
	@branch=$$(git symbolic-ref --short --quiet HEAD) || { \
	  echo "refusing: HEAD is detached — there is no branch to compare against '$*'."; \
	  echo "Check out $* before deploying."; exit 1; }; \
	if [ "$$branch" != "$*" ]; then \
	  echo "refusing: on '$$branch', not '$*'."; \
	  echo "The workflow gates each environment on its branch (deploy.yml: github.ref_name)."; \
	  echo "Deploying staging's HEAD to production is exactly the divergence that gate prevents."; \
	  exit 1; fi
	@if ! git rev-parse --verify --quiet HEAD >/dev/null; then \
	  echo "refusing: '$*' has no commits yet."; \
	  echo "There is nothing to deploy, and nothing that would record what was deployed."; \
	  exit 1; fi
	@if ! git rev-parse --verify --quiet origin/$* >/dev/null; then \
	  echo "refusing: there is no origin/$* to compare against."; \
	  echo "Without a remote branch, 'is this pushed?' cannot be answered — and the answer is the"; \
	  echo "only thing standing between a deploy and code that exists on one laptop."; exit 1; fi
	@if [ -n "$$(git log origin/$*..HEAD --oneline)" ]; then \
	  echo "refusing: HEAD is ahead of origin/$*."; \
	  echo "Push first. Otherwise what runs in the cloud exists on one laptop and nowhere else."; \
	  git log origin/$*..HEAD --oneline; exit 1; fi

# ---- Staging ----------------------------------------------------------------------------------

# Guards BEFORE the gate here, unlike the monorepo's Makefile, which runs `gate` on the aggregate
# and hangs the guards off the sub-targets. There are no sub-targets to hang them off — one page,
# one artifact — so they go on the deploy target itself, and putting them first means a dirty tree
# fails in a millisecond rather than after the suite.

.PHONY: deploy-staging
deploy-staging: require-clean require-branch-staging gate ## Publish a Pages preview from staging
	$(WRANGLER) pages deploy $(PUBLISH_DIR) --project-name onerate-landing --branch staging

# ---- Production -------------------------------------------------------------------------------

.PHONY: preflight
preflight:
	@echo "About to deploy to PRODUCTION ($(PROD_URL)):"
	@echo "  commit   $$(git rev-parse --short HEAD)  $$(git log -1 --pretty=%s | cut -c1-64)"
	@echo "  branch   $$(git rev-parse --abbrev-ref HEAD)"
	@echo "  account  $$($(WRANGLER) whoami 2>/dev/null | grep -oE '[0-9a-f]{32}' | head -1)"
	@echo

# Guards, THEN the banner. `preflight` calls `wrangler whoami`, which needs the network and an
# authenticated session; running it first means a dirty tree waits on a round trip to Cloudflare to
# be told something git could have said instantly — and, unauthenticated, waits on a prompt.
.PHONY: deploy-prod
deploy-prod: require-clean require-branch-main preflight gate ## Publish to onerate.travel
	# `--branch main` is what Pages reads as production; any other value is a preview.
	$(WRANGLER) pages deploy $(PUBLISH_DIR) --project-name onerate-landing --branch main
	@echo
	@echo "Deployed. Now run 'make smoke' — the deploy log alone cannot tell you what is live."

# ---- Verifying what shipped -------------------------------------------------------------------
#
# Bodies are captured into a variable and then grepped — never `curl … | grep -q`. Under
# `-o pipefail`, `grep -q` exits the moment it matches, curl takes SIGPIPE on the closed pipe, and
# the pipeline reports failure *because the assertion succeeded*. The ROADMAP check below hides
# that bug perfectly while it passes (grep never matches, so it reads the whole stream) and would
# have sprung it on the one day the check needed to be trusted. Found in onerate-docs, where the
# same construct claimed /tr/ was not Turkish while it was being served perfectly; fixed here too
# rather than only where it bit.

.PHONY: smoke
smoke: ## Check production: the page is live, bilingual, and the roadmap is NOT published
	@set -euo pipefail; \
	page=$$(curl -fsS $(PROD_URL)/); \
	echo "$$page" | grep -q 'app.onerate.travel' || { echo "FAIL: no portal link on the live page"; exit 1; }; \
	echo "  ok  portal link present"; \
	echo "$$page" | grep -q 'docs.onerate.travel' || { echo "FAIL: no docs link on the live page"; exit 1; }; \
	echo "  ok  docs link present"; \
	echo "$$page" | grep -q 'data-tr' || { echo "FAIL: the Turkish copy is missing from the live page"; exit 1; }; \
	echo "  ok  bilingual copy present"; \
	echo; \
	echo "  ROADMAP.md must not be published (CLAUDE.md, point 1)."; \
	echo "  Asserting on the BODY, never the status code: this project has no custom 404.html, so"; \
	echo "  Pages answers every unmatched path with index.html at 200. A 200 here is normal and"; \
	echo "  means the file is absent — anyone reading a status code would draw the wrong conclusion."; \
	roadmap=$$(curl -fsS $(PROD_URL)/ROADMAP.md); \
	if echo "$$roadmap" | grep -q 'R3.4.4'; then \
	  echo "FAIL: the roadmap is being served at $(PROD_URL)/ROADMAP.md"; \
	  echo "The deploy published the repo root instead of $(PUBLISH_DIR)/."; exit 1; fi; \
	echo "  ok  roadmap is not published"

# ---- Keeping this honest ----------------------------------------------------------------------

.PHONY: ci-parity
ci-parity: ## Print the workflow's steps beside this file's, so drift is visible rather than assumed
	@echo "=== .github/workflows/deploy.yml ==="
	@grep -E '^\s+(run|name):' .github/workflows/deploy.yml | sed 's/^ */  /'
	@echo
	@echo "=== Makefile (gate + deploy targets) ==="
	@grep -E '^\t(npm|\$$\(WRANGLER)' Makefile | sed 's/^\t/  /'

.PHONY: whoami
whoami: ## Which Cloudflare account these deploys would land in
	$(WRANGLER) whoami
