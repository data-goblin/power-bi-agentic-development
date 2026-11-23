# /// script
# requires-python = ">=3.12"
# dependencies = ["pyyaml==6.0.3"]
# ///
"""Deterministic checks for skills, wiki pages and the CLI commands they cite.

uv run scripts/check.py                  check everything (exit 1 on any error)
uv run scripts/check.py --verify         also run every page's verified_by commands from the repo root (needs the tools installed)
uv run scripts/check.py --write-index    regenerate wiki/index.md from page frontmatter
uv run scripts/check.py --capture        re-capture CLI help into wiki/_evidence/<tool>.json from the installed tools
                                         (CHECK_BIN_PBIR=/path/to/pbir points at a specific build; capture released builds only)
"""

import argparse
import datetime as dt
import json
import os
import pathlib
import re
import subprocess
import sys
from dataclasses import dataclass
from typing import Literal

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
EVIDENCE = ROOT / "wiki" / "_evidence"
TOOLS = ("pbir", "te", "fab")
HIDDEN = {"pbir": [], "te": [], "fab": ["deploy"]}
PATH_SPAN = re.compile(
    r"`((?:\.{1,2}/|references/|scripts/|plugins/|wiki/)[\w./-]+\.(?:md|py|sh|ps1|json|csx|yaml))`"
)
MAX_SKILL_LINES = 500
MAX_DESCRIPTION = 1024
MAX_NAME = 64
MAX_PAGE_LINES = 150
MAX_SUMMARY = 140
KINDS = {"reference", "gotcha", "recipe", "schema", "decision"}
STATUSES = {"current", "stale", "deprecated"}
SOURCED_KINDS = {"reference", "gotcha", "schema"}
NAME = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
LINK = re.compile(r"\[[^\]]*\]\(([^)\s]+)\)")
SPAN = re.compile(r"`([^`\n]+)`")
FENCE = re.compile(r"^```.*?^```", re.DOTALL | re.MULTILINE)
FLAG = re.compile(r"(?<![\w-])(--[a-zA-Z][\w-]*)")
CMD_WORD = re.compile(r"^[a-z][a-z0-9-]*$")


@dataclass(frozen=True)
class Finding:
    level: Literal["error", "warning"]
    path: pathlib.Path
    line: int
    message: str

    def __str__(self) -> str:
        return (
            f"{self.path.relative_to(ROOT)}:{self.line}: {self.level}: {self.message}"
        )


def frontmatter(text: str) -> tuple[dict[str, object], int]:
    if not text.startswith("---\n"):
        return {}, 0
    end = text.find("\n---", 4)
    if end < 0:
        return {}, 0
    data = yaml.safe_load(text[4:end]) or {}
    return (data if isinstance(data, dict) else {}), text[:end].count("\n") + 2


def line_of(text: str, index: int) -> int:
    return text.count("\n", 0, index) + 1


def check_links(path: pathlib.Path, text: str) -> list[Finding]:
    out: list[Finding] = []
    for m in LINK.finditer(text):
        target = m.group(1).split("#", 1)[0]
        if not target or re.match(r"^[a-z]+:", target):
            continue
        if not (path.parent / target).exists():
            out.append(
                Finding(
                    "error", path, line_of(text, m.start()), f"broken link {target}"
                )
            )
    return out


SKILL_DIRS = [*(ROOT / "plugins").glob("*/skills/*"), *(ROOT / "plugins").glob("*")]


def check_paths(path: pathlib.Path, text: str) -> list[Finding]:
    out: list[Finding] = []
    for m in PATH_SPAN.finditer(text):
        target = m.group(1)
        bases = [path.parent, ROOT, *path.parents, *SKILL_DIRS]
        if not any((b / target).exists() for b in bases):
            out.append(
                Finding(
                    "error",
                    path,
                    line_of(text, m.start()),
                    f"path {target} does not exist",
                )
            )
    return out


def check_skill(path: pathlib.Path) -> list[Finding]:
    text = path.read_text(encoding="utf-8")
    meta, _ = frontmatter(text)
    out: list[Finding] = []
    name = str(meta.get("name", ""))
    description = str(meta.get("description", ""))
    if name != path.parent.name:
        out.append(
            Finding(
                "error",
                path,
                1,
                f"name '{name}' must equal the folder name '{path.parent.name}'",
            )
        )
    if not NAME.match(name) or len(name) > MAX_NAME:
        out.append(
            Finding(
                "error",
                path,
                1,
                f"name must be lowercase-hyphenated and at most {MAX_NAME} chars",
            )
        )
    if not description:
        out.append(Finding("error", path, 1, "description is missing"))
    elif len(description) > MAX_DESCRIPTION:
        out.append(
            Finding(
                "error",
                path,
                1,
                f"description is {len(description)} chars, limit {MAX_DESCRIPTION}",
            )
        )
    lines = text.count("\n") + 1
    if lines > MAX_SKILL_LINES:
        out.append(
            Finding(
                "error", path, 1, f"SKILL.md is {lines} lines, limit {MAX_SKILL_LINES}"
            )
        )
    for ref in (path.parent / "references").glob("*/**/*.md"):
        out.append(
            Finding(
                "warning",
                ref,
                1,
                "reference nested more than one level below the skill",
            )
        )
    return out


def check_page(path: pathlib.Path, today: dt.date) -> list[Finding]:
    text = path.read_text(encoding="utf-8")
    meta, _ = frontmatter(text)
    out: list[Finding] = []

    def err(msg: str) -> None:
        out.append(Finding("error", path, 1, msg))

    for key in ("title", "summary", "kind", "status", "last_updated", "last_verified"):
        if key not in meta:
            err(f"frontmatter needs {key}")
    if len(str(meta.get("summary", ""))) > MAX_SUMMARY:
        err(f"summary over {MAX_SUMMARY} chars")
    if meta.get("kind") not in KINDS:
        err(f"kind must be one of {sorted(KINDS)}")
    if meta.get("status") not in STATUSES:
        err(f"status must be one of {sorted(STATUSES)}")
    sources = meta.get("sources")
    if meta.get("kind") in SOURCED_KINDS and not (
        isinstance(sources, list) and sources
    ):
        err("kind reference, gotcha and schema need at least one source url")
    if isinstance(sources, list):
        for s in sources:
            url = s.get("url") if isinstance(s, dict) else s
            if not (isinstance(url, str) and url.startswith("https://")):
                err(f"source {s!r} needs an https url")
    updated, verified = meta.get("last_updated"), meta.get("last_verified")
    if isinstance(updated, dt.date) and isinstance(verified, dt.date):
        if verified < updated:
            err(
                "last_verified is older than last_updated: verify the page after editing it"
            )
        if verified > today:
            err("last_verified is in the future")
        cadence = meta.get("review_cadence_days", 90)
        if isinstance(cadence, int) and (today - verified).days > cadence:
            out.append(
                Finding(
                    "warning",
                    path,
                    1,
                    f"not verified for {(today - verified).days} days",
                )
            )
    elif "last_updated" in meta:
        err("last_updated and last_verified must be dates (YYYY-MM-DD)")
    skills = meta.get("skills", [])
    if isinstance(skills, list):
        for s in skills:
            plugin, _, skill = str(s).partition("/")
            if not (ROOT / "plugins" / plugin / "skills" / skill / "SKILL.md").exists():
                err(f"skills entry {s} does not exist")
    lines = text.count("\n") + 1
    if lines > MAX_PAGE_LINES:
        out.append(
            Finding(
                "warning",
                path,
                1,
                f"page is {lines} lines; split it, one question per page",
            )
        )
    if re.search(r"(omen|forgejo)[\w.-]*[:/]", text, re.IGNORECASE):
        err("links a private host; the wiki is public")
    if re.search(r"\bpbiad\b", text, re.IGNORECASE):
        err("mentions pbiad content")
    return out


def wiki_pages() -> list[pathlib.Path]:
    return sorted(
        p for p in (ROOT / "plugins").glob("*/wiki/**/*.md") if p.name != "README.md"
    )


def render_index() -> str:
    lines = [
        "# Wiki index",
        "",
        "Generated by `uv run scripts/check.py --write-index`; do not edit by hand. Page rules: [SCHEMA.md](SCHEMA.md).",
        "",
    ]
    by_plugin: dict[str, list[pathlib.Path]] = {}
    for p in wiki_pages():
        by_plugin.setdefault(p.relative_to(ROOT).parts[1], []).append(p)
    for plugin, pages in sorted(by_plugin.items()):
        lines += [f"## {plugin}", ""]
        for p in pages:
            meta, _ = frontmatter(p.read_text(encoding="utf-8"))
            rel = pathlib.Path("..") / p.relative_to(ROOT)
            lines.append(
                f"- [{meta.get('title', p.stem)}]({rel.as_posix()}): {meta.get('summary', '')}"
            )
        lines.append("")
    return "\n".join(lines)


def binary(tool: str) -> str:
    return os.environ.get(f"CHECK_BIN_{tool.upper()}", tool)


def help_text(tool: str, path: list[str]) -> str:
    r = subprocess.run(
        [binary(tool), *path, "--help"],
        check=False,
        capture_output=True,
        text=True,
        timeout=60,
    )
    return re.sub(r"\x1b\[[0-9;]*m", "", r.stdout + r.stderr)


def subcommands(tool: str, text: str) -> list[str]:
    found: list[str] = []
    panel: str | None = None
    section = False
    for raw in text.splitlines():
        if m := re.match(r"^╭─ (.+?) ─", raw):
            panel = m.group(1).lower()
            continue
        if raw.startswith("╰"):
            panel = None
            continue
        if panel is not None:
            m = re.match(r"^│ ([a-z][a-z0-9-]*)\s", raw)
            if m and "option" not in panel and "argument" not in panel:
                found.append(m.group(1))
            continue
        if re.match(r"^(\S.*\s)?commands:?\s*$", raw, re.IGNORECASE):
            section = True
            continue
        if section and re.match(r"^\S", raw):
            section = False
        if section and (
            m := re.match(r"^\s{2,}([a-z][a-z0-9-]*(?:, [a-z][a-z0-9-]*)*)", raw)
        ):
            found += m.group(1).split(", ")
    return [w for i, w in enumerate(found) if w != tool and w not in found[:i]]


def capture(tool: str, depth: int = 3) -> tuple[dict[str, object], int]:
    commands: dict[str, list[str]] = {}

    def walk(path: list[str]) -> None:
        text = help_text(tool, path)
        commands[" ".join(path)] = sorted(set(FLAG.findall(text)))
        if len(path) < depth:
            for sub in subcommands(tool, text):
                walk([*path, sub])

    walk([])
    for hidden in HIDDEN[tool]:
        if hidden not in commands:
            walk([hidden])
    version = subprocess.run(
        [binary(tool), "--version"],
        check=False,
        capture_output=True,
        text=True,
        timeout=60,
    )
    found = re.search(r"\d+\.\d+\.\d+(?:\.\d+)?", version.stdout + version.stderr)
    data = {
        "tool": tool,
        "version": found.group(0) if found else "unknown",
        "commands": commands,
    }
    return data, len(commands)


def load_evidence() -> dict[str, dict[str, list[str]]]:
    out: dict[str, dict[str, list[str]]] = {}
    for tool in TOOLS:
        f = EVIDENCE / f"{tool}.json"
        if f.exists():
            out[tool] = json.loads(f.read_text(encoding="utf-8"))["commands"]
    return out


def command_lines(text: str) -> list[tuple[int, str]]:
    found: list[tuple[int, str]] = []
    for m in FENCE.finditer(text):
        start = line_of(text, m.start())
        for i, line in enumerate(m.group(0).splitlines()):
            found.append((start + i, line.strip()))
    stripped = FENCE.sub(lambda m: "\n" * m.group(0).count("\n"), text)
    for m in SPAN.finditer(stripped):
        found.append((line_of(stripped, m.start()), m.group(1).strip()))
    return found


def check_commands(
    path: pathlib.Path, evidence: dict[str, dict[str, list[str]]]
) -> list[Finding]:
    text = path.read_text(encoding="utf-8")
    out: list[Finding] = []
    for lineno, line in command_lines(text):
        for segment in re.split(r"\s*(?:\|\||&&|\||;)\s*", line.lstrip("$ ")):
            words = segment.split()
            if (
                len(words) < 2
                or words[0] not in evidence
                or not CMD_WORD.match(words[1])
            ):
                continue
            tool, cmds = words[0], evidence[words[0]]
            path_words: list[str] = []
            for w in words[1:]:
                if " ".join([*path_words, w]) in cmds:
                    path_words.append(w)
                else:
                    break
            if not path_words:
                out.append(
                    Finding(
                        "error",
                        path,
                        lineno,
                        f"`{tool} {words[1]}` is not a {tool} command",
                    )
                )
                continue
            known = set(cmds.get(" ".join(path_words), [])) | set(cmds.get("", []))
            for flag in FLAG.findall(segment):
                if flag.split("=")[0] not in known:
                    out.append(
                        Finding(
                            "error",
                            path,
                            lineno,
                            f"`{tool} {' '.join(path_words)}` has no flag {flag}",
                        )
                    )
    return out


def vendored_files() -> set[pathlib.Path]:
    out: set[pathlib.Path] = set()
    for marker in (ROOT / "plugins").glob("*/skills/*/UPSTREAM.txt"):
        for line in marker.read_text(encoding="utf-8").splitlines():
            if line.startswith("upstream_files:"):
                for name in line.split(":", 1)[1].split():
                    out.update(marker.parent.glob(f"**/{name}"))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write-index", action="store_true")
    ap.add_argument("--capture", action="store_true")
    ap.add_argument("--verify", action="store_true")
    args = ap.parse_args()
    if args.capture:
        EVIDENCE.mkdir(parents=True, exist_ok=True)
        for tool in TOOLS:
            data, count = capture(tool)
            (EVIDENCE / f"{tool}.json").write_text(
                json.dumps(data, indent=1, sort_keys=True) + "\n", encoding="utf-8"
            )
            print(f"captured {tool}: {count} commands")
        return 0
    index = ROOT / "wiki" / "index.md"
    if args.write_index:
        index.write_text(render_index(), encoding="utf-8")
        return 0
    today = dt.date.today()
    evidence = load_evidence()
    findings: list[Finding] = []
    vendored = vendored_files()
    skills = sorted((ROOT / "plugins").glob("*/skills/*/SKILL.md"))
    docs = sorted(
        {
            *(ROOT / "plugins").glob("**/*.md"),
            *(ROOT / "wiki").glob("*.md"),
            ROOT / "README.md",
        }
    )
    for s in skills:
        findings += check_skill(s)
    for p in wiki_pages():
        findings += check_page(p, today)
    for d in docs:
        if "/evals/" in d.as_posix():
            continue
        findings += check_links(d, d.read_text(encoding="utf-8"))
        found = check_paths(d, d.read_text(encoding="utf-8")) + check_commands(
            d, evidence
        )
        if d in vendored:
            found = [
                Finding("warning", f.path, f.line, f"upstream text: {f.message}")
                for f in found
            ]
        findings += found
    if args.verify:
        for p in wiki_pages():
            meta, _ = frontmatter(p.read_text(encoding="utf-8"))
            commands = meta.get("verified_by")
            for cmd in commands if isinstance(commands, list) else []:
                r = subprocess.run(
                    str(cmd),
                    shell=True,
                    cwd=ROOT,
                    check=False,
                    capture_output=True,
                    text=True,
                    timeout=300,
                )
                if r.returncode != 0:
                    tail = (r.stdout + r.stderr).strip().splitlines()[-1:] or [""]
                    findings.append(
                        Finding(
                            "error",
                            p,
                            1,
                            f"verified_by failed ({r.returncode}): {cmd}: {tail[0]}",
                        )
                    )
    if index.exists() and index.read_text(encoding="utf-8") != render_index():
        findings.append(
            Finding(
                "error",
                index,
                1,
                "out of date: run uv run scripts/check.py --write-index",
            )
        )
    for f in findings:
        print(f)
    errors = sum(f.level == "error" for f in findings)
    print(
        f"{errors} errors, {len(findings) - errors} warnings, {len(skills)} skills, {len(wiki_pages())} wiki pages"
    )
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
