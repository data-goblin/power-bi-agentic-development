# Filters

Complete guide to creating, managing, and removing filters at report, page, and visual level.

## Creating Filters

### Categorical (default)

```bash
pbir add filter Date "Calendar Year (ie 2021)" -r "Report.Report"
pbir add filter Products Category -p "Report.Report/Page.Page" --values Electronics --values Clothing
pbir add filter Sales Region -v "Report.Report/Page.Page/Visual.Visual"
```

### TopN

Show top/bottom N items ranked by a measure or column:

```bash
pbir add filter Brands Brand -r "Report.Report" \
  --type TopN --n 10 --by-table Invoices --by-field "Net Invoice Value"

# Bottom 5
pbir add filter Brands Brand -r "Report.Report" \
  --type TopN --n 5 --by-table Invoices --by-field "Net Invoice Value" --direction Bottom
```

Required flags: `--n`, `--by-table`, `--by-field`. Optional: `--direction` (Top/Bottom, default Top).

### Advanced

Custom operator-based filters:

```bash
# Greater than
pbir add filter Invoices "Net Invoice Value" -r "Report.Report" \
  --type Advanced --operator GreaterThan --values 1000

# In list
pbir add filter Brands Brand -r "Report.Report" \
  --type Advanced --operator In --values BrandA --values BrandB

# Less than or equal
pbir add filter Invoices "Net Invoice Value" -r "Report.Report" \
  --type Advanced --operator LessThanOrEqual --values 5000
```

Operators: `In`, `NotIn`, `GreaterThan`, `GreaterThanOrEqual`, `LessThan`, `LessThanOrEqual`, `Is`, `IsNot`.

### Relative Date

Filter by relative date periods:

```bash
pbir add filter Date Date -r "Report.Report" --type RelativeDate --period Last30Days
```

Periods: `Last7Days`, `Last14Days`, `Last30Days`, `Last3Months`, `Last6Months`, `Last12Months`, `LastYear`.

## Managing Filters

```bash
pbir filters list "Report.Report"                         # List report filters
pbir filters list "Report.Report/Page.Page"               # List page filters
pbir filters set "Report.Report/filter:Year" --values "2024,2025"  # Set values
pbir filters clear "Report.Report/filter:Year"            # Clear selections
pbir filters hide "Report.Report/filter:Year"             # Hide in view mode
pbir filters lock "Report.Report/filter:Year"             # Lock (users can't change)
pbir filters unlock "Report.Report/filter:Year"           # Unlock
pbir filters json "Report.Report/filter:Year"             # Raw JSON
```

## Removing Filters

```bash
pbir rm "Report.Report/filter:Year" -f
```

## Changing Filter Type

Filter type cannot be changed in place because each type has a different JSON structure. Remove and recreate:

```bash
pbir rm "Report.Report/filter:Brand" -f
pbir add filter Brands Brand -r "Report.Report" --type TopN --n 10 \
  --by-table Invoices --by-field "Net Invoice Value"
```

## Filter Pane Styling

```bash
pbir filters pane-hide "Report.Report/Page.Page"          # Hide filter pane
pbir filters pane-collapse "Report.Report/Page.Page"      # Collapse filter pane
pbir filters pane-get "Report.Report/Page.Page"           # Show pane config
pbir filters pane-set "Report.Report/Page.Page" --background-color "#F0F0F0"
pbir filters pane-card "Report.Report/Page.Page" --border-color "#CCCCCC"
```

## Field Discovery

Always discover field names before creating filters:

```bash
pbir model "Report.Report" -d --use-cache           # All tables
pbir model "Report.Report" -d -t Invoices --use-cache  # Specific table
```
