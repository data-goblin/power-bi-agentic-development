---
description: "Vega spec sizing in Deneb 2.0"
tags: [deneb]
runs: 1
max_turns: 10
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "denebContainer.width/height, pbiColor, no deprecated signals and no root $schema"
---
Make this Vega spec fill the Deneb visual and use the report theme colors instead of hex. Return only the corrected spec.

{"$schema": "https://vega.github.io/schema/vega/v5.json", "width": 400, "height": 300, "data": [{"name": "dataset"}],
 "scales": [{"name": "x", "type": "band", "domain": {"data": "dataset", "field": "Category"}, "range": "width"},
            {"name": "y", "type": "linear", "domain": {"data": "dataset", "field": "Sales"}, "range": "height", "nice": true}],
 "marks": [{"type": "rect", "from": {"data": "dataset"}, "encode": {"update": {"x": {"scale": "x", "field": "Category"}, "width": {"scale": "x", "band": 1}, "y": {"scale": "y", "field": "Sales"}, "y2": {"scale": "y", "value": 0}, "fill": {"value": "#118DFF"}}}}]}
