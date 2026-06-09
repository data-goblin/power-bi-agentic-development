# Date tables and time intelligence

Companion to the `semantic-model` skill (SKILL.md). Original guidance; each section cites its sources.

**Working with `te`:** mark the date table via `te script` (TOM `DataCategory="Time"`, key column `IsKey`); add TI measures with `te add measure ... --save` and validate by executing them with `te query`. Calendar (Enhanced TI) objects TOM cannot reach drop to TMDL (the `tmdl` skill).

## Classic vs calendar-based time intelligence (which engine the model commits to)

Power BI ships two time-intelligence engines and a model effectively commits to one. Classic uses a marked date table plus functions like `SAMEPERIODLASTYEAR('Date'[Date])`. Calendar-based (the Enhanced DAX TI preview) adds a `calendar` object onto a table; functions reference it by name, e.g. `TOTALYTD([Sales], 'Fiscal Calendar')`, and the engine reads the underlying period columns as-is rather than assuming Gregorian.

The choice changes the measure DAX and the metadata, and the two are not interchangeable mid-model without rewriting every TI measure:
- Classic assumes Gregorian or shifted-Gregorian (a July-start fiscal year with Gregorian month boundaries), cannot do week math, and throws on any gap between first and last date. Calendar-based handles 4-4-5/4-5-4/5-4-4, 13-month, lunar, ISO-week, and tolerates sparse dates
- Calendar-based adds context-clearing semantics with no classic equivalent: `DATEADD` and `SAMEPERIODLASTYEAR` are "fixed" (lateral shift, keep all context); every other TI function is "flexible" (clears context on time-related columns). So the same `PARALLELPERIOD` returns different results depending only on whether a column was tagged time-related ; reason about it explicitly
- Calendar-based cannot be used with live-connected or composite models, and (mid-2026) calendars are authored only in Desktop or external tools/TMDL, not the service. Auto-date/time must not coexist; RLS on a calendar-defining fact can surprise

`te` edits whatever the running engine supports via TOM ; set the classic marking (`DataCategory="Time"`, key column `IsKey`/`DateTime`) in one scripted pass. The `calendar` object is newer than most TOM surfaces expose; if `te`/TOM cannot create it, that is the case to drop to TMDL (`calendarColumnGroup` blocks under the table, an uncategorized group tagging a column as time-related). Validate by executing a TI function that exercises the calendar ; a missing-category error surfaces at query time, not save time. Do not mix reference styles in one calculation; calendar-based functions cannot be nested (rewrite `PREVIOUSDAY(PREVIOUSMONTH(...))` as `CALCULATETABLE(PREVIOUSDAY(...), PREVIOUSMONTH(...))`); `DATEADD` gains extension/truncation params under calendars that IntelliSense does not surface.

Sources: learn.microsoft.com desktop-time-intelligence; learn.microsoft.com time-intelligence-functions-dax; repo connect-pbid calendar-column-groups

## DataCategory="Time" is not "Mark as Date Table" (the surrogate-key trap)

Two settings get conflated. `DataCategory="Time"` plus `IsKey=true` on the date column (what the in-repo `mark-as-date-table.csx` sets) is not the same as Desktop's "Mark as date table," which records a separate table-level marking that classic TI uses to resolve a bare `'Date'[Date]` reference. A table can carry `DataCategory="Time"` and still not be a marked date table.

This bites when the date dimension joins the fact on an **integer surrogate key** (`yyyymmdd`), the norm for warehouse star schemas. The relationship column is then not the Date-typed column, so classic TI has no Date-typed relationship to traverse, and Microsoft is explicit: you must mark the date table here or TI silently misbehaves or returns blanks. Auto-detection does not save you. Other forced-mark triggers: any classic TI use, and Excel PivotTable date filters over the published model.

Setting `DataCategory="Time"` and walking away looks correct in the model tree and passes `te validate`, but TI still returns wrong numbers (blank or unshifted, never an error) when the join is on the integer key. Verify which column carries the marking and the relationship column's type via `INFO.VIEW.RELATIONSHIPS()`. If the relationship is on `Date[DateKey]` (Int64) not `Date[Date]` (DateTime): either relate on `Date[Date]` and keep `DateKey` as a hidden degenerate, then mark; or switch the relevant measures to calendar-based TI, which reads the calendar's date-category column directly and does not depend on the relationship column type. The marked date key must be unique, blank-free, contiguous, span full years (a fiscal year counts), and Date/Time columns need an identical timestamp on every row.

Sources: learn.microsoft.com desktop-date-tables (when-you-must-mark); learn.microsoft.com specify-mark-as-date-table; learn.microsoft.com model-date-tables; repo mark-as-date-table.csx

## Week-based and 4-4-5 fiscal time intelligence (why classic functions return wrong answers)

Retail/manufacturing calendars (4-4-5, 4-5-4, 5-4-4, ISO weeks) define a year as a whole number of weeks so quarters hold equal working days and compare directly; boundaries do not align with Gregorian months. Shifted-Gregorian fiscal years (July start, Gregorian months) are fine for classic TI; this is the genuinely non-Gregorian case. Classic functions do not error here, they return wrong numbers, which is worse. `SAMEPERIODLASTYEAR` assumes a given day maps to the same period across years; in a week calendar it does not (Jan 1-2 2011 belong to ISO week 52 of 2010), so YoY built on the date axis silently misaligns and drifts year over year.

Two approaches in preference order:
1. **Calendar-based TI** (preferred where available): tag week categories on a `calendar` object and let `TOTALWTD`/`TOTALYTD([Sales], 'ISO-454')` operate on the real period columns. The engine needs enough categories to walk up to a year (e.g. {Week}, or {Week of Year, Year}, or {Week of Quarter, Quarter}); too few errors at query time
2. **Custom DAX with offset columns** (any engine, including pre-preview, composite, live-connected): the date table carries integer columns linearizing the fiscal structure (`Fiscal Day Of Year`, fiscal Year/Week/Quarter). YoY matches ordinal position, not calendar date, via `TREATAS(VALUES('Date'[Fiscal Day Of Year]), 'Date'[Fiscal Day Of Year])` under a prior-fiscal-year filter; fiscal-YTD is a running filter on the within-year offset (`'Date'[Fiscal Day Of Year] <= MAX(...)`), not `DATESYTD`

Compute offset columns upstream (source or Power Query) per the push-row-work-upstream rule; Microsoft cautions they bloat models if overused, so add only the few you query. Add the measures with full metadata (DisplayFolder, FormatString, Description) in one `te script` pass, then `te validate` and execute before saving. A 53-week vs 52-week year leaves the last offsets of a long year with no prior-year counterpart (blank is correct); a primary period column must sort correctly across years (`yyyy-mm`, or Sort By Column); a wrong week-TI number looks plausible, so validate against a hand-computed period.

Sources: SQLBI week-based-time-intelligence-in-dax; learn.microsoft.com desktop-time-intelligence (calendar-based preview); learn.microsoft.com model-date-tables; repo SpaceParts Date.tmdl
