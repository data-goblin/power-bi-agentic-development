---
title: daxlib.org packages and the daxlib.sh script
summary: Registry layout, annotations that track installed packages, and the daxlib.sh commands bundled with connect-pbid.
kind: reference
status: current
sources:
  - url: https://github.com/daxlib/daxlib
  - url: https://daxlib.org
tools: {}
last_updated: 2026-11-23
last_verified: 2026-11-23
review_cadence_days: 90
skills: [pbi-desktop/connect-pbid]
---

# daxlib.org packages

daxlib.org (SQLBI) is a registry of DAX user-defined functions for models at compatibility level 1702 or higher. Layout in the public repository (checked 2026-11-23):

```
packages/<first-letter>/<package.id-lowercase>/<version>/
  manifest.daxlib      JSON: id, version, authors, description, tags
  lib/functions.tmdl   the functions as TMDL
```

Directory names are lowercase while the manifest `id` is PascalCase (`daxlib.svg` for `DaxLib.SVG`). Every installed function carries `DAXLIB_PackageId` and `DAXLIB_PackageVersion` annotations; keep them, and wrap a packaged function instead of editing it.

## `daxlib.sh` (bundled, needs bash, jq and gh or curl)

```bash
daxlib search <query> ; daxlib info <package> ; daxlib versions <package> ; daxlib functions <package>
daxlib download <package> [-v <version>] [--fn "Name1,Name2"] [-o <dir>]   # writes <id>.functions.tmdl
daxlib add|update|remove <package> --port <port> [--fn "Name"]            # needs Desktop and the .NET 8 SDK
daxlib installed --port <port>
```

`add` raises the compatibility level to 1702 when the model is below it, which is irreversible: ask first. The script is the only bundled route that writes packages to a live Desktop port.

Package docs: https://evaluationcontext.github.io/daxlib.svg (SVG functions, `data:image/svg+xml` output with data category Image URL), dev repo https://github.com/daxlib/dev-daxlib-svg.
