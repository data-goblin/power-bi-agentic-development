# Block release-age bypass flags

A PreToolUse hook that blocks `bun`/`npm` flags which disable the minimum-release-age guard: `--no-minimum-release-age`, `--minimum-release-age=0` (or `--minimum-release-age 0`), and `--ignore-min-release-age`.

## Why

- **Supply-chain protection.** A minimum release age (e.g. only install packages published more than N days ago) is one of the strongest defenses against a freshly-compromised package version: malicious releases are usually caught and yanked within hours to days. Bypassing it reinstates that window of exposure.
- **Agent safety.** Agents auto-approve installs. If an agent can pass `--no-minimum-release-age` to get past a blocked install, the protection is worthless. This hook removes that escape hatch so the agent has to wait out the age window or inspect the tarball by hand instead.

## How it works

The hook fires when the Bash command contains `minimum-release-age` (the `if` condition), then `grep` narrows to the actual bypass forms before emitting a `permissionDecision: "deny"`. Legitimate uses that set a non-zero age are not blocked.

The deny message points the agent at the safe alternatives: wait for the release-age window, or download the tarball directly from `registry.npmjs.org` with `curl` and inspect it.

## Installation

Copy the hook entry into your `~/.claude/settings.json` under `hooks.PreToolUse`. See `settings.json.example` for the full structure. If you already have a `PreToolUse` matcher for `Bash`, add the hook object to the existing `hooks` array rather than creating a duplicate matcher. Pair it with the `block-npm` and `block-pip` hooks for a fuller package-manager policy.
