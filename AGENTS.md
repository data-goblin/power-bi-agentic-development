# AGENTS.md

Instructions for agents working in this repository. Contributors also read [CONTRIBUTING.md](CONTRIBUTING.md).

## Layout

```dirtree
.claude-plugin/marketplace.json   the marketplace; one entry per plugin, metadata.version is the release version
plugins/<plugin>/
  .claude-plugin/plugin.json      Claude Code manifest (version moves in lockstep with the marketplace)
  .github/plugin/plugin.json      Copilot CLI manifest, where present (Copilot reads it first)
  skills/<skill>/SKILL.md         one skill; reference files one level deep under references/
  agents/, commands/, hooks/      subagents, slash commands, hooks
release-notes/v<version>.md       notes of the current release; older ones in release-notes/previous-releases/
scripts/                          repo tooling (version bump, plugin validation)
```

## Versions

- Format `0.<minor>.<patch>`, the same number in the marketplace, every plugin manifest and the README badge. The calendar scheme (`26.45`) ended at v26.45; v0.27.0 follows it
- Minor: a significant new feature, validated in every surface it touches. Patch: everything else. Letter suffix (`0.27.0a`): a tiny hotfix to a release that is already out
- One bump per release, measured from the last tag (`git describe --tags --abbrev=0`); if the branch is already above it, leave the version alone
- Bump with `uv run scripts/bump_release_version.py <new>`; it refuses a version outside the format and any manifest out of lockstep
- Claude Code updates an installed plugin when the version string changes; a test on Claude Code 2.1.330 updated 26.45 to 0.27.0, so the lower number still reaches existing users

## Releases

- At most one release a day, in the morning; only an emergency fix ships the same day
- Branch `release/v<version>` from `main`: bump commit `Chore: bump to <version>`, move the previous `release-notes/v*.md` to `release-notes/previous-releases/`, write `release-notes/v<version>.md`
- Merge into `main` with a merge commit, then `git tag -s v<version> -m v<version>` (signed tags, unsigned commits) and `gh release create v<version> --title v<version> --notes-file release-notes/v<version>.md --latest --verify-tag`
- Delete the release branch locally and on the remote

## Skills

- Skills document released tools only. Confirm every `pbir`, `fab` or `te` command and flag in the installed CLI's `--help` before writing it down
- A skill holds what a frontier model does not already know: current formats, exact commands, gotchas, decision rules, links to Microsoft Learn. Generic DAX, M, C#, Python or Power BI teaching does not belong in a skill
- SKILL.md stays under 500 lines with the rules at the top; detail goes in `references/`, one level deep
- Anything a tool can check (schema, parser, linter, CLI validator) goes in a hook or script, not in prose
- Do not commit `.claude/`, memory files, or content from the private `pbiad` work
