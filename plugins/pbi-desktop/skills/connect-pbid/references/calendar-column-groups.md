# Calendar Column Groups Reference

Calendar column groups define date hierarchies and time intelligence mappings declaratively on the model, telling the engine which columns represent Year, Quarter, Month, Week, Date, and other time units. This enables automatic time intelligence behaviour in Power BI visuals and DAX functions.

All examples assume `$model` is already connected (see SKILL.md section 3).

> **Compatibility:** Calendar column groups require compatibility level 1604+ and are primarily used in Fabric / Power BI service semantic models. PBI Desktop support may be limited depending on the version.


## Concepts

### Calendar vs Column Group

A **calendar** belongs to a specific table (typically a date table) and contains one or more **column groups**. Each column group maps a physical column to a time unit.

### Time Units

Time units are case-sensitive enum values. Common mistakes: using `Day` instead of `Date`, pluralizing (`Years`), or incorrect casing.

| Time Unit | Description | Example Value |
|---|---|---|
| `Year` | Complete year | `2024` |
| `Quarter` | Complete quarter (includes year) | `Q3 2024` |
| `QuarterOfYear` | Quarter position (1-4) | `3` |
| `Month` | Complete month (includes year) | `January 2024` |
| `MonthOfYear` | Month name/number without year | `January`, `6` |
| `MonthOfQuarter` | Month position within quarter | `2` |
| `Week` | Complete week (includes year) | `2024-W49` |
| `WeekOfYear` | Week number without year | `49` |
| `Date` | Specific date | `2024-01-15` |
| `DayOfYear` | Day position in year (1-366) | `241` |
| `DayOfMonth` | Day of month (1-31) | `23` |
| `DayOfWeek` | Day of week (1-7) | `4` |
| `Unknown` | Time-related but not a standard unit | Used for flags like `IsWeekend` |

### Complete vs Partial Units

- **Complete** units uniquely identify a period: `Year`, `Quarter`, `Month`, `Week`, `Date`. These must include enough context (e.g. year) to be unambiguous.
- **Partial** units are positions within a larger period: `QuarterOfYear`, `MonthOfYear`, `WeekOfYear`, `DayOfMonth`, etc. Use these for labels and slicers, not for hierarchical rollups.

Do not confuse them: `"December 2024"` maps to `Month` (complete); `"December"` maps to `MonthOfYear` (partial).

### Primary vs Associated Columns

Each column group has one **primary column** (the sort/key column) and optionally **associated columns** (display labels). If column A is sorted by column B (via `SortByColumn`), then B should be the primary and A an associated column.

Example: `Year Month Number` (int, primary) + `Year Month` (text, associated) + `Year Month Short` (text, associated).

### Time-Related Groups

Columns that are time-aware but do not represent a standard unit (e.g. `RelativeMonth` with values "Current"/"Previous", `IsWeekend`, `Season`) belong in a **single** time-related group. Do not create separate groups for each; the engine keys by time unit and rejects duplicates.


## Reading Calendar Column Groups

```powershell
# Check if the model has calendars defined
foreach ($t in $model.Tables) {
    if ($t.Calendars -and $t.Calendars.Count -gt 0) {
        foreach ($cal in $t.Calendars) {
            Write-Output "CALENDAR: [$($cal.Name)] on table [$($t.Name)]"
            foreach ($cg in $cal.CalendarColumnGroups) {
                $primary = $cg.PrimaryColumn.Name
                $assoc = ($cg.AssociatedColumns | ForEach-Object { $_.Name }) -join ", "
                Write-Output "  $($cg.TimeUnit): Primary=[$primary] Associated=[$assoc]"
            }
            if ($cal.TimeRelatedGroup) {
                $cols = ($cal.TimeRelatedGroup.Columns | ForEach-Object { $_.Name }) -join ", "
                Write-Output "  TimeRelated: [$cols]"
            }
        }
    }
}
```


## Creating a Gregorian Calendar

Standard Year > Quarter > Month > Date hierarchy:

```powershell
$dateTable = $model.Tables["Date"]

# Create the calendar object
$cal = New-Object Microsoft.AnalysisServices.Tabular.Calendar
$cal.Name = "Gregorian Calendar"

# Year group
$yearGroup = New-Object Microsoft.AnalysisServices.Tabular.CalendarColumnGroup
$yearGroup.TimeUnit = [Microsoft.AnalysisServices.Tabular.TimeUnit]::Year
$yearGroup.PrimaryColumn = $dateTable.Columns["Year"]
$cal.CalendarColumnGroups.Add($yearGroup)

# Quarter group (primary = sort key, associated = display label)
$qtrGroup = New-Object Microsoft.AnalysisServices.Tabular.CalendarColumnGroup
$qtrGroup.TimeUnit = [Microsoft.AnalysisServices.Tabular.TimeUnit]::Quarter
$qtrGroup.PrimaryColumn = $dateTable.Columns["Year Quarter Number"]
$qtrGroup.AssociatedColumns.Add($dateTable.Columns["Year Quarter"])
$cal.CalendarColumnGroups.Add($qtrGroup)

# Month group
$monthGroup = New-Object Microsoft.AnalysisServices.Tabular.CalendarColumnGroup
$monthGroup.TimeUnit = [Microsoft.AnalysisServices.Tabular.TimeUnit]::Month
$monthGroup.PrimaryColumn = $dateTable.Columns["Year Month Number"]
$monthGroup.AssociatedColumns.Add($dateTable.Columns["Year Month"])
$cal.CalendarColumnGroups.Add($monthGroup)

# Date group
$dateGroup = New-Object Microsoft.AnalysisServices.Tabular.CalendarColumnGroup
$dateGroup.TimeUnit = [Microsoft.AnalysisServices.Tabular.TimeUnit]::Date
$dateGroup.PrimaryColumn = $dateTable.Columns["Date"]
$cal.CalendarColumnGroups.Add($dateGroup)

$dateTable.Calendars.Add($cal)
$model.SaveChanges()
```


## Creating a Fiscal Calendar

When the fiscal year differs from the calendar year:

```powershell
$dateTable = $model.Tables["Date"]

$fiscal = New-Object Microsoft.AnalysisServices.Tabular.Calendar
$fiscal.Name = "Fiscal Calendar"

# Fiscal year
$fyGroup = New-Object Microsoft.AnalysisServices.Tabular.CalendarColumnGroup
$fyGroup.TimeUnit = [Microsoft.AnalysisServices.Tabular.TimeUnit]::Year
$fyGroup.PrimaryColumn = $dateTable.Columns["Fiscal Year Number"]
$fyGroup.AssociatedColumns.Add($dateTable.Columns["Fiscal Year Name"])
$fiscal.CalendarColumnGroups.Add($fyGroup)

# Fiscal month (complete; includes fiscal year context)
$fmGroup = New-Object Microsoft.AnalysisServices.Tabular.CalendarColumnGroup
$fmGroup.TimeUnit = [Microsoft.AnalysisServices.Tabular.TimeUnit]::Month
$fmGroup.PrimaryColumn = $dateTable.Columns["Fiscal Year Month Number"]
$fmGroup.AssociatedColumns.Add($dateTable.Columns["Fiscal Year Month"])
$fiscal.CalendarColumnGroups.Add($fmGroup)

# Fiscal month of year (partial; for labels/slicers)
$fmoyGroup = New-Object Microsoft.AnalysisServices.Tabular.CalendarColumnGroup
$fmoyGroup.TimeUnit = [Microsoft.AnalysisServices.Tabular.TimeUnit]::MonthOfYear
$fmoyGroup.PrimaryColumn = $dateTable.Columns["Fiscal Month Number of Year"]
$fmoyGroup.AssociatedColumns.Add($dateTable.Columns["Fiscal Month Name"])
$fiscal.CalendarColumnGroups.Add($fmoyGroup)

# Time-related columns (single group for all non-standard time columns)
$trGroup = New-Object Microsoft.AnalysisServices.Tabular.TimeRelatedGroup
$trGroup.Columns.Add($dateTable.Columns["RelativeMonth"])
$trGroup.Columns.Add($dateTable.Columns["Season"])
$fiscal.TimeRelatedGroup = $trGroup

$dateTable.Calendars.Add($fiscal)
$model.SaveChanges()
```


## ISO Week-Based Calendar (4-4-5)

For week-based calendars, map Period to the `Month` time unit (same hierarchical position). Always pair ISO weeks with ISO year, not Gregorian year.

```powershell
$dateTable = $model.Tables["ISO Date"]

$iso = New-Object Microsoft.AnalysisServices.Tabular.Calendar
$iso.Name = "ISO 4-4-5 Calendar"

# ISO Year
$isoYear = New-Object Microsoft.AnalysisServices.Tabular.CalendarColumnGroup
$isoYear.TimeUnit = [Microsoft.AnalysisServices.Tabular.TimeUnit]::Year
$isoYear.PrimaryColumn = $dateTable.Columns["ISO Year"]
$iso.CalendarColumnGroups.Add($isoYear)

# Period mapped to Month (same hierarchical position)
$period = New-Object Microsoft.AnalysisServices.Tabular.CalendarColumnGroup
$period.TimeUnit = [Microsoft.AnalysisServices.Tabular.TimeUnit]::Month
$period.PrimaryColumn = $dateTable.Columns["Year-Period"]
$iso.CalendarColumnGroups.Add($period)

# Week
$week = New-Object Microsoft.AnalysisServices.Tabular.CalendarColumnGroup
$week.TimeUnit = [Microsoft.AnalysisServices.Tabular.TimeUnit]::Week
$week.PrimaryColumn = $dateTable.Columns["Year-Week"]
$iso.CalendarColumnGroups.Add($week)

# Date
$dateGrp = New-Object Microsoft.AnalysisServices.Tabular.CalendarColumnGroup
$dateGrp.TimeUnit = [Microsoft.AnalysisServices.Tabular.TimeUnit]::Date
$dateGrp.PrimaryColumn = $dateTable.Columns["Date"]
$iso.CalendarColumnGroups.Add($dateGrp)

$dateTable.Calendars.Add($iso)
$model.SaveChanges()
```


## Rules and Constraints

1. **Calendar names must be unique across the entire model**, not just within a table
2. Each calendar uses columns from only its host table
3. Do not repeat a time unit within the same calendar
4. A column must map to the same time unit in every calendar that includes it
5. Do not use the same physical column more than once in the same calendar
6. Only one time-related group per calendar; combine all time-related columns into it
7. Build hierarchies where each level subdivides exactly into the level above
8. For complete units, include year context (e.g. `"January 2024"` for Month, not `"January"`)
9. For ISO/week-based calendars, always use ISO year with ISO week numbers


## Effect on Time Intelligence

With calendar column groups defined, standard DAX time intelligence functions automatically adapt:

- `DATESYTD` uses the calendar's year definition
- `DATESMTD` returns month-to-date (or period-to-date for week-based calendars where Period maps to Month)
- `DATESWTD` returns week-to-date
- `SAMEPERIODLASTYEAR` shifts based on the calendar hierarchy
- `DATEADD` respects the defined periods and supports Extension/Truncation parameters for uneven period lengths
