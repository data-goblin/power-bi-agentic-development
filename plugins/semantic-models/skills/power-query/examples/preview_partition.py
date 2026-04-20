"""Preview a semantic model partition's Power Query result at any step.

Extracts the partition M expression from a semantic model (via fab CLI),
inlines shared parameters, optionally truncates to a specific step,
and executes via the Fabric executeQuery API.

Requires:
    - pyarrow (uv run --with pyarrow)
    - az CLI authenticated (az login)
    - fab CLI installed
    - A runner dataflow with the data source connection bound

Usage:
    # Preview final result (first 100 rows)
    uv run --with pyarrow python3 preview_partition.py \
        --workspace <ws-id> --dataflow <df-id> \
        --model "MyWorkspace.Workspace/MyModel.SemanticModel" \
        --table Orders --limit 100

    # Preview a specific step
    uv run --with pyarrow python3 preview_partition.py \
        --workspace <ws-id> --dataflow <df-id> \
        --model "MyWorkspace.Workspace/MyModel.SemanticModel" \
        --table Orders --step "Select Columns"

    # Output to CSV
    uv run --with pyarrow python3 preview_partition.py \
        --workspace <ws-id> --dataflow <df-id> \
        --model "MyWorkspace.Workspace/MyModel.SemanticModel" \
        --table Budget --output budget_preview.csv
"""


# region Imports

import argparse
import re
import subprocess
import sys

# endregion


# region Functions

def fab_get_payload(model_path, tmdl_path):
    """Get a TMDL payload from a semantic model definition via fab CLI.

    Args:
        model_path: Fabric path like "Workspace.Workspace/Model.SemanticModel"
        tmdl_path: Definition part path like "definition/tables/Orders.tmdl"

    Returns:
        The TMDL content string, or None on error.
    """

    result = subprocess.run(
        ["fab", "get", model_path, "-f",
         "-q", f"definition.parts[?path=='{tmdl_path}'].payload"],
        capture_output=True, text=True
    )

    if result.returncode != 0:
        print(f"fab error: {result.stderr.strip()}", file=sys.stderr)
        return None

    # Skip the sensitivity label warning line
    lines = result.stdout.strip().split("\n")
    payload_lines = [l for l in lines if not l.startswith("!")]
    return "\n".join(payload_lines)


def extract_partition_expression(tmdl_content):
    """Extract the M expression from a TMDL partition block.

    Args:
        tmdl_content: Full TMDL content of a table definition

    Returns:
        The M let...in expression string, or None if not found.
    """

    # Find the partition source block
    match = re.search(
        r'partition\s+.+?=\s+m\b.*?source\s*=\s*\n(.*?)(?=\n\t\w|\n\w|\Z)',
        tmdl_content,
        re.DOTALL
    )

    if not match:
        print("Could not find partition expression in TMDL", file=sys.stderr)
        return None

    # Clean up indentation (TMDL uses tabs)
    raw = match.group(1)
    lines = raw.split("\n")
    cleaned = []

    for line in lines:
        stripped = line.lstrip("\t")

        if stripped and not stripped.startswith("annotation"):
            cleaned.append(stripped)

    return "\n".join(cleaned).strip()


def extract_parameters(expressions_tmdl):
    """Extract shared M parameters from expressions.tmdl.

    Args:
        expressions_tmdl: Content of definition/expressions.tmdl

    Returns:
        Dict of parameter name -> value string.
    """

    params = {}

    for match in re.finditer(
        r'expression\s+(\w+)\s*=\s*"([^"]*)"',
        expressions_tmdl
    ):
        params[match.group(1)] = match.group(2)

    # Also match datetime parameters
    for match in re.finditer(
        r'expression\s+(\w+)\s*=\s*(#datetime\([^)]+\))',
        expressions_tmdl
    ):
        params[match.group(1)] = match.group(2)

    return params


def build_mashup(expression, parameters, step=None, limit=None):
    """Build a section document from a partition expression and parameters.

    Args:
        expression: The M let...in expression
        parameters: Dict of parameter name -> value
        step: Optional step name to truncate to
        limit: Optional row limit (wraps final step in Table.FirstN)

    Returns:
        Complete M section document string.
    """

    # Build shared parameter declarations
    shared_params = []

    for name, value in parameters.items():
        if value.startswith("#datetime"):
            shared_params.append(f'shared {name} = {value};')
        else:
            shared_params.append(f'shared {name} = "{value}";')

    # Truncate to step if specified
    if step:
        # Find the step in the let block and change the in clause
        quoted_step = f'#"{step}"' if " " in step else step

        if quoted_step in expression or step in expression:
            # Replace the in clause
            expression = re.sub(
                r'\bin\s+.*$',
                f'in {quoted_step}',
                expression,
                flags=re.DOTALL
            )

    # Replace #"ParamName" references with unquoted ParamName
    # (shared declarations use unquoted identifiers)
    for name in parameters:
        expression = expression.replace(f'#"{name}"', name)

    # Add row limit
    if limit:
        expression = re.sub(
            r'\bin\s+(.+)$',
            rf'in Table.FirstN(\1, {limit})',
            expression,
            flags=re.DOTALL
        )

    params_block = "\n".join(shared_params)
    return f"section Section1;\n{params_block}\nshared Result = {expression};"

# endregion


# region Main

def main():
    parser = argparse.ArgumentParser(description="Preview semantic model partition data")
    parser.add_argument("-w", "--workspace", required=True, help="Workspace GUID")
    parser.add_argument("-d", "--dataflow", required=True, help="Runner dataflow GUID")
    parser.add_argument("--model", required=True, help="Fabric path: Workspace.Workspace/Model.SemanticModel")
    parser.add_argument("--table", required=True, help="Table name")
    parser.add_argument("--step", help="Step name to preview (default: final)")
    parser.add_argument("--limit", type=int, default=100, help="Row limit (default: 100)")
    parser.add_argument("-o", "--output", help="Output file (.csv or .parquet)")
    parser.add_argument("--show-mashup", action="store_true", help="Print the mashup document and exit")

    args = parser.parse_args()

    # Extract partition expression
    table_tmdl = fab_get_payload(args.model, f"definition/tables/{args.table}.tmdl")

    if not table_tmdl:
        sys.exit(1)

    expression = extract_partition_expression(table_tmdl)

    if not expression:
        sys.exit(1)

    # Extract parameters
    expr_tmdl = fab_get_payload(args.model, "definition/expressions.tmdl")
    parameters = extract_parameters(expr_tmdl) if expr_tmdl else {}

    # Build mashup
    mashup = build_mashup(expression, parameters, step=args.step, limit=args.limit)

    if args.show_mashup:
        print(mashup)
        return

    # Import execute_m from sibling module
    sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
    from execute_m import execute_m, get_token

    token = get_token()
    df = execute_m(args.workspace, args.dataflow, token, mashup)

    if df is None:
        sys.exit(1)

    step_label = args.step or "final"
    print(f"Step: {step_label}", file=sys.stderr)
    print(f"Columns ({len(df.columns)}): {list(df.columns)}", file=sys.stderr)

    if args.output:
        if args.output.endswith(".parquet"):
            df.to_parquet(args.output, index=False)
        else:
            df.to_csv(args.output, index=False)

        print(f"Wrote {len(df)} rows to {args.output}", file=sys.stderr)
    else:
        print(df.to_string(index=False))
        print(f"\n({len(df)} rows)", file=sys.stderr)


if __name__ == "__main__":
    main()

# endregion
