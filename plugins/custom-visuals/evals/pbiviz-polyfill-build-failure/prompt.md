---
description: "pbiviz 7 build fails on a Node module import"
tags: [pbiviz]
runs: 1
max_turns: 10
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
expected_outcome: "Names the 7.0.0 polyfill removal and replaces the import with a browser API, not hand-added polyfills"
---
My custom visual built fine on powerbi-visuals-tools 6 and now `pbiviz package` on version 7 fails with "Module not found: Can't resolve 'crypto'" because visual.ts does `import crypto from 'crypto'` to hash a category name. What changed and how do I fix it? Keep it short.
