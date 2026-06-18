# The Design Brief: Lock and Hand Off

A design brief is one approved spec the flow emits and freezes before any pbir mutation. It does not re-elicit requirements; it consolidates what `AskUserQuestion` and `references/vague-prompts.md` already surfaced into a single reviewable object, then becomes the contract every build step executes against.

Think of the brief as a thin lock-and-handoff layer sitting on top of the requirements gathering this skill already does. Revising the brief is cheap; rebuilding bound visuals is not. So the brief exists to catch scope and identity decisions while they are still words, not visuals.

## When to assemble the brief

After Step 1 (Understand the Business Process) and after any vague-prompt questioning from `references/vague-prompts.md`. By this point the audience, purpose, candidate measures, and any style direction are already on the table. The brief writes them down, fills the remaining fields, and presents the whole thing once for approval.

## The brief template

Fill this single block, then present it for approval. Keep every field concrete; if a field is still a guess, mark it and flag the guess to the user.

```yaml
audience: who reads this and what they already know
purpose: the one outcome this report exists to drive

decision_questions:        # 2 to 5; the questions a viewer answers at a glance
  - are we ahead of last year and where
  - which accounts are dragging margin
  - what changed since last week

pages:                     # one job per page
  - name: Overview
    intent: show whether we are on track this period and flag what is off
    serves: [are we ahead of last year and where, what changed since last week]
  - name: Margin Detail
    intent: locate where margin is leaking by account and product
    serves: [which accounts are dragging margin]

design_identity:           # committed once here; propagates to every visual
  tone: quiet analytical    # the feeling and restraint stance
  signature:                # the few repeated, recognizable choices
    accent: single accent reserved for the focus measure
    kpi: value over target, variance shown as a small inline figure
    titles: subject on the page, differentiator on the visual
    spacing: equal gaps and margins arithmetically derived

delivery_target:           # where and how it is consumed
  surface: Fabric workspace app
  page_size: 1280x720
  mobile: not required
```

## How to fill each field

Pull most of this straight from answers already collected; do not start a fresh interview.

### audience and purpose

Lift these from the Step 1 exploration and the vague-prompt answers. Audience sets the detail level (a board wants summary, an analyst wants granularity). Purpose is the single outcome, stated in one line.

### decision_questions

This operationalizes the existing "what decisions does this report support" prompt into a written, checkable list. Name 2 to 5 concrete questions a viewer should answer at a glance. Every page and visual must trace back to at least one; if a visual serves no decision question, it is decoration and gets cut. These questions also drive measure and chart choice downstream.

### pages and page intent

Give each page one sentence naming the single job it does and which decision question(s) it serves. One job per page; this is what prevents a page that is just "more charts." Do not resolve layout here. How an intent maps to a concrete layout (the detail gradient, the 3-30-300 reasoning, visual count, spacing) is owned by the `pbi-report-design` skill. Route the page intent there when building.

### design_identity (tone plus signature)

Commit the design identity once, in the brief, so it propagates to every visual instead of being decided ad hoc per chart.

- tone is the overall feeling and restraint stance; for example quiet-analytical versus high-contrast-executive
- signature is the small set of repeated, recognizable choices that make the report look deliberate: where the accent color is allowed, how KPIs are treated, the title pattern, the spacing rhythm

Set these by routing to the `pbi-report-design` skill for the identity concept. That skill owns the design canon (encoding hierarchy, color discipline, chart vocabulary, layout). Reference it by concept; do not restate the canon here.

### delivery_target

Capture where and how the report is consumed before sizing any page: a Fabric workspace app, an embedded surface, a desktop review, or mobile. The surface constrains page size, the slicer-versus-filter-pane choice, and whether a mobile layout subset is needed. These are all cheaper to decide before building than after.

## The approval gate (lock)

Present the assembled brief as text, then confirm it with a single `AskUserQuestion` carrying the decision only (approve, or name the field to change); its options stay short, the brief itself is the text above them. On approval, treat the brief as frozen.

Frozen means the build steps execute against it without re-litigating scope. If the user later changes scope, do not silently drift the visuals; re-open the brief, amend it, and re-confirm the changed fields. Re-opening the brief is the cheap path; rebuilding bound visuals is the expensive one. This is the same propose-before-building principle the skill already follows, made into an explicit lock.

## Routing: what the approved brief hands off to

The approved brief is the handoff payload between the plan phase and the build phase. It flows:

```
locked brief
  -> pbi-report-design        # commit identity; map each page intent to a layout
  -> build steps (this SKILL.md)
       create report -> pages -> visuals -> bind -> format -> validate -> publish
```

The build steps already exist in `SKILL.md` and are not rewritten by the brief. The brief simply tells them what to build: which pages, each page's job, which decision questions each visual must answer, and the committed identity every visual inherits.
