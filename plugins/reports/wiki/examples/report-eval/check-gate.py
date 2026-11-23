import re
import subprocess
import sys
import tempfile
from pathlib import Path

CASE = Path(__file__).resolve().parent / "add-bar-two-measures"
ADD = [
    "pbir", "add", "visual", "clusteredBarChart", "Bikes.Report/Overview.Page",
    "--name", "sales_returns", "--title", "Sales and returns by category",
    "-x", "40", "-y", "40", "-w", "600", "-h", "360",
    "-d", "Category:Product.Category", "-d", "Y:Sales.Total Sales", "-d", "Y:Sales.Returned Sales",
]


def sh(cmd: list[str], cwd: Path, out: Path | None = None) -> None:
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if out is not None:
        out.write_text(result.stdout + result.stderr, encoding="utf-8")
    elif result.returncode:
        sys.exit(f"{' '.join(cmd)} failed: {result.stdout}{result.stderr}")


def gate_results(work: Path) -> dict[str, bool]:
    results = {}
    for grader in sorted((CASE / "graders").glob("gate-*.md")):
        head = grader.read_text(encoding="utf-8").split("---")[1]
        if "type: regex" not in head:
            continue
        path = re.search(r"path: (.+)", head).group(1).strip()
        pattern = re.search(r"pattern: '(.+)'", head).group(1)
        target = work / path
        results[grader.stem] = target.exists() and re.search(pattern, target.read_text(encoding="utf-8")) is not None
    return results


with tempfile.TemporaryDirectory() as tmp:
    good = Path(tmp) / "good"
    good.mkdir()
    sh(["bash", str(CASE / "fixture.sh")], good)
    sh(ADD, good)
    sh(["pbir", "validate", "Bikes.Report", "--fields"], good, out=good / "validate.log")
    passed = gate_results(good)
    if not all(passed.values()):
        sys.exit(f"reference solution failed a gate grader: {passed}")
    print(f"PASS: reference solution passes {sorted(passed)}")

    bad = Path(tmp) / "bad"
    bad.mkdir()
    sh(["bash", str(CASE / "fixture.sh")], bad)
    failed = gate_results(bad)
    if any(failed.values()):
        sys.exit(f"untouched fixture passed a gate grader: {failed}")
    print("PASS: untouched fixture fails every regex gate grader")
