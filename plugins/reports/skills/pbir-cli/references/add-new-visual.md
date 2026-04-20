# Adding Visuals to Reports

Complete workflow for creating visuals, binding data, and positioning them on pages.

## Workflow: Adding a Visual

### 1. Read the Page Layout

Understand existing visuals' positions and sizes to plan placement. Ensure no overlap and equal spacing.

```bash
pbir tree "Report.Report" -v                     # See all visuals with fields
pbir cat "Report.Report/Page.Page"               # Full page JSON (positions, sizes)
pbir get "Report.Report/Page.Page"               # Page dimensions (width, height)
```

### 2. Check the Model for Field Names

Verify correct table and field names from the connected model. Never guess or invent field names.

```bash
pbir model "Report.Report" -d                    # All tables, columns, measures
pbir model "Report.Report" -d -t Sales           # Filter to specific table
pbir fields list "Report.Report"                 # Fields already used in report
pbir model "Report.Report" -q "EVALUATE VALUES('Sales'[Region])"  # Verify values
```

### 3. Check the Theme

Understand default formatting that will apply. Prefer theme-level formatting over bespoke visual formatting.

```bash
pbir theme colors "Report.Report"                # Color palette
pbir theme text-classes "Report.Report"          # Text style defaults
pbir visuals format "Report.Report/Page.Page/ExistingVisual.Visual"  # See what theme provides
```

If the user requests formatting not in the theme, **use `AskUserQuestion`** to discuss whether this should apply to all visuals of this type (set in theme) or just this one (bespoke). Understanding their design intent avoids rework.

### 4. Consider Visual Type

Reflect on whether the visual can be made with core Power BI visuals. For instance:
- A "Bullet Chart" can technically be a Bar chart with Error bars as targets, but this is not ideal
- A line chart with the latest data point labelled requires an extension measure that conditionally returns a value only on the latest point and BLANK() otherwise

In these cases, **use `AskUserQuestion`** to discuss the trade-offs: Deneb/R/Python visuals offer more flexibility and customization but may take multiple iterations and are harder to maintain. Walk through the options with the user before committing to an approach.

### 5. Gather Requirements

**Use `AskUserQuestion`** to interview the user before creating. Understand:
- What question should this visual answer? What comparison or trend matters?
- Which fields capture the user's intent? (Show model fields and discuss options)
- How does this visual relate to others on the page? (Context, detail, filter, KPI)
- Any specific formatting or interaction requirements?

These answers determine visual type, field bindings, position, and size.

### 6. Create the Visual

```bash
# Basic creation with title and data
pbir add visual card "Report.Report/Page.Page" --title "Revenue" \
  -d "Values:Sales.Revenue" --x 20 --y 20 --width 280 --height 140

# Chart with position
pbir add visual lineChart "Report.Report/Page.Page" --title "Trend" \
  --x 20 --y 180 --width 600 --height 400

# Custom name
pbir add visual tableEx "Report.Report/Page.Page" \
  --name "detail-table" --title "Order Details"

# List all available types
pbir add visual --list
```

### 7. Bind Additional Fields

```bash
# Show available roles
pbir visuals bind "Report.Report/Page.Page/Visual.Visual" --list-roles

# Add fields
pbir visuals bind "Visual.Visual" -a "Category:Date.Month"
pbir visuals bind "Visual.Visual" -a "Y:Sales.Revenue" -t Measure
pbir visuals bind "Visual.Visual" -a "Legend:Products.Category" -t Column

# Verify bindings
pbir visuals bind "Visual.Visual" --show
```

### 8. Set Sort Order

Always set an intentional sort order. Unsorted visuals default to alphabetical or insertion order, which rarely matches user expectations. Charts and tables should sort by the primary measure descending unless a natural order exists (e.g., time series ascending).

```bash
pbir visuals sort "Visual.Visual" -f "Sales.Revenue" -d Descending
pbir visuals sort "Visual.Visual" -f "Date.CalendarMonth" -d Ascending  # Time series
```

### 9. Format (If Needed Beyond Theme)

```bash
pbir visuals title "Visual.Visual" --fontSize 14 --bold --show
pbir visuals border "Visual.Visual" --show --radius 8
```

### 10. Validate

Run `pbir validate` after every visual addition or formatting change.

```bash
pbir validate "Report.Report"                    # Check integrity
pbir tree "Report.Report" -v                     # Verify structure and field bindings
```

## Visual Types and Data Roles

Key types and their primary data roles:
- **card**: Values
- **cardVisual**: Data
- **kpi**: Indicator (TrendLine, Goal)
- **lineChart / barChart / columnChart**: Category, Y (Legend, SmallMultiples)
- **clusteredBarChart / clusteredColumnChart**: Category, Y (Legend, SmallMultiples)
- **lineClusteredColumnComboChart**: Category, ColumnY, LineY (Legend)
- **tableEx**: Values
- **pivotTable** (matrix): Values (Rows, Columns)
- **slicer / advancedSlicerVisual**: Values
- **donutChart / pieChart**: Category, Values (Legend)
- **scatterChart**: X, Y (Category, Size, Legend)
- **treemap**: Category, Values (Details)
- **gauge**: Value (TargetValue, MinValue, MaxValue)
- **map / filledMap**: Location (Size/Values, Legend)
- **textbox / image**: no data roles

## Bulk Creation from JSON (CI/Pipeline Use)

The `--from-json` flag exists for non-interactive use (CI pipelines, pre-generated specs):

```bash
pbir add visual "Report.Report/Page.Page" --from-json visuals.json
```

## Title and Subtitle Textboxes

```bash
pbir add title "Report.Report/Page.Page" "Sales Dashboard"
pbir add subtitle "Report.Report/Page.Page" "Q4 2025 Performance"
```

## Layout Patterns

### KPI Row (4 cards)
```bash
pbir add visual card "Page.Page" --title "Revenue" -d "Values:Sales.Revenue" --x 20 --y 20 --width 290 --height 140
pbir add visual card "Page.Page" --title "Orders" -d "Values:Orders.Count" --x 330 --y 20 --width 290 --height 140
pbir add visual card "Page.Page" --title "Margin" -d "Values:Sales.Margin" --x 640 --y 20 --width 290 --height 140
pbir add visual card "Page.Page" --title "Customers" -d "Values:Customers.Count" --x 950 --y 20 --width 290 --height 140
```

### Full-Width Chart
```bash
pbir add visual lineChart "Page.Page" --title "Trend" --x 20 --y 180 --width 1240 --height 400
```

### Two-Column
```bash
pbir add visual barChart "Page.Page" --title "By Category" --x 20 --y 180 --width 610 --height 400
pbir add visual tableEx "Page.Page" --title "Detail" --x 650 --y 180 --width 610 --height 400
```

## Copying and Moving

```bash
pbir cp "R.Report/P1.Page/Visual.Visual" "R.Report/P2.Page/Visual.Visual"
pbir mv "R.Report/P.Page/Old.Visual" "R.Report/P.Page/New.Visual"
pbir rm "Report.Report/Page.Page/Visual.Visual" -f
```
