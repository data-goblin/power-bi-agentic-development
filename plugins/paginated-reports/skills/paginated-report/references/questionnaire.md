# Requirements Interview

This is a guide for gathering requirements before building a paginated report, not a form to read out. Run it as a dynamic, two-way interview: ask, listen, follow the threads that matter, go deeper where the answer is consequential, and skip what is already obvious or known. The goal is to understand the job well enough to build the right report on the first pass, because a paginated report's data source, parameters, and delivery format are expensive to change once built.

The topics below are prompts for the *kinds* of things to uncover. They are illustrative, not exhaustive and not a checklist; adapt them to the project in front of you, and ask whatever else the situation calls for.

## How to run it

- **Make it a conversation.** `AskUserQuestion` is one tool, best for discrete choices with a few options. Mix it with plain back-and-forth, proposals, and follow-ups. Do not dump a long list of questions at once; ask a focused batch, react to the answers, and let them steer the next questions.
- **Research in parallel so the user does less spelling-out.** Before or between questions, go find what you can: inspect the data source (use `semantic-models:dax` or `reports:pbir-cli` to list tables/columns/measures and run candidate queries), read a similar `.rdl` from `references/example-reports.md`, check Microsoft Learn for anything you are unsure of, look at any file or screenshot the user has. Then bring findings back as concrete prompts ("the model exposes these measures and a Date table; which of these belong on the report?") instead of open-ended asks.
- **Propose, don't just elicit.** Offer a sensible option or a small draft and ask the user to react. A concrete artifact gets sharper feedback than an abstract question. Prototype the layout against an Enter Data dataset early and show it: "is this the right shape and grain?" Iterate from there.
- **Reflect back a short brief** (purpose, audience, source, key content, parameters, output, target workspace) and confirm it before building. Treat scope changes after that as re-opening the brief, not silent drift.
- **Know when you have enough.** Once the essentials are settled (what it is for, what data it draws on, and where it will be published and run), start building and refine the rest as the draft takes shape. Do not stall the whole project on a minor unknown; note assumptions and move.

## What to uncover

Explore these areas, going only as deep as each one warrants for this report:

- **Purpose and success.** What decision or task does it serve? What does a good version let the reader do? What would make it a failure?
- **Audience and consumption.** Who reads it, how many, internal or external? Do they view it in the service, get an emailed PDF, export to Excel, or print it? One shared report, or one document per recipient (bursting)?
- **The data.** Which source (semantic model, SQL, Analysis Services, Dataverse, other, or Enter Data for a mockup)? Research it rather than only asking: confirm the real table/column/measure names, the grain, and rough volume. For a semantic model, get the workspace and model (and dataset GUID); for SQL, the server/database, auth, and whether it is on-premises. Author and verify any DAX with the `dax` skill before it goes in the report.
- **Content, layout, pagination.** What is the core content (detail table, matrix, list of blocks, chart, KPIs)? Grouping, sorting, subtotals? Page size and orientation, print-faithful or screen-first? What belongs in the header/footer? Is there a mockup or an existing report to mirror?
- **Parameters and filters.** What should the reader be able to choose, and which are fixed? Single- or multi-select, defaults, cascading? (Single-value `TREATAS` is robust; multi-select needs the fragile `RSCustomDaxFilter`, see `references/data-sources.md`.)
- **Design.** Brand, theme, specific colors and fonts, a corporate template or logo to match, and the intended tone (dense operational vs polished executive).
- **Output and distribution.** Delivery formats (PDF, Excel, Word, print, accessible PDF), how it reaches people (subscription, app, embed, Power Automate, manual export), and any schedule.
- **Environment, access, constraints.** Target workspace and whether it is on Premium/Embedded/Fabric capacity (required to run). Does the user have Power BI Report Builder installed, or is this fully code-authored? Is a local PBIRS available for the dev loop? Can they publish to the workspace? Any RLS to honor, a gateway for on-prem sources, deadlines, localization, accessibility, retention, or who maintains it afterward?

When something here does not apply, drop it; when something not listed matters for this report, pursue it. The point is to leave the interview able to do the job well, not to have asked a fixed set of questions.

## Reasonable fallbacks (only when the user genuinely defers)

Portrait Letter with 0.5in margins; a single-value, dataset-driven parameter with a dropdown; PDF viewed from the service; a clean single-accent design in Segoe UI with the active parameter echoed in the header; prototype with Enter Data, then swap in the real source. State any assumption you fall back on.
