# Agent settings

A reference `~/.claude/settings.json` for projects or user settings.

## What lands

| Block | Purpose |
|---|---|
| `cleanupPeriodDays: 9000` | Keep session transcripts effectively forever; trim later if you actually need to |
| `env.DISABLE_AUTOUPDATER` and `env.FORCE_AUTOUPDATE_PLUGINS` | Stop Claude Code from auto-bumping the CLI binary out from under you, but always keep installed plugins fresh from their marketplaces |
| `env.CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION: "false"` | No autocompleted prompt suggestions in the input box |
| `env.CLAUDE_CODE_ENABLE_TASKS: "false"` | Disable the built-in tasks panel (skip if you actively use it) |
| `attribution.commit: ""` and `attribution.pr: ""` | Force-empty so Claude Code does not append AI attribution lines to commits or PRs |
| `permissions.defaultMode: "bypassPermissions"` | Run only in sandboxed containers; this is my personal preference. You can use auto mode too, but I personally do not like that as much. |
| `feedbackSurveyRate: 0`, `spinnerTipsEnabled: false`, `promptSuggestionEnabled: false`, `prefersReducedMotion: false`, `autoMemoryEnabled: false`, `todoFeatureEnabled: false` | Quieter UI, fewer nudges |
| `alwaysThinkingEnabled: true` | Extended thinking on by default |
| `effortLevel: "xhigh"` | Default reasoning budget. Adjust to taste |
| `skipDangerousModePermissionPrompt: true`, `skipAutoPermissionPrompt: true` | Skip the recurring "are you sure" gates once permissions mode is set |
| `verbose: false`, `showTurnDuration: true` | Slim transcript with turn timings |
| `agentPushNotifEnabled: true` | Push notifications when an agent finishes a background task |
| `voiceEnabled: true` | Voice input on |
| `skillListingMaxDescChars`, `skillListingBudgetFraction` | Tuning for how much of the skill-listing context budget descriptions may use |
| `autoUpdatesChannel: "stable"`, `tui: "fullscreen"`, `skipWorkflowUsageWarning: true` | Stable update channel, fullscreen TUI, and skip the workflow-usage warning |
| `statusLine` (with `hideVimModeIndicator: true`) | Points at `~/.claude/statusline.sh`; pair with `useful-stuff/status-lines/`. Hides Claude Code's built-in vim indicator since the statusline shows its own |
| `hooks.PreToolUse[Bash]` | Six Bash safety hooks; see below |

## Example Bash safety hooks

These are some example hooks that I use for safety purposes. They aren't a guarantee; claude can still easily get around these hooks. They are just examples of some things that are helpful to prevent agent mistakes when running in `bypassPermissions`.

| Hook | Blocks | Why |
|---|---|---|
| `rm -rf home` | `rm -rf ~/`, `rm -rf $HOME`, `rm -rf /Users/...`, `rm -rf /home/...`, `rm -rf /<drive>/Users/...` | Catches the most destructive single mistake an agent can make |
| `npm` | Any command that invokes `npm` | Nudge toward `bun`; remove this if you use `npm` directly |
| `pip` / `pip3` | Any command that invokes `pip` or `pip3` | Nudge toward `uv`; remove this if you use `pip` directly |
| `ssh` / `scp` / `sftp` | Any of those three | If your agent should never reach out over the network with the user's keys, leave this on. Remove if you want agent-driven remote management |
| `op read` | The `op read <vault-uri>` form (matches `op://` literals) | Forces secret access through `op run --env-file=... -- <cmd>` so the secret value never lands in a tool result or transcript. There are other better ways to do this using i.e. OneCLI to facilitate use of credentials only at runtime. |
| release-age bypass | `--no-minimum-release-age`, `--minimum-release-age=0`, `--ignore-min-release-age` on bun/npm | Stops the agent disabling the freshly-published-package guard (supply-chain risk). See `hooks/block-release-age-bypass/` |

## What's deliberately not here

Things in the original settings.json that were personal and have been stripped:

- `model`: pinned default model. Set whatever you want
- `EDITOR` / `VISUAL`: editor command
- Sound hooks (SessionStart, Notification, PreCompact, PostToolUse-on-Bash-stderr): all point at local audio scripts that aren't in this repo. Add your own if you want audio cues
- `theme`, `editorMode`, `preferredNotifChannel`: personal UI choices
- `enabledPlugins` and `extraKnownMarketplaces`: per-developer plugin selection
- `spinnerVerbs`: cosmetic

## How to use this

Do not copy these settings; just use them as a reference. You should check the settings.json schema regularly and see whether you can update or improve your settings. This should be a regular activity alongside memory maintenance.
