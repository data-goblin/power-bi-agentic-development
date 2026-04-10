# Best Practice Analyzer (BPA)

`pbir bpa` runs a rule sweep over a report and reports violations: layout issues, accessibility gaps, deprecated patterns, formatting inconsistencies. It is the structural counterpart to `pbir validate` (which covers schema/JSON correctness).

## Run

```bash
pbir bpa run "Report.Report"                                 # All rules
pbir bpa run "Report.Report" --fail-on error -o json         # Machine-readable, exit non-zero on errors
pbir bpa run "Report.Report" --fix --save                    # Apply safe automatic fixes in place
```

Output groups violations by rule with affected visual/page paths, severity (`info`, `warning`, `error`), and remediation guidance.

`--fix --save` applies only fixes the rule marks as automatically safe. Review the diff before publishing. Unsafe or judgment-call fixes are reported but not applied.

## Manage Rules

```bash
pbir bpa rules list                                          # All rules with IDs, severities, descriptions
pbir bpa rules ignore PBIR_DROP_SHADOW "Report.Report"       # Suppress one rule for this report
pbir bpa rules unignore PBIR_DROP_SHADOW "Report.Report"     # Re-enable
```

Ignored rules are stored per report. Use ignores sparingly and document why in commit messages or report annotations.

## Coverage

BPA includes rules covering:

- **Filters**: too many TopN or Advanced filters on a single visual; broken or unreachable filter references
- **Visual sizing**: visuals below readable thresholds, visuals overflowing page bounds, inconsistent dimensions across a row
- **Accessibility**: contrast issues, missing alt text on image visuals, missing titles on data visuals
- **Formatting hygiene**: drop shadows enabled, default font styles, formatting that should live in the theme
- **Field bindings**: roles bound to fields that do not match the role's expected data type
- **Layout**: overlapping visuals, visuals positioned outside the canvas

The rule set evolves; `pbir bpa rules list` is the authoritative inventory.

## When to Run

- After a creation session, before validating
- As a pre-publish gate alongside `pbir validate --all`
- During audits, in addition to the manual checklist in `references/audit-report.md`

BPA is a starting point, not a verdict. A clean BPA run does not mean the report is well-designed; it means it does not trip the structural rules. Pair BPA with the design judgment captured in the `pbi-report-design` skill and `important/MENTAL-MODEL.md`.
