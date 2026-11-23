"""Bump the lockstep release version across the marketplace, every plugin manifest and the README badge.

Usage: uv run scripts/bump_release_version.py <new>   (new is 0.<minor>.<patch>, optionally a letter hotfix suffix)
"""

import json
import pathlib
import re
import sys

VERSION = re.compile(r"^0\.\d+\.\d+[a-z]?$")

if len(sys.argv) != 2 or not VERSION.match(sys.argv[1]):
    sys.exit("usage: bump_release_version.py 0.<minor>.<patch>[letter]")
NEW = sys.argv[1]
root = pathlib.Path(__file__).resolve().parent.parent
marketplace = root / ".claude-plugin" / "marketplace.json"
OLD = json.loads(marketplace.read_text(encoding="utf-8"))["metadata"]["version"]
if OLD == NEW:
    sys.exit(f"already at {NEW}")

targets = [
    marketplace,
    *sorted(root.glob("plugins/*/.claude-plugin/plugin.json")),
    *sorted(root.glob("plugins/*/.github/plugin/plugin.json")),
]
changed: list[pathlib.Path] = []
for path in targets:
    text = path.read_text(encoding="utf-8")
    new_text = text.replace(f'"version": "{OLD}"', f'"version": "{NEW}"')
    if new_text == text:
        sys.exit(f"{path.relative_to(root)} does not carry {OLD}; versions must move in lockstep")
    path.write_text(new_text, encoding="utf-8")
    changed.append(path)

readme = root / "README.md"
text = readme.read_text(encoding="utf-8")
badge = re.sub(r"badge/version-[^-]+-blue", f"badge/version-{NEW}-blue", text, count=1)
if badge == text:
    sys.exit("README.md has no version badge")
readme.write_text(badge, encoding="utf-8")
changed.append(readme)

for path in changed:
    print("bumped:", path.relative_to(root))
print(f"total: {len(changed)} files {OLD} -> {NEW}")
