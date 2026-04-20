# DAX Library Packages (daxlib.org)

daxlib.org is an open-source package registry for DAX User-Defined Functions (UDFs), maintained by SQLBI. It provides reusable, model-independent DAX function libraries installable into any semantic model with compatibility level 1702+.

GitHub: `github.com/daxlib/daxlib` (all published packages).


## Package Structure

Each package in the registry follows this layout:

```
packages/{first-letter-lowercase}/{package.id-lowercase}/{version}/
  manifest.daxlib       # JSON metadata (id, version, authors, description, tags)
  lib/functions.tmdl    # DAX UDF definitions in TMDL format
  README.md             # Optional documentation
  icon.png              # Optional icon
```

Directory names are all-lowercase on GitHub even though the `id` in the manifest is PascalCase (e.g. directory `daxlib.svg` for package `DaxLib.SVG`).

Raw download URLs:

```
https://raw.githubusercontent.com/daxlib/daxlib/main/packages/{letter}/{id-lowercase}/{version}/manifest.daxlib
https://raw.githubusercontent.com/daxlib/daxlib/main/packages/{letter}/{id-lowercase}/{version}/lib/functions.tmdl
```

Version listing via GitHub API:

```
GET https://api.github.com/repos/daxlib/daxlib/contents/packages/{letter}/{id-lowercase}
```


## TMDL Function Format

Functions use standard DAX UDF syntax with package-tracking annotations:

```
/// JSDoc description
/// @param {type} paramName - description
/// @returns {type} description
function 'PackageId.FunctionName' =
    (
        param1: STRING,
        param2: NUMERIC VAL,
        exprParam: SCALAR EXPR,
        refParam: ANYREF EXPR
    ) =>

    VAR _x = ...
    RETURN result

    annotation DAXLIB_PackageId = PackageId
    annotation DAXLIB_PackageVersion = X.Y.Z
```

Parameter modes: `VAL` (eager; evaluated once before call) and `EXPR` (lazy; evaluated inside the function body in the function's context). `EXPR` is required for measure references and context-sensitive expressions.


## Tracking Installed Packages

Every function carries two annotations:

| Annotation | Purpose |
|---|---|
| `DAXLIB_PackageId` | Which package the function belongs to |
| `DAXLIB_PackageVersion` | Which version was installed |

These annotations enable listing, updating, and removing packages programmatically by scanning `$model.UserDefinedFunctions` for matching annotation values.


## daxlib CLI

CLI for managing daxlib packages. Standalone commands (search, browse, download) work on any platform. Model operations (add, update, remove) require PBI Desktop; on macOS these route through Parallels automatically.


### Browsing the Registry (standalone)

```bash
daxlib search <query>                # Search packages by name (substring match)
daxlib info <package>                # Package manifest: authors, description, tags, function count
daxlib info <package> -v <version>   # Specific version info
daxlib versions <package>            # All published versions (newest first; pre-release marked)
daxlib functions <package>           # List every function with parameter signatures
daxlib functions <package> -v <ver>  # Functions for a specific version
```

Uses `gh` CLI (authenticated; 5000 req/hr with `--cache 1h`). Falls back to `curl` if `gh` unavailable.


### Downloading TMDL (standalone)

```bash
daxlib download <package>                          # Latest stable; writes <id>.functions.tmdl
daxlib download <package> -v <version>             # Specific version
daxlib download <package> --fn "Name1,Name2"       # Filter to specific functions only
daxlib download <package> --fn "Element.Rect"      # Suffix match (matches DaxLib.SVG.Element.Rect)
daxlib download <package> -o /path/to/dir          # Output directory (default: cwd)
```


### Installing Packages (requires PBI Desktop)

```bash
daxlib add <package> --port <port>                 # Install full package (latest stable)
daxlib add <package> --port <port> -v <version>    # Specific version
daxlib add <package> --port <port> --fn "Name"     # Install single function only
```

Skips functions that already exist (by name). Each installed function gets `DAXLIB_PackageId` and `DAXLIB_PackageVersion` annotations.

> **CL upgrade warning:** DAX UDFs require compatibility level 1702+. If the model is below 1702, `daxlib add` will upgrade the CL automatically. This is **irreversible**; older tools that don't support CL 1702 won't open the model afterward. Always confirm with the user before running `daxlib add` on a model below CL 1702.


### Updating Packages

```bash
daxlib update <package> --port <port>              # Update to latest stable
daxlib update <package> --port <port> -v <ver>     # Update to specific version
```

Removes all existing functions for the package (matched by `DAXLIB_PackageId` annotation), then installs the new version. User-created functions are never touched.


### Removing Packages or Functions

```bash
daxlib remove <package> --port <port>              # Remove entire package
daxlib remove <package> --port <port> --fn "Name"  # Remove specific function(s) only
```

Package removal uses annotation matching; only functions with `DAXLIB_PackageId` matching the package are removed. Function-by-name removal (`--fn`) uses exact match or `packageId.name` prefix match.


### Listing Installed Packages

```bash
daxlib installed --port <port>
```

Scans all `model.Functions` for `DAXLIB_PackageId` annotations. Groups by package with version and function count. Functions without annotations show under `(no package)`.


### Options Reference

| Flag | Short | Used by | Description |
|---|---|---|---|
| `--port` | `-p` | add, update, remove, installed | PBI Desktop Analysis Services port |
| `--version` | `-v` | info, functions, download, add, update | Package version (default: latest stable) |
| `--fn` | `-f` | download, add, remove | Comma-separated function names; supports suffix match |
| `--output` | `-o` | download | Output directory for TMDL file |
| `--json` | | (reserved) | JSON output |


### Prerequisites

- `gh` CLI authenticated (for registry browsing; falls back to `curl`)
- .NET 8 SDK (for model operations)
- Power BI Desktop open with a model loaded (for add/update/remove/installed)


## Priority Packages

### DaxLib.SVG (v1.0.1)

Composable SVG generation functions for Power BI tables, matrices, and cards. 58 functions across these categories:

| Category | Functions | Purpose |
|---|---|---|
| `DaxLib.SVG.SVG` | 1 | Root SVG container with sort value support |
| `DaxLib.SVG.Element.*` | ~10 | Primitives: Rect, Circle, Line, Text, Polygon, Polyline, Ellipse, Path, Group |
| `DaxLib.SVG.Attr.*` | 3 | Attribute builders: Shapes (fill/opacity), Stroke, Text |
| `DaxLib.SVG.Def.*` | ~5 | Defs: LinearGradient, RadialGradient, GradientStop, ClipPath |
| `DaxLib.SVG.Scale.*` | ~4 | Normalize, NiceNum, NiceRange for axis scaling |
| `DaxLib.SVG.Axes.*` | ~4 | Axis layout, rendering, baseline, tick points |
| `DaxLib.SVG.Color.*` | ~5 | Theme colors, PerformanceTheme, Hex/RGB/Int conversions |
| `DaxLib.SVG.Viz.*` | ~10 | Compound visuals: Bar, Line, Area, ProgressBar, Pill, Boxplot, Jitter, Heatmap, Violin |
| `DaxLib.SVG.Transforms` | 1 | SVG transform attribute builder |

Functions output `data:image/svg+xml;utf8,...` URIs. Set the column's data category to "Image URL" in Power BI to render inline.

**Example: inline bar chart measure**

```dax
Bar Chart =
VAR _Value = [Total Revenue]
VAR _Max = MAXX(ALLSELECTED('Product'[Category]), [Total Revenue])
VAR _Width = 200
VAR _BarWidth = ROUND(_Value / _Max * _Width, 0)
VAR _Bar =
    [DaxLib.SVG.Element.Rect](
        0, 2, _BarWidth, 16, BLANK(),
        [DaxLib.SVG.Attr.Shapes]("#4472C4", BLANK(), BLANK(), BLANK(), BLANK(), BLANK(), BLANK()),
        BLANK(), BLANK()
    )
VAR _Label =
    [DaxLib.SVG.Element.Text](
        _BarWidth + 4, 14, FORMAT(_Value, "$#,0"), BLANK(),
        [DaxLib.SVG.Attr.Txt]("Segoe UI", 11, BLANK(), BLANK(), "start", BLANK(), BLANK(), BLANK(), BLANK()),
        BLANK(), BLANK()
    )
RETURN
    [DaxLib.SVG.SVG]("300", "20", BLANK(), _Bar & _Label, _Value)
```

Docs: `evaluationcontext.github.io/daxlib.svg`
Dev repo: `github.com/daxlib/dev-daxlib-svg`


### PowerofBI.IBCS (v0.11.0)

IBCS (International Business Communication Standards)-guided SVG visualizations. 12 functions for standardized business charts:

| Function | Purpose |
|---|---|
| `BarChart.AbsoluteValues` | Horizontal bar comparing AC vs PY/BU |
| `BarChart.AbsoluteVariance` | Absolute variance bars (AC - PY/BU) |
| `BarChart.RelativeVariance` | Relative variance bars (% change) |
| `ColumnChart.WithWaterfall` | Vertical columns with waterfall bridge |
| `ColumnChart.SmallMultiple` | Small multiple column charts |
| `MultiplierAnalysis` | Multiplicative decomposition chart |
| `Helpers.Title` | IBCS-styled chart title |
| (+ 5 more) | Additional chart types and helpers |

These functions use `EXPR`-type parameters; they accept measure references and dimension columns directly, computing ALLSELECTED scoping internally.

**Example: IBCS bar chart measure**

```dax
IBCS Bar =
[PowerofBI.IBCS.BarChart.AbsoluteValues](
    'Product'[Category],       -- dimension column (ANYREF EXPR)
    [AC],                      -- actuals measure (SCALAR EXPR)
    BLANK(),                   -- forecast (SCALAR EXPR, optional)
    [PY],                      -- base value (SCALAR EXPR)
    "grey",                    -- base styling: "grey" for PY, "outlined" for BU
    FORMAT([AC], "#,0"),       -- data label
    350,                       -- image width (match Format pane)
    35,                        -- image height (match Format pane)
    FALSE()                    -- sync with absolute variance chart
)
```

Docs: `powerofbi.org/ibcs`
Dev repo: `github.com/avatorl/dax-udf-svg-ibcs`


## Using Installed Functions in Measures

Once installed, UDFs are callable from any measure, calculated column, or calculation item in the model:

```dax
-- Call with scalar parameters
[DaxLib.SVG.Element.Rect](x, y, width, height, rx, shapeAttrs, strokeAttrs, extras)

-- Call with EXPR parameters (pass measure/column references directly)
[PowerofBI.IBCS.BarChart.AbsoluteValues]('Dim'[Col], [Measure1], ...)
```

For SVG output: create a measure that returns the SVG URI string, then set the column or measure's data category to **"Image URL"** so Power BI renders it inline. SVG visuals work in Table, Matrix, Card, and Multi-row Card visuals.


## Other Notable Packages

Browse all packages at `daxlib.org`. Some highlights:

| Package | Description |
|---|---|
| `DaxLib.Convert` | Type conversion utilities |
| `DaxLib.FormatString` | Dynamic format string builders |
| `DaxLib.Filtering` | Reusable filter patterns |
| `DaxLib.Records` | Record/row manipulation helpers |
| `DaxLib.Sample` | Example/template package |
