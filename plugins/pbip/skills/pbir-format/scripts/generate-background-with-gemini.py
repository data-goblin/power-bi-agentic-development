#!/usr/bin/env python3
"""
Generate background images for Power BI reports using Google's Gemini (Nano Banana) model.

This script:
1. Generates an image using Gemini 2.5 Flash Image API from a text prompt
2. Saves the generated image locally
3. Optionally applies it to a Power BI report (theme, page canvas, or wallpaper)

Requirements:
- google-genai Python package: pip install google-genai
- GEMINI_API_KEY environment variable set
- PIL/Pillow: pip install pillow

Usage:
    # Generate and save image only
    python3 generate-background-with-gemini.py "modern abstract tech background" output.png

    # Generate and apply to theme (all pages)
    python3 generate-background-with-gemini.py "modern abstract tech background" output.png \\
        --report ./report.pbip --target theme --scaling Fit

    # Generate and apply to page canvas
    python3 generate-background-with-gemini.py "corporate office background" output.png \\
        --report ./report.pbip --target page --page-name "Dashboard" --scaling Tile

    # Generate and apply to wallpaper
    python3 generate-background-with-gemini.py "gradient blue wallpaper" output.png \\
        --report ./report.pbip --target wallpaper --page-name "Dashboard" --scaling Fill
"""

import argparse
import base64
import json
import mimetypes
import os
import random
import shutil
import sys
from io import BytesIO
from pathlib import Path


def generate_unique_id():
    """Generate a unique numeric ID for resource package items."""
    return str(random.randint(100000000000000000, 999999999999999999))


def get_api_key():
    """
    Get Gemini API key from keyring or environment variable (fallback).

    Returns:
        API key string or None if not found
    """
    try:
        import keyring
        # Try to get from keyring first
        api_key = keyring.get_password("gemini-api", "default")
        if api_key:
            return api_key
    except ImportError:
        pass  # keyring not available, fall back to env
    except Exception:
        pass  # keyring error, fall back to env

    # Fallback to environment variable
    return os.environ.get('GEMINI_API_KEY')


def generate_image_with_gemini(prompt, output_path, target_size=None):
    """
    Generate an image using Google's Gemini 2.5 Flash Image API.

    Args:
        prompt: Text description of the image to generate
        output_path: Path to save the generated image
        target_size: Optional tuple (width, height) to resize image to

    Returns:
        Path to saved image file
    """
    try:
        from google import genai
        from PIL import Image
    except ImportError as e:
        print(f"Error: Missing required package: {e}")
        print("\nPlease install required packages:")
        print("  pip install google-genai pillow keyring")
        sys.exit(1)

    # Check for API key
    api_key = get_api_key()
    if not api_key:
        print("Error: Gemini API key not found")
        print("\nStore in keyring (service='gemini-api', username='default')")
        print("Or set environment variable:")
        print("  export GEMINI_API_KEY='your-api-key-here'")
        print("\nGet your API key from: https://aistudio.google.com/apikey")
        sys.exit(1)

    # Set API key for this session
    os.environ['GEMINI_API_KEY'] = api_key

    print(f"Generating image with Gemini...")
    print(f"Prompt: {prompt}")
    if target_size:
        print(f"Target size: {target_size[0]}x{target_size[1]}")

    try:
        # Initialize Gemini client
        client = genai.Client()

        # Generate image (Gemini outputs 1024x1024 by default)
        response = client.models.generate_content(
            model="gemini-2.5-flash-image",
            contents=[prompt],
        )

        # Extract image data from response
        image_parts = [
            part.inline_data.data
            for part in response.candidates[0].content.parts
            if part.inline_data is not None
        ]

        if not image_parts:
            print("Error: No image generated in response")
            sys.exit(1)

        # Convert to PIL Image
        image = Image.open(BytesIO(image_parts[0]))

        # Resize if target size specified
        if target_size:
            print(f"Resizing from {image.width}x{image.height} to {target_size[0]}x{target_size[1]}...")
            image = image.resize(target_size, Image.Resampling.LANCZOS)

        # Save
        image.save(output_path)

        print(f"✓ Image generated successfully: {output_path}")
        print(f"  Size: {image.width}x{image.height}")
        print(f"  Format: {image.format}")

        return output_path

    except Exception as e:
        print(f"Error generating image: {e}")
        sys.exit(1)


def image_to_data_uri(image_path):
    """Convert image file to base64 data URI."""
    with open(image_path, 'rb') as f:
        image_data = f.read()

    b64_data = base64.b64encode(image_data).decode('utf-8')

    # Determine MIME type
    mime_type, _ = mimetypes.guess_type(image_path)
    if mime_type is None:
        mime_type = 'image/png'

    return f"data:{mime_type};base64,{b64_data}"


def set_theme_background(report_path, image_path, scaling='Fit'):
    """
    Set background image in theme (applies to all pages).

    NOTE: Theme backgrounds use base64 data URI for inline embedding.
    Page and wallpaper backgrounds use ResourcePackageItem (no base64 needed).
    """
    report_path = Path(report_path)
    if report_path.suffix == '.pbir':
        report_dir = report_path.parent
        report_json_path = report_dir / "definition" / "report.json"
    else:
        report_dir = report_path.parent
        report_json_path = report_dir / f"{report_path.stem}.Report" / "definition" / "report.json"

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
    report_path = Path(report_path)
    if report_path.suffix == '.pbir':
        report_dir = report_path.parent
        report_def_dir = report_dir / "definition"
        report_name = report_dir.name.replace('.Report', '')
    else:
        report_dir = report_path.parent
        report_name = report_path.stem
        report_def_dir = report_dir / f"{report_name}.Report" / "definition"

    # Find all pages with matching displayName
    pages_dir = report_def_dir / "pages"
    matching_pages = []

    for folder in pages_dir.iterdir():
        if folder.is_dir():
            page_json_path = folder / "page.json"
            if page_json_path.exists():
                with open(page_json_path, 'r') as f:
                    page_data = json.load(f)
                if page_data.get('displayName') == page_name:
                    matching_pages.append((folder, page_json_path))

    if not matching_pages:
        print(f"Error: Page '{page_name}' not found")
        sys.exit(1)

    print(f"Found {len(matching_pages)} page(s) with name '{page_name}'")

    # Generate unique resource name
    image_ext = Path(image_path).suffix
    unique_id = generate_unique_id()
    resource_name = f"{Path(image_path).stem}{unique_id}{image_ext}"

    # Copy image to RegisteredResources
    if report_path.suffix == '.pbir':
        # report_dir is already the .Report folder
        resources_dir = report_dir / "StaticResources" / "RegisteredResources"
    else:
        # report_dir is parent folder
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

    # Update all matching pages
    display_name = Path(image_path).name

    for folder, page_json_path in matching_pages:
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

        # Set transparency to 85% (makes background subtle)
        page_json['objects'][target][0]['properties']['transparency'] = {
            'expr': {
                'Literal': {
                    'Value': '85D'
                }
            }
        }

        # Write page.json
        with open(page_json_path, 'w') as f:
            json.dump(page_json, f, indent=2)

    target_name = "Canvas background" if target == "background" else "Wallpaper"
    print(f"✓ {target_name} image set: {display_name}")
    print(f"  Page(s): {page_name} ({len(matching_pages)} page(s))")
    print(f"  Scaling: {scaling}")
    print(f"  Resource: {resource_name}")


def main():
    parser = argparse.ArgumentParser(
        description='Generate background images with Gemini (Nano Banana) and apply to Power BI reports',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate image only
  python3 generate-background-with-gemini.py "abstract blue gradient background" bg.png

  # Generate and apply to theme (all pages)
  python3 generate-background-with-gemini.py "modern tech background" bg.png \\
      --report ./report.pbip --target theme --scaling Fit

  # Generate and apply to page canvas
  python3 generate-background-with-gemini.py "corporate office background" bg.png \\
      --report ./report.pbip --target page --page-name "Dashboard" --scaling Tile

  # Generate and apply to wallpaper
  python3 generate-background-with-gemini.py "gradient wallpaper" bg.png \\
      --report ./report.pbip --target wallpaper --page-name "Dashboard" --scaling Fill

API Key:
  Checks keyring first (service='gemini-api', username='default')
  Falls back to GEMINI_API_KEY environment variable
  Get key from: https://aistudio.google.com/apikey

Scaling options: Fit, Fill, Tile, Normal
        """
    )

    parser.add_argument('prompt', help='Text description of image to generate')
    parser.add_argument('output', help='Output image file path (e.g., background.png)')
    parser.add_argument('--report', help='Path to .pbip file (optional)')
    parser.add_argument('--target', choices=['theme', 'page', 'wallpaper'],
                       help='Where to apply image: theme (all pages), page (canvas), wallpaper')
    parser.add_argument('--page-name', help='Page name (required for page/wallpaper targets)')
    parser.add_argument('--scaling', default='Fit', choices=['Fit', 'Fill', 'Tile', 'Normal'],
                       help='Image scaling mode (default: Fit)')

    args = parser.parse_args()

    # Validate report options
    if args.report:
        if not os.path.exists(args.report):
            print(f"Error: Report file not found: {args.report}")
            sys.exit(1)

        if not args.target:
            print("Error: --target required when --report specified")
            sys.exit(1)

        if args.target in ['page', 'wallpaper'] and not args.page_name:
            print(f"Error: --page-name required for target '{args.target}'")
            sys.exit(1)

    # Determine target size if applying to page/wallpaper
    target_size = None
    if args.report and args.target in ['page', 'wallpaper']:
        # Handle both .pbip and .pbir paths
        report_path = Path(args.report)
        if report_path.suffix == '.pbir':
            # .pbir is in .Report/ folder, definition/ is sibling
            report_dir = report_path.parent
            report_def_dir = report_dir / "definition"
        else:
            # .pbip is in parent folder
            report_dir = report_path.parent
            report_name = report_path.stem
            report_def_dir = report_dir / f"{report_name}.Report" / "definition"

        # Find page by displayName (search all page folders)
        pages_dir = report_def_dir / "pages"
        for folder in pages_dir.iterdir():
            if folder.is_dir():
                page_json_path = folder / "page.json"
                if page_json_path.exists():
                    with open(page_json_path, 'r') as f:
                        page_data = json.load(f)
                    if page_data.get('displayName') == args.page_name:
                        target_size = (int(page_data.get('width', 1920)), int(page_data.get('height', 1080)))
                        break

        if not target_size:
            target_size = (1920, 1080)  # Default Power BI page size

    # Determine output path
    if args.report and args.target:
        # When applying to report, generate to temp location
        temp_output = Path(args.output).stem + "_temp" + Path(args.output).suffix
        image_path = generate_image_with_gemini(args.prompt, temp_output, target_size)
    else:
        # When not applying, save to specified output
        image_path = generate_image_with_gemini(args.prompt, args.output, target_size)

    # Apply to report if requested
    if args.report and args.target:
        print(f"\nApplying to report...")

        if args.target == 'theme':
            set_theme_background(args.report, image_path, args.scaling)
        elif args.target == 'page':
            set_page_background(args.report, image_path, args.page_name, args.scaling, 'background')
        elif args.target == 'wallpaper':
            set_page_background(args.report, image_path, args.page_name, args.scaling, 'outspace')

        # Clean up temp file
        if Path(image_path).exists():
            os.remove(image_path)

        print("\n✓ Complete! Check deployment-status.md for deployment results.")
        print("\nNext steps:")
        print(f"  1. Add annotation to page.json:")
        print(f"     Name: 'background-image'")
        print(f"     Value: \"The background image was generated by Claude using Gemini with the following prompt: '{args.prompt}'\"")
        print(f"  2. Review the background in Power BI Service")


if __name__ == '__main__':
    main()
