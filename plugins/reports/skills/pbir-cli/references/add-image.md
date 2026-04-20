# Image Management

## Adding Images to Reports

Images are stored in `StaticResources/RegisteredResources/` and registered in `report.json` under `resourcePackages`.

### Add image resource

```bash
# From local file
pbir add image "Report.Report" logo.png
pbir add image "Report.Report" /path/to/background.jpg --name "Background"

# From URL
pbir add image "Report.Report" https://example.com/logo.png
```

### Create image visual with source

```bash
# File-based: copies to RegisteredResources, sets visual source
pbir add visual image "Report.Report/Page.Page" --image logo.png --title "Logo"

# URL-based: references URL directly (no upload)
pbir add visual image "Report.Report/Page.Page" --image https://example.com/logo.png

# Measure-based: binds to a measure returning an image URL (DAX SVG, dynamic URL)
pbir add visual image "Report.Report/Page.Page" --image _Fmt.ProductImage --title "Product"
```

### List image resources

```bash
pbir ls "Report.Report" --images
```

Shows registered images with name, file size, and existence status.

### Remove image resources

```bash
pbir rm "Report.Report" --image item_name_12345.png -f
```

Deletes the file from `RegisteredResources/` and unregisters from `report.json`.

## Page Background Images

```bash
pbir pages background "Report.Report/Page.Page" --image bg.png
pbir pages background "Report.Report/Page.Page" --image bg.png --scaling Fill --transparency 20
pbir pages background "Report.Report/Page.Page" --clear
```

Background images are automatically registered in `report.json` (bug fix: previously missing).

## Image Source Types

| Source Type | Detection | Example | Behavior |
|-------------|-----------|---------|----------|
| File | Has file extension | `logo.png` | Copies to RegisteredResources, references via ResourcePackageItem |
| URL | Starts with `http://` | `https://...` | References URL directly in visual imageUrl |
| Measure | Contains `.`, no extension | `_Fmt.SVG` | Binds to Table.Measure via expression |

## Scaling Modes

- `Normal` - Original size (default for image visuals)
- `Fit` - Scale to fit, preserve aspect ratio
- `Fill` - Scale to fill container

## Supported Formats

`.png`, `.jpg`, `.jpeg`, `.gif`, `.bmp`, `.webp`

## Python Object Model

```python
from pbir_object_model import Report

report = Report.load("Report.Report")

# Add image
result = report.add_image(Path("logo.png"))
# result = {"item_name": "logo_17100...", "file_path": "...", "display_name": "logo.png"}

# Add from URL
result = report.add_image_from_url("https://example.com/img.png")

# List images
items = report.list_resource_items(item_type="Image")

# Remove image
report.remove_image("logo_17100....png")

# Register/unregister items directly
report.register_resource_item("name", "name", "Image")
report.unregister_resource_item("name")

report.save()

# Set image source on visual
visual = Visual.new(visual_type="image", x=0, y=0, width=300, height=200)
visual.set_image_source("file", item_name=result["item_name"])
visual.set_image_source("url", url="https://example.com/logo.png")
visual.set_image_source("measure", measure_ref="Table.MeasureName")
```
