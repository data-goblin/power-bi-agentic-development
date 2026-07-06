#!/usr/bin/env python3
"""Wrap a small HTML fragment in a friendly, readable page and open it in a browser.

The get-started skill teaches one idea at a time and shows a simple local visual
for each. This bundles the page shell (typography, spacing, light styling) so every
explainer looks the same and the skill never has to rewrite CSS. Give it a title and
a body fragment (a file, or piped on stdin); it writes a self-contained page to a temp
file and opens it in Firefox, falling back to the platform default browser.

Usage:
  python3 show_explainer.py "What is a model?" body.html
  echo "<p>hi</p>" | python3 show_explainer.py "Title"
"""

import subprocess
import sys
import tempfile
from pathlib import Path

PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>
  :root {{ color-scheme: light; }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; padding: 2.5rem 1.25rem 4rem;
    font: 18px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #1f2328; background: #fbfaf7;
    display: flex; justify-content: center;
  }}
  main {{ width: 100%; max-width: 46rem; }}
  h1 {{ font-size: 1.9rem; line-height: 1.2; margin: 0 0 1.5rem; letter-spacing: -0.01em; }}
  h2 {{ font-size: 1.3rem; margin: 2.25rem 0 0.75rem; }}
  p {{ margin: 0 0 1.15rem; }}
  strong {{ color: #0f5132; }}
  .lead {{ font-size: 1.2rem; color: #3a3f45; }}
  .card {{
    background: #fff; border: 1px solid #e7e3da; border-radius: 14px;
    padding: 1.25rem 1.4rem; margin: 1.25rem 0;
  }}
  .row {{ display: flex; flex-wrap: wrap; gap: 0.85rem; margin: 1.25rem 0; }}
  .row > .card {{ flex: 1 1 12rem; margin: 0; }}
  .tag {{ display: inline-block; font-size: 0.85rem; font-weight: 600;
    padding: 0.15rem 0.6rem; border-radius: 999px; background: #e8f3ec; color: #0f5132; }}
  .muted {{ color: #6b7280; font-size: 0.95rem; }}
  code {{ background: #f0ede6; padding: 0.1rem 0.4rem; border-radius: 6px; font-size: 0.9em; }}
  .analogy {{ border-left: 4px solid #b7d8c4; padding: 0.35rem 0 0.35rem 1rem; color: #3a3f45; font-style: italic; }}
  ul {{ padding-left: 1.25rem; }}
  li {{ margin: 0.4rem 0; }}
  hr {{ border: none; border-top: 1px solid #e7e3da; margin: 2rem 0; }}
</style>
</head>
<body>
<main>
<h1>{title}</h1>
{body}
</main>
</body>
</html>
"""


def open_in_browser(path: Path):
    if sys.platform == "darwin":
        for cmd in (["open", "-a", "Firefox", str(path)], ["open", str(path)]):
            try:
                if subprocess.run(cmd, capture_output=True, timeout=8).returncode == 0:
                    return
            except Exception:
                continue
    elif sys.platform.startswith("win"):
        try:
            subprocess.run(["cmd", "/c", "start", "", str(path)], timeout=8)
            return
        except Exception:
            pass
    else:
        for browser in ("firefox", "xdg-open"):
            try:
                subprocess.run([browser, str(path)], timeout=8)
                return
            except Exception:
                continue


def main():
    args = [a for a in sys.argv[1:]]
    if not args:
        print("usage: show_explainer.py \"Title\" [body.html]", file=sys.stderr)
        sys.exit(1)
    title = args[0]
    if len(args) > 1:
        body = Path(args[1]).read_text(encoding="utf-8")
    else:
        body = sys.stdin.read()

    html = PAGE.format(title=title, body=body)
    out = Path(tempfile.gettempdir()) / ("explainer-" + "".join(
        c if c.isalnum() else "-" for c in title.lower())[:40] + ".html")
    out.write_text(html, encoding="utf-8")
    open_in_browser(out)
    print(str(out))


if __name__ == "__main__":
    main()
