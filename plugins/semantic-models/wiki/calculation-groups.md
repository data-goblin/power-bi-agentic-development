---
title: Calculation group traps
summary: Precedence, sideways recursion, selection expressions and the variant data type trap, with the te commands that set each.
kind: gotcha
status: current
sources:
  - url: https://learn.microsoft.com/en-us/power-bi/transform-model/calculation-groups
  - url: https://learn.microsoft.com/en-us/analysis-services/tabular-models/calculation-groups
tools:
  te: 0.8.1.1
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
verified_by:
  - te validate -m plugins/semantic-models/wiki/examples/calc-group-format --errors-only
skills: [semantic-models/semantic-model]
---

# Calculation group traps

Learn covers creating groups, items and dynamic format strings. This page keeps what bites in review.

## The variant trap

As soon as any calculation group exists, every measure in reports has the variant data type; removing all groups reverts it (Learn). Two failures follow:

- A dynamic format string that reuses another measure shows an error. Wrap the reused measure: `FORMAT([Dynamic format string], "")`, or move the shared logic into a DAX user-defined function
- A calculation item that does arithmetic on a text measure (dynamic titles) fails with `Cannot convert value ... of type Text to type Numeric`. Guard it: `IF ( ISNUMERIC ( SELECTEDMEASURE () ), SELECTEDMEASURE () * 2, SELECTEDMEASURE () )`

The failure shows in report visuals, not in the model, so check text and title measures whenever a model has a group.

## Precedence

- When two groups both have an item in filter context, the item of the group with the higher `precedence` is the outer wrapper; each `SELECTEDMEASURE()` is replaced by the next lower item. The result depends on order: `*2` over `+2` on a measure of 10 gives 24, not 14
- Precedence is on the group (`CalculationGroupPrecedence`), not the per-item `Ordinal`, which is only sort order
- Only the highest-precedence group's dynamic format string applies

```bash
te get "Variants" --properties          # shows CalculationGroupPrecedence, MultipleOrEmptySelectionExpression, NoSelectionExpression
te set "Variants" -p CalculationGroupPrecedence=20 --save
```

## Selection expressions

Without `MultipleOrEmptySelectionExpression`, a multi-select returns the unfiltered base measure with no signal. Set it (and its own `MultipleOrEmptySelectionFormatStringExpression`) to return a deliberate value. `NoSelectionExpression` applies when the group is unfiltered. A single valid selection never triggers either. The model property `SelectionExpressionBehavior` (Automatic, Visual, NonVisual) changes existing report numbers: baseline key measures with `te test snapshot` before and after.

## Sideways recursion

An item may call another item of the same group by overriding the group column inside `CALCULATE` with the item name as a literal (`'Variants'[Name] = "Plain"`); this is the only supported recursion. Renaming a base item means editing every item that names it. An item cannot call itself.

## Creation

Items apply only to explicit measures, so Desktop turns on `DiscourageImplicitMeasures` when the first group is added. With `te` do it yourself: `te set . -p DiscourageImplicitMeasures=true --save`.

Verified example: [examples/calc-group-format](examples/calc-group-format/tables/Variants.tmdl) is a te-made model with a group, a plain item and a guarded item with a dynamic format string.
