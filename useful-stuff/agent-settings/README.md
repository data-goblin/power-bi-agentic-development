# Agent settings

A sanitized `~/.claude/settings.json` you can drop in as a starting point. The personal bits (model pin, theme, editor, plugin selection, notification channel, sounds, marketplace registrations, surveyState) are stripped; what remains is opinionated defaults plus the five safety hooks worth keeping by default.

## What lands

| Block | Purpose |
|---|---|
| `cleanupPeriodDays: 9000` | Keep session transcripts effectively forever; trim later if you actually need to |
| `env.DISABLE_AUTOUPDATER` and `env.FORCE_AUTOUPDATE_PLUGINS` | Stop Claude Code from auto-bumping the CLI binary out from under you, but always keep installed plugins fresh from their marketplaces |
| `env.CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION: "false"` | No autocompleted prompt suggestions in the input box |
| `env.CLAUDE_CODE_ENABLE_TASKS: "false"` | Disable the built-in tasks panel (skip if you actively use it) |
| `attribution.commit: ""` and `attribution.pr: ""` | Force-empty so Claude Code does not append AI attribution lines to commits or PRs |
| `permissions.defaultMode: "bypassPermissions"` | Opinionated. Skip the per-tool approval prompts. Pair with the five Bash safety hooks below; do not turn this on without them |
| `feedbackSurveyRate: 0`, `spinnerTipsEnabled: false`, `promptSuggestionEnabled: false`, `prefersReducedMotion: false`, `autoMemoryEnabled: false`, `todoFeatureEnabled: false` | Quieter UI, fewer nudges |
| `alwaysThinkingEnabled: true` | Extended thinking on by default |
| `effortLevel: "xhigh"` | Default reasoning budget. Adjust to taste |
| `skipDangerousModePermissionPrompt: true`, `skipAutoPermissionPrompt: true` | Skip the recurring "are you sure" gates once permissions mode is set |
| `verbose: false`, `showTurnDuration: true` | Slim transcript with turn timings |
| `agentPushNotifEnabled: true` | Push notifications when an agent finishes a background task |
| `voiceEnabled: true` | Voice input on |
| `statusLine` | Points at `~/.claude/statusline.sh`; pair this with `useful-stuff/status-lines/` |
| `hooks.PreToolUse[Bash]` | Five Bash safety hooks; see below |

## The five Bash safety hooks

Every hook is a PostToolUse-style guard that runs before a `Bash` tool call and denies with a clear reason if it matches. They never autofix; they only block + explain so the agent can pick the right command itself. Customize the regexes if your workflow legitimately needs one of these tools.

| Hook | Blocks | Why |
|---|---|---|
| `rm -rf home` | `rm -rf ~/`, `rm -rf $HOME`, `rm -rf /Users/...`, `rm -rf /home/...`, `rm -rf /<drive>/Users/...` | Catches the most destructive single mistake an agent can make |
| `npm` | Any command that invokes `npm` | Nudge toward `bun`; remove this if you use `npm` directly |
| `pip` / `pip3` | Any command that invokes `pip` or `pip3` | Nudge toward `uv`; remove this if you use `pip` directly |
| `ssh` / `scp` / `sftp` | Any of those three | If your agent should never reach out over the network with the user's keys, leave this on. Remove if you want agent-driven remote management |
| `op read` | The `op read <vault-uri>` form (matches `op://` literals) | Forces secret access through `op run --env-file=... -- <cmd>` so the secret value never lands in a tool result or transcript |

## What's deliberately not here

Things in the original settings.json that were personal and have been stripped:

- `model`: pinned default model. Set whatever you want
- `EDITOR` / `VISUAL`: editor command
- Sound hooks (SessionStart, Notification, PreCompact, PostToolUse-on-Bash-stderr): all point at local Peon WoW-voice scripts that aren't in this repo. Add your own if you want audio cues
- The `Stop` hook that runs `ccg update usage`: tracks usage in [claude-goblin](https://github.com/data-goblin/claude-goblin) and is irrelevant without it. Add your own Stop hook if you have one
- `theme`, `editorMode`, `preferredNotifChannel`: personal UI choices
- `enabledPlugins` and `extraKnownMarketplaces`: per-developer plugin selection
- `spinnerVerbs`: cosmetic
- `feedbackSurveyState`: timestamp

## Install

Either drop the file in fresh:

```bash
cp useful-stuff/agent-settings/settings.json ~/.claude/settings.json
```

or merge selectively. The hooks block is the most portable piece if you only want the safety net.

After installing, reload the Claude Code session (or run `/reload-plugins`).
