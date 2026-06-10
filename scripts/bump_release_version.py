"""Bump the lockstep release version across marketplace, plugins, and skills.

Usage: python scripts/bump_release_version.py <old> <new>
"""

import json
import pathlib
import re
import sys

OLD, NEW = sys.argv[1], sys.argv[2]
root = pathlib.Path(__file__).resolve().parent.parent
changed = []

mp = root / ".claude-plugin" / "marketplace.json"
data = json.loads(mp.read_text(encoding="utf-8"))
if data["metadata"]["version"] == OLD:
    text = mp.read_text(encoding="utf-8").replace(f'"version": "{OLD}"', f'"version": "{NEW}"')
    mp.write_text(text, encoding="utf-8")
    changed.append(mp)

for pj in root.glob("plugins/*/.claude-plugin/plugin.json"):
    text = pj.read_text(encoding="utf-8")
    if f'"version": "{OLD}"' in text:
        pj.write_text(text.replace(f'"version": "{OLD}"', f'"version": "{NEW}"'), encoding="utf-8")
        changed.append(pj)

for sk in root.glob("plugins/*/skills/*/SKILL.md"):
    text = sk.read_text(encoding="utf-8")
    new_text = re.sub(
        rf"^version: {re.escape(OLD)}$", f"version: {NEW}", text, count=1, flags=re.MULTILINE
    )
    if new_text != text:
        sk.write_text(new_text, encoding="utf-8")
        changed.append(sk)

for path in changed:
    print("bumped:", path.relative_to(root))
print(f"total: {len(changed)} files {OLD} -> {NEW}")
