# Designing a Paginated Report

Paginated reports are not interactive dashboards laid out on paper. They exist to produce a precise, print-faithful, multi-page document: an invoice, a statement, an operational list, a regulatory filing, a packing slip. Design decisions follow from "this will be printed or exported to PDF/Excel at a fixed width, possibly across thousands of pages," not from "this fills a 16:9 canvas." Generic visual-design principles live in the `reports:pbi-report-design` skill; this reference covers what is specific to RDL and pagination.

## First decide: is a paginated report even the right tool?

Choose paginated (RDL) when the deliverable needs any of: pixel-perfect print/PDF output, every detail row printed (not sampled or aggregated for screen), a fixed page format (letterhead, legal margins), per-recipient bursting/subscriptions, export to Excel/Word/CSV as a first-class output, or row counts that would choke an interactive visual. Choose an interactive Power BI report (PBIR) when the deliverable is exploratory, screen-first, and cross-filtered. If the user wants "a dashboard," they almost certainly want PBIR; route them to `reports:create-pbi-report`.

## Start from the page, not the data

Lock the physical frame before placing anything:

- **Orientation and size.** Portrait Letter (`8.5in x 11in`) for documents; landscape Letter (`11in x 8.5in`) for wide tables; A4 (`21cm x 29.7cm`) outside North America. Set `PageHeight`/`PageWidth` accordingly.
- **Margins.** Typical `0.5in` to `1in` all round. They reduce usable width on hard renderers.
- **Usable body width = PageWidth - LeftMargin - RightMargin.** Keep body `<Width>` at or under this or PDF emits blank pages (the width trap, see `references/renderers.md`). Landscape Letter with 0.5in margins gives 10in of usable width; size all top-level items to fit inside it.

Everything downstream (column widths, font sizes, how many columns fit) is constrained by this frame. Decide it first.

## The structural skeleton

A well-formed paginated report is built from a small, repeatable set of regions:

```
Page header   logo, report title, run date (=Globals!ExecutionTime), parameter echo. Repeats every page.
Body          one or more data regions (tablix/chart) plus static labels.
Page footer   page number (=Globals!PageNumber & " of " & Globals!TotalPages), confidentiality, source.
```

- Put anything that must appear on every printed page (page numbers, run timestamp, "Commercial in confidence") in the **page header/footer**, because only those regions may use `Globals!PageNumber`/`TotalPages`.
- Put the report title and the selected-parameter summary in the header so a printed page is self-describing.
- Keep the body to the data regions and their immediate labels.

## Choosing the data region

- **Table** (tablix, static columns): fixed set of columns, one row per detail record. Invoices line items, transaction lists.
- **Matrix** (tablix, column group): columns generated from data (months across, categories across). Cross-tabs, period comparisons.
- **List** (tablix, single cell repeated): free-form repeating layout, one instance per group. Form letters, per-customer statement blocks, label sheets.
- **Chart**: summary visuals; in paginated reports usually a supporting element above or beside a table, or a per-group sparkline inside a tablix cell.

All four are the same `<Tablix>` element with different hierarchies (see `references/rdl-format.md`); choose by data shape, not by a separate control.

## Make pagination deliberate

Pagination is the whole point; do not leave it to chance.

- Group the body by the natural document unit (customer, invoice, region) and set a page break `Between` or at `End` of that group so each unit starts cleanly. For bursting/subscriptions, the group is the recipient.
- Use `KeepWithGroup`/`RepeatOnNewPage` so group headers and column headers repeat at the top of every continuation page; a table that spills across pages with no header is unreadable in print.
- Use `KeepTogether` on blocks that must not split (an address block, a signature block).
- Name pages with `PageName` when exporting to Excel so each group lands on its own worksheet tab.
- Test pagination by exporting to the actual delivery format, not by previewing in HTML.

## Parameters: the part that is fiddly

Parameter wiring is the most error-prone part of authoring and the most common source of frustration. Three pieces must agree:

1. The **report parameter** (`<ReportParameter>`): its `DataType`, whether it is `MultiValue`/`Nullable`, its `ValidValues` (often a small dataset that lists the choices), and its `DefaultValue`.
2. The **dataset query parameter** (`<QueryParameter Name="@x">`) whose `<Value>` is `=Parameters!ReportParam.Value`.
3. The **query itself** referencing `@x` (SQL `WHERE`/`IN`, or DAX via `TREATAS({ @x }, ...)`).

Design guidance:

- Give every parameter a sensible `DefaultValue` so the report renders on open without forcing a selection. Dataset-driven defaults (e.g. latest date) keep it current.
- Back dropdowns with a dedicated small dataset (`ValidValues` -> `DataSetReference`), not a hand-typed list, so choices stay in sync with the data.
- Keep cascading parameters shallow. Each cascade level is a separate query on every change and is slow in the service (see `references/renderers.md`).
- Echo the active selection into the page header (`=Parameters!Region.Value`) so a printed copy records what it was filtered to.
- Author the DAX with the `semantic-models:dax` skill against the live model first; do not hand-roll it. For a semantic model, a single-value parameter via `TREATAS({ @x }, 'Table'[Col])` is the robust, render-proven pattern; multi-select needs the fragile `RSCustomDaxFilter` construct (see `references/data-sources.md`).
- Lay out the prompt pane with `<ReportParametersLayout>` so related parameters group logically; parameters omitted from it are hidden from the user.

## Working from a mockup or screenshot

When given a mockup, screenshot, or "make it look like this":

1. Establish the page frame (size, orientation, margins) from the proportions shown.
2. Identify the repeating region (the table/matrix/list) versus the static chrome (title, logo, totals).
3. Map each labelled value to a field or expression; decide which come from the query and which are computed.
4. Start from the closest template asset (`enter-data-starter.rdl` for a self-contained draft, `semantic-model-starter.rdl` or `sql-starter.rdl` for a real source) and iterate the layout against Enter Data before wiring the live source. Iterating layout with a fixed inline dataset is far faster than re-querying a source on every change.

## Reuse over re-authoring

The fastest reliable way to a new report is to copy a known-good `.rdl` and change the data source, dataset query, fields, and layout, rather than hand-typing the verbose XML (charts especially). The template assets exist for exactly this. Note the starters are sized to the full usable width (7.5in body inside a portrait-Letter page with 0.5in margins), so if you add or widen a column, also widen the page or shrink the margins to stay within the usable width, or hard renderers emit blank pages (the PDF width trap). After any structural edit, run `scripts/validate_rdl.py` before publishing; the cheap structural checks (element order, name collisions, tablix counts) catch the breakage hand-editing introduces.
