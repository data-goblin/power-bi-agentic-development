---
title: Convert a BIM model to TMDL
summary: te save-as turns model.bim into a TMDL folder, and the pbism version that goes with it
kind: recipe
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-dataset
  - url: https://docs.tabulareditor.com/Command-line-Options
tools:
  te: 0.8.1.1
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - te save-as --help
skills: [pbip/tmdl]
---

# Convert a BIM model to TMDL

```bash
te save-as --model model.bim -o definition --serialization tmdl
te validate --model definition --errors-only --non-interactive
```

The reverse is `--serialization bim`. Run on the Bikes example in both directions, the round trip validates. If your te configuration gates saves on Best Practice Analyzer rules, add `--skip-bpa` for a pure format conversion (the Bikes model at compatibility level 1702 trips the "latest compatibility level" rule).

Inside a PBIP project:

- `definition.pbism` must declare version 4.0 or higher for TMDL (version 1.0 is TMSL only). Check Learn's [semantic model folder](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-dataset) page for the current number
- Delete `model.bim` after the conversion so only one representation remains. Unverified: whether Desktop refuses both together

Tabular Editor 2: `-T` writes a VSTEST `.trx` file, not TMDL. The TMDL output flag is `-TMDL <folder>`, per [Command-line-Options](https://docs.tabulareditor.com/Command-line-Options). TE2 reads a `.bim` or a `database.json` folder; use `te` for TMDL input.
