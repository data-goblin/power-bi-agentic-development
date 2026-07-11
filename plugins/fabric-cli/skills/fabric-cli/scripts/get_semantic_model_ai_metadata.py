#!/usr/bin/env python3
"""
Retrieve semantic model AI instructions and AI schema with the Fabric CLI.

Experimental utility provided as-is. It parses semantic model definition
payloads and metadata shapes that can change, and is not an official supported
Tabular Editor or Microsoft Fabric product feature.

Primary usage:
    python3 get_semantic_model_ai_metadata.py "Workspace.Workspace/Model.SemanticModel"
    python3 get_semantic_model_ai_metadata.py "Workspace.Workspace/Model.SemanticModel" --instructions-out instructions.md --schema-out schema.json

For offline parsing of a saved Fabric definition payload:
    fab get "Workspace.Workspace/Model.SemanticModel" -q "definition" -f > definition.json
    python3 get_semantic_model_ai_metadata.py --definition-file definition.json

Source precedence: when multiple parts provide AI instructions or AI schemas,
friendly Copilot definition files (e.g. Copilot/Instructions/instructions.md)
rank before culture linguisticMetadata, regardless of part order. The first
entry of aiInstructions/aiSchemas is the winner used by --instructions-out,
--schema-out, and --format text; a warning is emitted when sources disagree.
"""

from __future__ import annotations

import argparse
import base64
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any


NO_METADATA_WARNING = "No AI instructions or AI schema metadata found in semantic model definition."


def configure_output_streams() -> None:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is None:
            continue
        try:
            reconfigure(encoding="utf-8", errors="replace")
        except (OSError, ValueError):
            pass


def run_fab_command(args: list[str]) -> str:
    try:
        result = subprocess.run(
            ["fab", *args],
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as exc:
        message = exc.stderr.strip() or exc.stdout.strip() or str(exc)
        print(f"Error running fab command: {message}", file=sys.stderr)
        sys.exit(exc.returncode or 1)
    except FileNotFoundError:
        print("Error: fab CLI not found. Install ms-fabric-cli and run 'fab auth login'.", file=sys.stderr)
        sys.exit(1)


def get_definition(model_path: str) -> dict[str, Any]:
    output = run_fab_command(["get", model_path, "-q", "definition", "-f"])
    try:
        payload = json.loads(output)
    except json.JSONDecodeError as exc:
        print(f"Error: fab did not return valid JSON: {exc}", file=sys.stderr)
        sys.exit(1)

    return normalize_definition_payload(payload)


def load_definition_file(path: Path) -> dict[str, Any]:
    try:
        raw = path.read_bytes()
    except OSError as exc:
        print(f"Error reading {path}: {exc}", file=sys.stderr)
        sys.exit(1)
    text = decode_text_bytes(raw)
    if text is None:
        print(f"Error reading {path}: file is not valid UTF-8 or UTF-16 text.", file=sys.stderr)
        sys.exit(1)
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        print(f"Error parsing {path}: {exc}", file=sys.stderr)
        sys.exit(1)

    return normalize_definition_payload(payload)


def normalize_definition_payload(payload: Any) -> dict[str, Any]:
    if isinstance(payload, dict) and isinstance(payload.get("definition"), dict):
        payload = payload["definition"]
    if not isinstance(payload, dict) or not isinstance(payload.get("parts"), list):
        print("Error: expected a Fabric semantic model definition object with a 'parts' array.", file=sys.stderr)
        sys.exit(1)
    return payload


def definition_files(definition: dict[str, Any], warnings: list[str] | None = None) -> dict[str, str]:
    files: dict[str, str] = {}
    for part in definition.get("parts", []):
        if not isinstance(part, dict):
            continue
        path = part.get("path")
        if not isinstance(path, str) or not path:
            continue
        content = decode_part_payload(part)
        if content is None:
            if warnings is not None:
                warnings.append(f"Could not decode payload as text for part: {path}")
            continue
        files[path.replace("\\", "/")] = content
    return files


def decode_part_payload(part: dict[str, Any]) -> str | None:
    payload = part.get("payload")
    payload_type = str(part.get("payloadType") or "")

    if isinstance(payload, str):
        if payload_type in {"InlineBase64", "DecodeBase64"}:
            return try_decode_base64(payload)
        return payload

    return json.dumps(payload)


def try_decode_base64(value: str) -> str | None:
    try:
        raw = base64.b64decode(value, validate=True)
    except Exception:
        return None
    return decode_text_bytes(raw)


def decode_text_bytes(raw: bytes) -> str | None:
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
        try:
            return raw.decode("utf-16")
        except UnicodeDecodeError:
            return None
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = None
    if text is not None and "\x00" not in text:
        return text
    for encoding in ("utf-16-le", "utf-16-be"):
        try:
            decoded = raw.decode(encoding)
        except UnicodeDecodeError:
            continue
        if "\x00" not in decoded:
            return decoded
    return text


def parse_metadata(files: dict[str, str], culture_filter: str | None = None) -> dict[str, Any]:
    result: dict[str, Any] = {
        "aiInstructions": [],
        "aiSchemas": [],
        "aiSchemaObjects": [],
        "sources": [],
        "warnings": [],
    }

    for source_path, text in files.items():
        lower = source_path.lower()
        structured = try_parse_json(text)
        is_culture_part = is_linguistic_metadata_path(lower)
        if is_culture_part and lower.endswith(".tmdl"):
            # TMDL culture files embed the linguistic metadata JSON after a
            # "linguisticMetadata" token; .lsdl/.lsdl.json parts are the raw JSON itself.
            tmdl_metadata = extract_tmdl_linguistic_metadata(text)
            structured = try_parse_json(tmdl_metadata) if tmdl_metadata is not None else None

        if is_ai_instruction_path(lower):
            instruction_text = extract_instruction_text(structured if structured is not None else text)
            if instruction_text is None:
                result["warnings"].append(
                    f"AI instructions part has no recognized instruction content: {source_path}"
                )
                continue
            result["aiInstructions"].append(
                {
                    "sourcePath": source_path,
                    "format": "markdown" if lower.endswith((".md", ".markdown")) else "text",
                    "length": len(instruction_text),
                    "text": instruction_text,
                }
            )
            result["sources"].append({"kind": "aiInstructions", "path": source_path})
            continue

        if is_ai_schema_path(lower):
            if not isinstance(structured, dict):
                result["warnings"].append(f"AI schema part could not be parsed as JSON: {source_path}")
                continue
            schema = structured
            result["aiSchemas"].append({"sourcePath": source_path, "schema": schema})
            add_ai_schema_objects(result, source_path, schema)
            result["sources"].append({"kind": "aiSchema", "path": source_path})
            continue

        if lower.endswith(".bim"):
            collect_tmsl_metadata(result, source_path, structured, culture_filter)
            continue

        if is_culture_part and isinstance(structured, dict):
            culture = culture_from_tmdl(source_path, text)
            if culture_filter and culture and culture.lower() != culture_filter.lower():
                continue
            collect_linguistic_metadata(result, source_path, structured, culture)

    # Deterministic precedence: friendly Copilot files rank before culture
    # linguisticMetadata, independent of part order (see module docstring).
    result["aiInstructions"].sort(key=source_precedence)
    result["aiSchemas"].sort(key=source_precedence)

    if len(result["aiInstructions"]) > 1:
        primary = result["aiInstructions"][0]
        for other in result["aiInstructions"][1:]:
            if other["text"] != primary["text"]:
                result["warnings"].append(
                    "AI instructions differ between sources "
                    f"{primary['sourcePath']} and {other['sourcePath']}; using {primary['sourcePath']}."
                )

    if len(result["aiSchemas"]) > 1:
        primary = result["aiSchemas"][0]
        primary_schema = canonical_json(primary["schema"])
        for other in result["aiSchemas"][1:]:
            if canonical_json(other["schema"]) != primary_schema:
                result["warnings"].append(
                    "AI schemas differ between sources "
                    f"{primary['sourcePath']} and {other['sourcePath']}; using {primary['sourcePath']}."
                )

    if not result["aiInstructions"] and not result["aiSchemas"] and not result["aiSchemaObjects"]:
        result["warnings"].append(NO_METADATA_WARNING)

    return result


def source_precedence(entry: dict[str, Any]) -> int:
    return 1 if entry.get("storage") == "linguisticMetadata" else 0


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def collect_linguistic_metadata(result: dict[str, Any], source_path: str, payload: dict[str, Any], culture: str | None) -> None:
    instructions = payload.get("CustomInstructions") or payload.get("customInstructions")
    if isinstance(instructions, str):
        result["aiInstructions"].append(
            {
                "sourcePath": source_path,
                "storage": "linguisticMetadata",
                "culture": culture,
                "format": "markdown",
                "length": len(instructions),
                "text": instructions,
            }
        )
        result["sources"].append(
            {"kind": "aiInstructions", "path": source_path, "storage": "linguisticMetadata", "culture": culture}
        )

    schema = schema_from_entities(payload.get("Entities") or payload.get("entities") or {})
    if schema["tables"]:
        result["aiSchemas"].append(
            {
                "sourcePath": source_path,
                "storage": "linguisticMetadata",
                "culture": culture,
                "schema": schema,
            }
        )
        add_ai_schema_objects(result, source_path, schema)
        result["sources"].append(
            {"kind": "aiSchema", "path": source_path, "storage": "linguisticMetadata", "culture": culture}
        )


def collect_tmsl_metadata(result: dict[str, Any], source_path: str, payload: Any, culture_filter: str | None) -> None:
    """Walk a TMSL definition (model.bim): model.cultures[*].linguisticMetadata.content."""
    if not isinstance(payload, dict):
        return
    model = payload.get("model")
    if not isinstance(model, dict):
        return
    cultures = model.get("cultures")
    if not isinstance(cultures, list):
        return
    for entry in cultures:
        if not isinstance(entry, dict):
            continue
        culture = entry.get("name") if isinstance(entry.get("name"), str) else None
        if culture_filter and culture and culture.lower() != culture_filter.lower():
            continue
        metadata = entry.get("linguisticMetadata")
        if not isinstance(metadata, dict):
            continue
        content = metadata.get("content")
        if isinstance(content, str):
            content = try_parse_json(content)
        if isinstance(content, dict):
            collect_linguistic_metadata(result, source_path, content, culture)


def extract_tmdl_linguistic_metadata(text: str) -> str | None:
    marker = text.find("linguisticMetadata")
    if marker == -1:
        return None

    start = text.find("{", marker)
    if start == -1:
        return None

    depth = 0
    in_string = False
    escaped = False
    for index in range(start, len(text)):
        char = text[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
            continue
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[start : index + 1]
    return None


def culture_from_tmdl(source_path: str, text: str) -> str | None:
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("cultureInfo "):
            return stripped.removeprefix("cultureInfo ").strip().strip("'\"")
    name = Path(source_path.replace("\\", "/")).name
    for suffix in (".lsdl.json", ".tmdl", ".lsdl", ".json"):
        if name.lower().endswith(suffix):
            name = name[: -len(suffix)]
            break
    return name or None


def schema_from_entities(entities: Any) -> dict[str, Any]:
    if not isinstance(entities, dict):
        return {"tables": []}

    tables: dict[str, dict[str, Any]] = {}

    def table_for(name: str) -> dict[str, Any]:
        if name not in tables:
            tables[name] = {"name": name, "include": True, "columns": [], "hierarchies": []}
        return tables[name]

    for entity in entities.values():
        if not isinstance(entity, dict):
            continue
        binding = entity.get("Binding")
        if not isinstance(binding, dict):
            definition = entity.get("Definition")
            binding = definition.get("Binding") if isinstance(definition, dict) else None
        if not isinstance(binding, dict):
            continue

        table_name = binding.get("ConceptualEntity") or binding.get("conceptualEntity")
        if not isinstance(table_name, str) or not table_name:
            continue

        include = entity_included(entity)
        table = table_for(table_name)
        property_name = binding.get("ConceptualProperty") or binding.get("conceptualProperty")
        hierarchy_name = binding.get("Hierarchy") or binding.get("hierarchy")
        level_name = binding.get("HierarchyLevel") or binding.get("hierarchyLevel")

        if isinstance(level_name, str) and level_name:
            hierarchy = hierarchy_for(table, hierarchy_name or "")
            hierarchy.setdefault("levels", []).append({"name": level_name, "include": include})
        elif isinstance(hierarchy_name, str) and hierarchy_name:
            hierarchy_for(table, hierarchy_name)["include"] = include
        elif isinstance(property_name, str) and property_name:
            table.setdefault("columns", []).append({"name": property_name, "include": include})
        else:
            table["include"] = include

    table_list = list(tables.values())
    for table in table_list:
        if not table.get("columns"):
            table.pop("columns", None)
        if not table.get("hierarchies"):
            table.pop("hierarchies", None)
        else:
            for hierarchy in table["hierarchies"]:
                if not hierarchy.get("levels"):
                    hierarchy.pop("levels", None)
    return {"tables": table_list}


def hierarchy_for(table: dict[str, Any], name: str) -> dict[str, Any]:
    hierarchies = table.setdefault("hierarchies", [])
    for hierarchy in hierarchies:
        if hierarchy.get("name") == name:
            return hierarchy
    hierarchy = {"name": name, "include": True, "levels": []}
    hierarchies.append(hierarchy)
    return hierarchy


def entity_included(entity: dict[str, Any]) -> bool:
    state = str(entity.get("State") or entity.get("state") or "Generated").lower()
    return state not in {"deleted", "hidden", "disabled"}


def add_ai_schema_objects(result: dict[str, Any], source_path: str, schema: dict[str, Any]) -> None:
    for table_key, table in collection_entries(schema.get("tables") or schema.get("Tables")):
        table_name = schema_object_name(table_key, table)
        if not table_name:
            continue
        push_schema_object(result, source_path, table, {"type": "table", "table": table_name})

        for column_key, column in collection_entries(get_child(table, "columns")):
            column_name = schema_object_name(column_key, column)
            if column_name:
                push_schema_object(result, source_path, column, {"type": "column", "table": table_name, "property": column_name})

        for measure_key, measure in collection_entries(get_child(table, "measures")):
            measure_name = schema_object_name(measure_key, measure)
            if measure_name:
                push_schema_object(result, source_path, measure, {"type": "measure", "table": table_name, "property": measure_name})

        for hierarchy_key, hierarchy in collection_entries(get_child(table, "hierarchies")):
            hierarchy_name = schema_object_name(hierarchy_key, hierarchy)
            if not hierarchy_name:
                continue
            push_schema_object(result, source_path, hierarchy, {"type": "hierarchy", "table": table_name, "hierarchy": hierarchy_name})
            for level_key, level in collection_entries(get_child(hierarchy, "levels")):
                level_name = schema_object_name(level_key, level)
                if level_name:
                    push_schema_object(
                        result,
                        source_path,
                        level,
                        {"type": "level", "table": table_name, "hierarchy": hierarchy_name, "level": level_name},
                    )


def push_schema_object(result: dict[str, Any], source_path: str, value: Any, obj: dict[str, Any]) -> None:
    result["aiSchemaObjects"].append(
        {
            "sourcePath": source_path,
            "object": obj,
            "include": schema_include(value),
            "visibility": schema_property(value, "visibility"),
            "index": schema_property(value, "index"),
        }
    )


def collection_entries(value: Any) -> list[tuple[str | None, Any]]:
    if isinstance(value, list):
        return [(schema_object_name(None, item), item) for item in value]
    if isinstance(value, dict):
        return list(value.items())
    return []


def get_child(value: Any, name: str) -> Any:
    if not isinstance(value, dict):
        return None
    return value.get(name) or value.get(name[:1].upper() + name[1:])


def schema_object_name(key: str | None, value: Any) -> str | None:
    if isinstance(value, dict):
        candidate = value.get("name") or value.get("Name") or value.get("id") or value.get("Id")
        if isinstance(candidate, str):
            return candidate
    return key


def schema_include(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    include = schema_property(value, "include")
    if isinstance(include, bool):
        return include
    enabled = schema_property(value, "enabled")
    if isinstance(enabled, bool):
        return enabled
    selected = schema_property(value, "selected")
    if isinstance(selected, bool):
        return selected
    visibility = schema_property(value, "visibility")
    if isinstance(visibility, str):
        if visibility.lower() == "hidden":
            return False
        if visibility.lower() == "visible":
            return True
    return None


def schema_property(value: Any, name: str) -> Any:
    if not isinstance(value, dict):
        return None
    return value.get(name) if name in value else value.get(name[:1].upper() + name[1:])


def try_parse_json(text: str) -> Any:
    stripped = text.lstrip("\ufeff").strip()
    if not stripped.startswith(("{", "[")):
        return None
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        return None


def extract_instruction_text(payload: Any) -> str | None:
    if isinstance(payload, str):
        return payload.strip()
    if not isinstance(payload, dict):
        return None
    for key in ["instructions", "aiInstructions", "systemInstructions", "copilotInstructions", "prompt"]:
        value = payload.get(key)
        if isinstance(value, str):
            return value
        if isinstance(value, list):
            return "\n".join(str(item) for item in value)
    return None


def path_tokens(lower_path: str) -> set[str]:
    return {token for token in re.split(r"[^a-z0-9]+", lower_path) if token}


def is_ai_instruction_path(lower_path: str) -> bool:
    if "copilot/instructions/version.json" in lower_path:
        return False
    if lower_path.endswith("copilot/instructions/instructions.md"):
        return True
    tokens = path_tokens(lower_path)
    return bool(tokens & {"instruction", "instructions", "prompt", "prompts"}) and bool(tokens & {"ai", "copilot"})


def is_ai_schema_path(lower_path: str) -> bool:
    if lower_path.endswith("copilot/schema.json"):
        return True
    tokens = path_tokens(lower_path)
    return "schema" in tokens and bool(tokens & {"ai", "copilot"})


def is_linguistic_metadata_path(lower_path: str) -> bool:
    return lower_path.endswith(".lsdl") or lower_path.endswith(".lsdl.json") or (
        lower_path.endswith(".tmdl") and ("/cultures/" in lower_path or lower_path.startswith("cultures/"))
    )


def write_outputs(result: dict[str, Any], instructions_out: Path | None, schema_out: Path | None) -> None:
    if instructions_out:
        if result["aiInstructions"]:
            instructions_out.parent.mkdir(parents=True, exist_ok=True)
            instructions_out.write_text(result["aiInstructions"][0]["text"], encoding="utf-8")
        else:
            result["warnings"].append(f"No AI instructions found; not writing {instructions_out}.")
    if schema_out:
        if result["aiSchemas"]:
            schema_out.parent.mkdir(parents=True, exist_ok=True)
            schema_out.write_text(json.dumps(result["aiSchemas"][0]["schema"], indent=2) + "\n", encoding="utf-8")
        else:
            result["warnings"].append(f"No AI schema found; not writing {schema_out}.")


def main() -> None:
    configure_output_streams()
    parser = argparse.ArgumentParser(description="Retrieve semantic model AI instructions and AI schema with fab.")
    parser.add_argument("model", nargs="?", help='Fabric path: "Workspace.Workspace/Model.SemanticModel"')
    parser.add_argument("--definition-file", type=Path, help="Parse a saved fab definition JSON instead of calling fab.")
    parser.add_argument("--culture", help="Culture to use when multiple TMDL culture metadata files exist.")
    parser.add_argument("--instructions-out", type=Path, help="Write the first AI instructions payload to this file.")
    parser.add_argument("--schema-out", type=Path, help="Write the first AI schema payload to this JSON file.")
    parser.add_argument("--format", choices=["json", "text"], default="json", help="Output format. Default: json.")
    args = parser.parse_args()

    if not args.definition_file and not args.model:
        parser.error("provide a semantic model path or --definition-file")

    definition = load_definition_file(args.definition_file) if args.definition_file else get_definition(args.model)
    decode_warnings: list[str] = []
    files = definition_files(definition, decode_warnings)
    result = parse_metadata(files, args.culture)
    result["warnings"].extend(decode_warnings)
    result["model"] = args.model or str(args.definition_file)
    result["partCount"] = len(files)

    write_outputs(result, args.instructions_out, args.schema_out)

    if args.format == "text":
        for warning in result["warnings"]:
            print(warning, file=sys.stderr)
        if result["aiInstructions"]:
            print(result["aiInstructions"][0]["text"])
            return
        sys.exit(1)

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
