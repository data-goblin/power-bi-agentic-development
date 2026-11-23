# Page contract

`uv run scripts/check.py` enforces everything below; CI runs it on every pull request.

## One question per page

A page answers one question an agent or a person asks while working ("how does TMDL quote a name with a dot", "which roles does a column chart take"), in at most 150 lines. When Learn already answers it, the page is short: the Learn link, what Learn leaves out, and a verified example.

## Frontmatter

```yaml
---
title: TMDL names that need quotes
summary: One line, used in index.md, at most 140 characters
kind: reference | gotcha | recipe | schema | decision
status: current | stale | deprecated
sources:                       # required for reference, gotcha and schema
  - url: https://learn.microsoft.com/en-us/analysis-services/tmdl/tmdl-overview
tools:                         # versions the page was checked against
  te: 0.8.1.1
last_updated: 2026-11-23       # changes whenever the text changes
last_verified: 2026-11-23      # changes only after the claims were re-checked; never older than last_updated
review_cadence_days: 90
verified_by:                   # what proves the page is still true
  - te validate -m plugins/pbip/wiki/examples/quoted-names
skills: [pbip/tmdl]            # skills that point here; each must exist
---
```

## Accuracy rules

- Every `pbir`, `te` and `fab` command and flag on a page must exist in the released tool. CI checks them against `wiki/_evidence/<tool>.json`, captured from released builds with `uv run scripts/check.py --capture`
- Examples are real files under `plugins/<plugin>/wiki/examples/`, checked by the matching tool (`te validate`, `pbir validate`, JSON schema); a page never shows an example no tool has accepted
- A claim without a source or a command that proves it is marked "Unverified" in the text
- Link only public sources: Microsoft Learn, microsoft/json-schemas, dax.guide, sqlbi.com, docs.tabulareditor.com, public GitHub repositories
- After re-checking a page, set `last_verified` and append a line to [log.md](log.md): `YYYY-MM-DD <page path> <what was checked>`
