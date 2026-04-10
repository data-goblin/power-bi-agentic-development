# Visual Groups

Visual groups bind multiple visuals so they move and scale together on a page. Use them for header strips, KPI rows, chart-plus-annotation pairs, or any cluster of visuals that should behave as a unit.

A group is itself a special visual on the page. Its members are normal visuals tagged with the group as their parent. Position and size on the group propagate to members under the chosen mode (default `ScaleMode`).

## Inspect

```bash
pbir visuals group "Report.Report/Page.Page" --list
```

Lists every group on the page, with member counts and current mode.

## Create

```bash
pbir visuals group "Report.Report/Page.Page" --create "KPI Group"
pbir visuals group "Report.Report/Page.Page" --create "Header" --mode ScaleMode
```

Creates an empty group with the given display name. The group visual lands at the page origin by default; reposition with `pbir visuals position`.

## Add and Remove Members

```bash
pbir visuals group "Report.Report/Page.Page/KPI Group.Visual" --add "Card_Revenue.Visual"
pbir visuals group "Report.Report/Page.Page/KPI Group.Visual" --add "Card_Margin.Visual" --add "Card_Units.Visual"
pbir visuals group "Report.Report/Page.Page/KPI Group.Visual" --remove "Card_Units.Visual"
```

`--add` and `--remove` are repeatable. The path argument is the group visual; the values are member visual names on the same page.

## Ungroup

```bash
# Remove one visual from its group (visual remains on page)
pbir visuals group "Report.Report/Page.Page/Card_Revenue.Visual" --ungroup

# Ungroup all members and delete the group container
pbir visuals group "Report.Report/Page.Page/KPI Group.Visual" --ungroup
```

The behavior of `--ungroup` depends on whether the path points at a member or the group itself.

## When to Use

- Header bands with logo, title, page nav, filters
- KPI rows where cards should scale uniformly across page-size changes
- Chart + caption pairs where the caption should track the chart
- Repeated visual layouts that move together when reordered

## When Not to Use

- Visuals that need independent positioning across pages: use page templates instead
- Layout containment for visual hierarchy: that is a design concern, handled by alignment commands (`pbir visuals align`) and consistent positioning, not by groups

## Validation

`pbir validate "Report.Report"` covers group parent links. If a group references a missing member, validation reports it. Run after every group mutation.
