---
title: Scoring report-authoring runs with a gate and a 0-2 rubric in claude plugin eval
summary: A gate that zeroes broken output, a five-dimension 0-2 rubric, and how each maps to claude plugin eval graders
kind: recipe
status: current
sources:
  - url: https://code.claude.com/docs/en/plugin-evals
tools:
  pbir: 0.9.32
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - python3 -I plugins/reports/wiki/examples/report-eval/check-gate.py
  - >-
    bash -c 'out=$(claude plugin eval plugins/reports/wiki/examples/report-eval/add-bar-two-measures/prompt.md --ablation none --max-cost-usd 0 --allow-tools Bash Edit Write --no-publish --trust-plugin --output-dir "$(mktemp -d)" 2>&1); test $? -eq 2 && ! grep -q "cannot pass" <<<"$out"'
skills: [reports/create-pbi-report]
---

# Scoring report-authoring runs with a gate and a 0-2 rubric

A report an agent built can open, validate and bind real fields and still look wrong, or look polished and be broken. Score the two separately and let the gate win: a run that fails the gate scores 0 whatever it looks like. The design comes from a report-authoring benchmark; this page is the version that runs as a `claude plugin eval` case. Docs: [plugin evals](https://code.claude.com/docs/en/plugin-evals).

```dirtree
examples/report-eval/
  check-gate.py                       proves the gate accepts a known-good solution and rejects an untouched fixture
  add-bar-two-measures/
    prompt.md                         the task and run limits
    case.yaml                         points at fixture.sh
    fixture.sh                        writes a small Bikes report and model into the empty workspace
    graders/gate-*.md                 4 graders, pass or fail
    graders/q-<dimension>-ok|full.md  10 graders, two per dimension
  add-bar-reference/                  the same graders without gate-validate-ran, scored on the reference solution
```

## The gate

Offline, objective, no opinion. For this task it asks: did the agent run `pbir validate`, does `validate.log` say `validation passed`, is the visual a `clusteredBarChart`, and are `Category`, `Total Sales` and `Returned Sales` bound.

```yaml
tool_used (Bash, input_match 'pbir validate'): the check was run, not claimed
regex on validate.log:                         the output the agent saved
regex on visual.json:                          type and bound fields, with lookaheads so field order does not matter
```

The prompt names the visual (`sales_returns`), so the graders can read its file by path. `check-gate.py` runs the real fixture, adds the visual with `pbir add visual`, validates, and checks every regex grader accepts that result; on an untouched fixture every one must fail. Run it with the released `pbir` first on `PATH`.

## The rubric

Five dimensions, each 0 to 2, from anchors written for the artifact: fidelity (did it do the task), layout, visual choice, style, polish. An llm grader returns pass or fail, so each dimension becomes two graders: one passes at score 1 or more, one passes only at 2. The pair adds up to the 0-2 score. The anchors sit in the grader body; "when unsure pick the lower one" is in every `full` grader. Judges read `visual.json` through `focus: {source: file, path: ...}`, so they score the artifact and not the agent's description of it.

## Mapping to plugin eval

```yaml
gate pass or fail:       gate-*.md graders, one verdict each in results JSON
quality 0-10:            sum of the 10 q-*.md verdicts, from cases[].arms.with[].graders[]
task_score:              gate * (quality / 10), computed from the results JSON
negative control (bare): the without arm of the default --ablation with-without; read every score against it
pass rate:               runs per case (runs in prompt.md), --threshold on the with arm
cost:                    costUsd and turns per run, --max-cost-usd as the cap
```

Plugin eval scores a run as the weighted fraction of graders passed, so a failed gate lowers the score but cannot zero it. Do the multiplication outside, from the per-grader verdicts, and treat any failed `gate-*` grader as a failed run. Keep one reference report near 8 out of 10 and one near 4, and score each batch against them so numbers stay comparable between rounds. If the without arm already passes the gate and scores well, the task is too easy: change the task before crediting the plugin.

## What was checked

```yaml
load:        claude plugin eval loads both cases with no grader warning
gate:        check-gate.py passes on the reference solution and fails on the untouched fixture
reference:   add-bar-reference, 1 run: 3 of 3 gate graders pass, quality 7 of 10 (polish 0, style 1), judge cost about 0.06 USD
fixture:     add-bar-two-measures with the visual missing: every grader fails
agent run:   add-bar-two-measures cannot run in claude plugin eval 2.1.330 on a machine where pbir is installed under the home directory (see below)
```

`add-bar-reference` calibrates the graders. Its fixture builds the report, adds the reference visual with the released `pbir`, and saves `validate.log`; the prompt tells Claude to change nothing, so the graders score the reference itself. The reference has no number formats, so the polish graders fail, as they should. Two rubric graders split 2 to 1 between judge votes on the same file, so read one point of quality as noise.

Claude Code runs Bash in an OS sandbox during `claude plugin eval`. In that sandbox, Bash cannot write to the workspace and cannot read files under the home directory, so a `pbir` installed with `uv tool install` there is not found. Fixture scripts run outside the sandbox, so `add-bar-reference` works. The agent case needs Bash to run `pbir` and write files; run it as a normal Claude Code session in a scratch copy of the fixture, and grade that copy with `check-gate.py` and the rubric graders.
