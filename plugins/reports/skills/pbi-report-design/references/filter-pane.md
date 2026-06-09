# Filter Pane Information Architecture

The decisions behind a filter pane are distinct from its color and chrome. Three core decisions per filter card: should it be locked, hidden, or visible? What should it be called? Where in the card order does it sit?

## Lock vs Hide

These encode different intents and are not interchangeable:

- Lock: keeps a filter card visible but read-only. Use for scope guards the reader should know about ("Region = EMEA", "Status = Active"). The reader can see why numbers are filtered.
- Hide: removes the card entirely. Use for data-cleanup filters (exclude nulls, exclude test SKUs). These exist to prevent junk from appearing; the reader does not need to know about them.

Rule: **lock to inform, hide to clean.** Never hide a business filter the reader expects to see; they will not know why the numbers look filtered.

## Renaming Filter Cards

The card title is editable independently of the field it filters; renaming does not rename the model field. Replace jargon field names like `D_SHOP[Reporting Row Name]` with a readable label like "Report Line". Renamed cards do not automatically rename matching slicers; rename the slicer header too.

## Card Order

The pane always groups cards by scope: report-level, then page-level, then visual-level. Custom ordering is only possible within a scope level. If a page-level filter needs to be the reader's first reach, promote it to a slicer on the canvas.

## Applied vs Available Card Styling

A filter card's Applied state (a filter is set) should be visually distinct from Available (no value set). This is the built-in restatement mechanism; readers scanning the pane can tell at a glance what is active. Set distinct styles in the theme via the `$id` discriminator (`Available`/`Applied`); see the `modifying-theme-json` skill for the `filterCard` theme pattern.

## Report-Level Settings

These persist in the report definition and affect all readers:

- Search in filter pane: leave on when the pane has many cards; turn off on a curated 2-3 card pane
- Allow users to change filter types: off when a card is deliberately set to Top-N or relative-date (prevent readers from overriding it)
- Apply filters button: on for slow DirectQuery or large Import models where instant feedback creates multiple unnecessary queries; off for snappy Import models where immediate cross-filter is the better experience

## Pitfalls

- Hiding a business filter removes the reader's ability to see why numbers look filtered; lock it instead
- Publish-to-web does not render the filter pane at all; move essential filters to on-canvas slicers
- Renaming a filter card does not propagate to slicers on the same field; update both
