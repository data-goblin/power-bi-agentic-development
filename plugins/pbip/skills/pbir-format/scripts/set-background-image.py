#!/usr/bin/env python3
"""
Set background images for Power BI reports.

Supports:
1. Theme background (data URI) - applies to all pages
2. Page background (ResourcePackageItem) - single page canvas
3. Wallpaper (ResourcePackageItem) - single page outspace

Usage:
    # Theme background (all pages)
    python3 set-background-image.py theme /path/to/report.pbip /path/to/image.png --scaling Fit

    # Page background (single page)
    python3 set-background-image.py page /path/to/report.pbip /path/to/image.png "Page Name" --scaling Tile

    # Wallpaper (single page)
    python3 set-background-image.py wallpaper /path/to/report.pbip /path/to/image.png "Page Name" --scaling Fill
"""

import argparse
import base64
import json
import mimetypes
import os
import random
import shutil
import sys
from pathlib import Path


def generate_unique_id():
    """Generate a unique numeric ID for resource package items."""
    return str(random.randint(100000000000000000, 999999999999999999))


def image_to_data_uri(image_path):
    """Convert image file to base64 data URI."""
    with open(image_path, 'rb') as f:
        image_data = f.read()

    b64_data = base64.b64encode(image_data).decode('utf-8')

    # Determine MIME type
    mime_type, _ = mimetypes.guess_type(image_path)
    if mime_type is None:
        # Default to PNG if unknown
        mime_type = 'image/png'

    return f"data:{mime_type};base64,{b64_data}"


def set_theme_background(report_path, image_path, scaling='Fit'):
    """
    Set background image in theme (applies to all pages).
    Uses data URI with inline base64.
    """
    report_dir = Path(report_path).parent
    report_json_path = report_dir / f"{Path(report_path).stem}.Report" / "definition" / "report.json"

    # Read report.json to get theme path
    with open(report_json_path, 'r') as f:
        report_json = json.load(f)

    custom_theme = report_json.get('themeCollection', {}).get('customTheme', {})
    theme_name = custom_theme.get('name')
    theme_type = custom_theme.get('type', 'RegisteredResources')

    if not theme_name:
        print("Error: No custom theme found in report.json")
        sys.exit(1)

    # Determine theme path
    if theme_type == 'RegisteredResources':
        theme_path = report_dir / f"{Path(report_path).stem}.Report" / "StaticResources" / "RegisteredResources" / theme_name
    else:
        theme_path = report_dir / f"{Path(report_path).stem}.Report" / "StaticResources" / "SharedResources" / theme_name

    if not theme_path.exists():
        print(f"Error: Theme file not found at {theme_path}")
        sys.exit(1)

    # Read theme JSON
    with open(theme_path, 'r') as f:
        theme_json = json.load(f)

    # Convert image to data URI
    data_uri = image_to_data_uri(image_path)
    image_name = Path(image_path).stem

    # Set background image in theme
    if 'visualStyles' not in theme_json:
        theme_json['visualStyles'] = {}
    if 'page' not in theme_json['visualStyles']:
        theme_json['visualStyles']['page'] = {}
    if '*' not in theme_json['visualStyles']['page']:
        theme_json['visualStyles']['page']['*'] = {}
    if 'background' not in theme_json['visualStyles']['page']['*']:
        theme_json['visualStyles']['page']['*']['background'] = [{}]

    # Set image properties
    theme_json['visualStyles']['page']['*']['background'][0]['image'] = {
        'name': image_name,
        'scaling': scaling,
        'url': data_uri
    }

    # Write theme JSON
    with open(theme_path, 'w') as f:
        json.dump(theme_json, f, indent=2)

    print(f"✓ Theme background image set: {image_name}")
    print(f"  Scaling: {scaling}")
    print(f"  Theme: {theme_name}")


def set_page_background(report_path, image_path, page_name, scaling='Fit', target='background'):
    """
    Set background image on a single page (canvas or wallpaper).
    Uses ResourcePackageItem with registered resource.

    Args:
        target: 'background' for canvas, 'outspace' for wallpaper
    """
    report_dir = Path(report_path).parent
    report_name = Path(report_path).stem
    report_def_dir = report_dir / f"{report_name}.Report" / "definition"

    # Find page by name
    pages_json_path = report_def_dir / "pages" / "pages.json"
    with open(pages_json_path, 'r') as f:
        pages_json = json.load(f)

    page_id = None
    for page in pages_json.get('pageOrder', []):
        page_path = report_def_dir / "pages" / page / "page.json"
        with open(page_path, 'r') as f:
            page_data = json.load(f)
        if page_data.get('displayName') == page_name:
            page_id = page
            break

    if not page_id:
        print(f"Error: Page '{page_name}' not found")
        sys.exit(1)

    page_json_path = report_def_dir / "pages" / page_id / "page.json"

    # Generate unique resource name
    image_ext = Path(image_path).suffix
    unique_id = generate_unique_id()
    resource_name = f"{Path(image_path).stem}{unique_id}{image_ext}"

    # Copy image to RegisteredResources
    resources_dir = report_dir / f"{report_name}.Report" / "StaticResources" / "RegisteredResources"
    resources_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy(image_path, resources_dir / resource_name)

    # Register in report.json
    report_json_path = report_def_dir / "report.json"
    with open(report_json_path, 'r') as f:
        report_json = json.load(f)

    # Find or create RegisteredResources package
    registered_pkg = None
    for pkg in report_json.get('resourcePackages', []):
        if pkg.get('name') == 'RegisteredResources':
            registered_pkg = pkg
            break

    if not registered_pkg:
        # Create RegisteredResources package
        if 'resourcePackages' not in report_json:
            report_json['resourcePackages'] = []
        registered_pkg = {
            'name': 'RegisteredResources',
            'type': 'RegisteredResources',
            'items': []
        }
        report_json['resourcePackages'].append(registered_pkg)

    # Add image to package items
    registered_pkg['items'].append({
        'name': resource_name,
        'path': resource_name,
        'type': 'Image'
    })

    # Write report.json
    with open(report_json_path, 'w') as f:
        json.dump(report_json, f, indent=2)

    # Update page.json
    with open(page_json_path, 'r') as f:
        page_json = json.load(f)

    # Create objects structure if needed
    if 'objects' not in page_json:
        page_json['objects'] = {}
    if target not in page_json['objects']:
        page_json['objects'][target] = [{'properties': {}}]
    elif not page_json['objects'][target]:
        page_json['objects'][target] = [{'properties': {}}]
    elif 'properties' not in page_json['objects'][target][0]:
        page_json['objects'][target][0]['properties'] = {}

    # Set image in page.json
    display_name = Path(image_path).name
    page_json['objects'][target][0]['properties']['image'] = {
        'image': {
            'name': {
                'expr': {
                    'Literal': {
                        'Value': f"'{display_name}'"
                    }
                }
            },
            'url': {
                'expr': {
                    'ResourcePackageItem': {
                        'PackageName': 'RegisteredResources',
                        'PackageType': 1,
                        'ItemName': resource_name
                    }
                }
            },
            'scaling': {
                'expr': {
                    'Literal': {
                        'Value': f"'{scaling}'"
                    }
                }
            }
        }
    }

    # Write page.json
    with open(page_json_path, 'w') as f:
        json.dump(page_json, f, indent=2)

    target_name = "Canvas background" if target == "background" else "Wallpaper"
    print(f"✓ {target_name} image set: {display_name}")
    print(f"  Page: {page_name}")
    print(f"  Scaling: {scaling}")
    print(f"  Resource: {resource_name}")


def main():
    parser = argparse.ArgumentParser(
        description='Set background images for Power BI reports',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Set theme background (all pages)
  python3 set-background-image.py theme report.pbip background.png --scaling Fit

  # Set page canvas background
  python3 set-background-image.py page report.pbip background.png "Page 1" --scaling Tile

  # Set page wallpaper
  python3 set-background-image.py wallpaper report.pbip wallpaper.png "Page 1" --scaling Fill

Scaling options: Fit, Fill, Tile, Normal
        """
    )

    parser.add_argument('operation', choices=['theme', 'page', 'wallpaper'],
                        help='Operation type: theme (all pages), page (canvas), wallpaper (outspace)')
    parser.add_argument('report_path', help='Path to .pbip file')
    parser.add_argument('image_path', help='Path to image file (PNG, JPG, SVG)')
    parser.add_argument('page_name', nargs='?', help='Page name (required for page/wallpaper)')
    parser.add_argument('--scaling', default='Fit', choices=['Fit', 'Fill', 'Tile', 'Normal'],
                        help='Image scaling mode (default: Fit)')

    args = parser.parse_args()

    # Validate inputs
    if not os.path.exists(args.report_path):
        print(f"Error: Report file not found: {args.report_path}")
        sys.exit(1)

    if not os.path.exists(args.image_path):
        print(f"Error: Image file not found: {args.image_path}")
        sys.exit(1)

    if args.operation in ['page', 'wallpaper'] and not args.page_name:
        print(f"Error: Page name required for {args.operation} operation")
        sys.exit(1)

    # Execute operation
    if args.operation == 'theme':
        set_theme_background(args.report_path, args.image_path, args.scaling)
    elif args.operation == 'page':
        set_page_background(args.report_path, args.image_path, args.page_name, args.scaling, 'background')
    elif args.operation == 'wallpaper':
        set_page_background(args.report_path, args.image_path, args.page_name, args.scaling, 'outspace')


if __name__ == '__main__':
    main()
