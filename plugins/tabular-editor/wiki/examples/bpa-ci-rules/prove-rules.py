import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
MODEL = ROOT / "plugins/pbip/wiki/examples/bikes/Bikes.SemanticModel/definition"
RULES = Path(__file__).resolve().parent / "model-rules.json"
COMMAND = [
    "te", "bpa", "run", "--rules", str(RULES), "--no-defaults", "--no-model-rules",
    "--fail-on", "error", "--output-format", "json", "--non-interactive",
]


def run(model: Path) -> tuple[int, dict]:
    result = subprocess.run([*COMMAND, "--model", str(model)], capture_output=True, text=True)
    return result.returncode, json.loads(result.stdout)


def expect(model: Path, rule: str | None) -> None:
    code, report = run(model)
    fired = {f["code"] for f in report["findings"]}
    if report["ruleErrors"]:
        sys.exit(f"rule errors: {report}")
    if rule is None and (code != 0 or fired):
        sys.exit(f"clean model reported {fired} with exit {code}")
    if rule is not None and (code != 1 or rule not in fired):
        sys.exit(f"{rule} did not fire: exit {code}, findings {fired}")
    print(f"PASS: {rule or 'clean model'} exit {code}")


with tempfile.TemporaryDirectory() as tmp:
    expect(MODEL, None)

    enabled = Path(tmp) / "auto-date-time"
    shutil.copytree(MODEL, enabled)
    model_file = enabled / "model.tmdl"
    text = model_file.read_text(encoding="utf-8")
    anchor = "\tdiscourageImplicitMeasures\n"
    assert anchor in text
    model_file.write_text(
        text.replace(anchor, anchor + "\tannotation __PBI_TimeIntelligenceEnabled = 1\n", 1),
        encoding="utf-8",
    )
    expect(enabled, "MODEL_AUTO_DATE_TIME_DISABLED")

    generated = Path(tmp) / "auto-date-table"
    shutil.copytree(MODEL, generated)
    with (generated / "model.tmdl").open("a", encoding="utf-8") as f:
        f.write("\nref table LocalDateTable_Demo\n")
    (generated / "tables/LocalDateTable_Demo.tmdl").write_text(
        "table LocalDateTable_Demo\n\tpartition LocalDateTable_Demo = calculated\n"
        "\t\tmode: import\n\t\tsource = CALENDAR(DATE(2026,1,1), DATE(2026,1,2))\n",
        encoding="utf-8",
    )
    expect(generated, "MODEL_NO_AUTO_DATE_TABLES")
