---
title: GitHub Actions workflow for a TMDL model (validate, BPA, tests)
summary: A SHA-pinned GitHub Actions workflow that gates a PR with te validate, bpa and test list, then deploys and runs te test run on main
kind: recipe
status: current
sources:
  - url: https://docs.tabulareditor.com/en/cli/
  - url: https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions
tools:
  te: 0.8.1.1
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - actionlint plugins/tabular-editor/wiki/examples/model-ci/model-ci.yml
  - zizmor --offline --no-config plugins/tabular-editor/wiki/examples/model-ci/model-ci.yml
  - te validate --model plugins/pbip/wiki/examples/bikes/Bikes.SemanticModel/definition --errors-only --non-interactive
  - te bpa run --model plugins/pbip/wiki/examples/bikes/Bikes.SemanticModel/definition --rules plugins/tabular-editor/wiki/examples/bpa-ci-rules/model-rules.json --no-defaults --no-model-rules --fail-on error --non-interactive
  - te test list --suite plugins/tabular-editor/wiki/examples/dax-tests/suite
skills: [tabular-editor/te-cli]
---

# GitHub Actions workflow for a TMDL model

The te-cli skill's `references/config-cicd-env.md` explains service principals, environments and promotion. This page is a complete workflow file to copy: [model-ci.yml](examples/model-ci/model-ci.yml). It expects this repository layout:

```dirtree
model/                       the TMDL definition folder
rules/model-rules.json       BPA rules, see bpa-ci-rule-set.md
.te-tests/*.test.yaml        DAX suites, see te-test-reconciliation-suite.md
.github/workflows/model-ci.yml
```

## What each job runs

```yaml
gate (pull_request and push, no secrets):
  te validate --model model --errors-only --ci github --trx validate.trx --non-interactive
  te bpa run --model model --rules rules/model-rules.json --no-defaults --no-model-rules --fail-on error --ci github --trx bpa.trx --non-interactive
  te test list --suite .te-tests
deploy-test (push to main, environment dev, needs gate):
  te deploy --model model --target-server "$WORKSPACE" --target-database "$SEMANTIC_MODEL" --auth env --execute --force --ci github --non-interactive
  te test run --suite .te-tests -s "$WORKSPACE" -d "$SEMANTIC_MODEL" --auth env --ci github --trx test.trx --non-interactive
```

The same `validate`, `bpa run` and `test list` commands, run on the Bikes example in this wiki, exit 0 with 2 rules evaluated and 0 violations. With the auto date/time annotation set, `bpa run --ci github` exits 1 and prints `::error title=MODEL_AUTO_DATE_TIME_DISABLED::...`, which GitHub shows as an annotation on the pull request.

`te test run` needs a deployed model, so a pull request cannot run the suite before merge: the PR job only parses the suites (`te test list` exits 1 on a broken YAML file), and the real run happens after deploy. To test a PR before merge, deploy it to a throwaway workspace model in a job with its own environment.

## Choices that matter

- Every action is pinned to a full commit SHA (`actions/checkout` v7.0.1, `actions/upload-artifact` v7.0.2 on 2026-11-23); `actionlint` and `zizmor` accept the file
- `permissions: contents: read` and `persist-credentials: false`; the gate job has no secrets, so a fork pull request can run it
- `te` has no pinned download URL (`latest` is the only channel), so the workflow checks the archive against `TE_SHA256` with `sha256sum --check --strict` and fails when the vendor replaces the file. Refresh the value deliberately: download the archive, read what changed, then update the hash. The value in the example is the archive served on 2026-11-23 and will go stale
- Secrets are mapped on the two steps that use them, never at workflow level, and never echoed; `--auth env` reads `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` and `AZURE_TENANT_ID`
- The `dev` environment holds the secrets and can require an approval; add a second job with `environment: prod` for promotion
- The deploy job runs `deploy --execute --force`; without both flags it prints the TMSL and changes nothing
