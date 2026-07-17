# Statusline

A Claude Code statusline script laid out over two lines (line 1: time, folder, git; line 2: version, vim mode, model + effort, usage meters, marginal cost). Each segment is a separate file under `statusline.d/` and is sourced in numeric order, so you can edit one without touching the rest. A third line appears on demand when you click one of the usage meters (see [Clickable reset times](#clickable-reset-times)).

## Layout

```
status-lines/
├── statusline.sh        # entrypoint; reads JSON from Claude Code on stdin, sources segments
├── statusline-click.sh  # optional hyperlink handler; toggles the meter reset reveal on click
├── statusline.d/
│   ├── 01-version.sh    # Claude Code version (off by default)
│   ├── 02-host-cwd.sh   # host-colored cwd with a per-language repo glyph
│   ├── 03-git.sh        # branch, behind/unpushed count, change count, PR number (GitHub + Azure DevOps), worktree
│   ├── 04-model.sh      # model name, version, effort dots
│   ├── 04a-vim.sh       # vim mode indicator (when editorMode is vim)
│   ├── 05-time.sh       # HH:MM
│   ├── 06-meters.sh     # context %, 5-hour and 7-day rate % (click a bar to reveal its reset)
│   └── 07-cost.sh       # marginal $ spend, shown only in rate-limit overage or fast mode
└── README.md
```

## What each segment shows

| Segment | Output |
|---|---|
| version | Claude Code version. Off by default; enable with `ENABLE_VERSION=TRUE` |
| host-cwd | hostname + current directory, colored per host, with a per-language glyph for git repos. `$HOME` collapses to the hostname so paths read as `host/project/...` |
| git | `<branch> <behind> <unpushed> <+adds> <-deletes>` plus the current PR number, resolved from GitHub (Claude Code provides it) or Azure DevOps (via `az repos pr list`, cached on disk). The behind-count comes from a non-blocking background `git fetch` (TTL-cached); the LOC delta is background-refreshed too, so large trees never stall the render. Worktree-aware. Untracked files count as adds. `not tracking` when not in a repo. Unpushed commits render as a glyph plus count only, matching the incoming-pulls segment. Large file and LOC counts compact to three significant digits |
| vim | current vim mode (NORMAL / INSERT / VISUAL), colored lualine-style. Empty unless `editorMode` is `vim` |
| model | NerdFonts icon plus family name (Fable / Opus / Sonnet / Haiku); Fable uses a flame glyph, the others a robot. Version suffix is always shown (e.g. `Opus 4.8`). Effort dots are calibrated per family |
| time | `HH:MM` |
| meters | Context window %, 5-hour and 7-day rate-limit % with a linear projection to cycle end. Each colored by threshold (dim / yellow / orange / red / maroon). Click the 5-hour (`S`) or 7-day (`W`) bar to reveal/hide a third line with that window's reset time (see [Clickable reset times](#clickable-reset-times)). In overage the bar drops out and the cost segment stands in |
| cost | Marginal `$` spend for the current billable stint, in gold. Hidden on a subscription until spend actually matters: a rate window over 100% or fast mode on. Meters from the point the stint began, not the inflated cumulative session estimate |

## Clickable reset times

The 5-hour (`S`) and 7-day (`W`) usage bars are wrapped in OSC 8 hyperlinks. Clicking one toggles a third statusline line showing when that window's quota resets, both relative and wall-clock (e.g. `S resets in 2h13m (16:45)`). Click the same bar again to hide it; the two bars toggle independently.

This needs a little terminal setup and is **not supported in every terminal**. It was developed and tested in **Alacritty on macOS**; terminals that can only hand OSC 8 links to the OS opener (with no way to run a custom command on click) cannot drive the toggle. Three pieces:

1. **A hyperlink-click handler.** Point your terminal's hyperlink/hint click action at `statusline-click.sh`. It receives the clicked `file://` URL, flips the reset marker for the toggle URLs, and passes every other link through to your OS opener so normal links (cwd, PR) still open. In Alacritty (`alacritty.toml`):

   ```toml
   [[hints.enabled]]
   command = { program = "sh", args = ["-c", "exec /absolute/path/to/status-lines/statusline-click.sh \"$1\"", "_"] }
   hyperlinks = true
   mouse = { enabled = true, mods = "Control" }
   ```

2. **tmux passthrough (only if you use tmux).** OSC 8 hyperlinks must survive tmux:

   ```tmux
   set -as terminal-features ",*:hyperlinks"
   set -g allow-passthrough on
   ```

3. **A short refresh interval.** The statusline only re-renders on Claude Code's own cadence; there is no way for an external click to force an immediate redraw. Set `refreshInterval` to `1` (the supported minimum, sub-second is not supported) so the line appears or disappears within ~1s of a click. Leave it higher (e.g. `60`) if you don't use the click feature and prefer fewer refreshes.

Markers are plain files under `/tmp/claude-sl-toggle/`, scoped per session id and cleared on reboot.

When `STATUSLINE_CLICK_OPEN_LAZYGIT=TRUE`, the branch segment links to a marker
under `/tmp/claude-sl-lazygit/` and `statusline-click.sh` tries to open lazygit
for that repo. Path links are controlled by `STATUSLINE_CLICK_OPEN_PATHS`.

## Install

1. Drop the `status-lines/` directory anywhere on disk (commonly `~/.claude/statusline/` or kept under source control).
2. Make the entrypoint executable:
   ```
   chmod +x status-lines/statusline.sh
   ```
3. Point Claude Code at it via `~/.claude/settings.json`:
   ```json
   "statusLine": {
     "type": "command",
     "command": "bash /absolute/path/to/status-lines/statusline.sh",
     "refreshInterval": 60
   }
   ```
4. Reload the Claude Code session (or run `/reload-plugins`).

## Toggle segments

Edit the flags at the top of `statusline.sh`, or put overrides in a sibling
`statusline.config.sh` file:

```bash
ENABLE_TIME=TRUE
ENABLE_FOLDER=TRUE
ENABLE_BRANCH=TRUE
ENABLE_COMMITS=TRUE
ENABLE_PULLS=TRUE
ENABLE_FILE_CHANGES=TRUE
ENABLE_LOC_CHANGES=TRUE
ENABLE_MODEL=TRUE
ENABLE_MODEL_VERSION=TRUE
ENABLE_EFFORT=TRUE
ENABLE_CONTEXT=TRUE
ENABLE_LIMIT_5H=TRUE
ENABLE_LIMIT_WEEKLY=TRUE
STATUSLINE_METER_STYLE=steps    # label, steps, bar, thin
STATUSLINE_CONTEXT_STYLE=percent # percent, bar
STATUSLINE_CLICKABLE_RESETS=TRUE
STATUSLINE_CLICK_OPEN_PATHS=TRUE
STATUSLINE_CLICK_OPEN_LAZYGIT=FALSE
```

Set any `ENABLE_*` flag to anything other than `TRUE` and that component is
skipped. The older coarse flags (`ENABLE_HOST_CWD`, `ENABLE_GIT`,
`ENABLE_METERS`) still work. Drop new segment files into `statusline.d/` named
`<NN>-<name>.sh` and wire a `load_segment` call at the bottom of
`statusline.sh` to add your own.

## Host colors

The host-color block near the bottom of `statusline.sh` is the main thing to localize:

```bash
case "$host_lower" in
    hostname1) host_color="$MINT" ;;
    hostname2) host_color="$PINK" ;;
    hostname3) host_color="$PASTEL_BLUE" ;;
    hostname4) host_color="$PURPLE" ;;
    *)         host_color="$PINK" ;;
esac
```

Replace `hostname1`/`hostname2`/etc. with the output of `hostname -s` on each of your machines. The available color variables are defined just above the model-detection block: `PINK`, `GREEN`, `RED`, `YELLOW`, `ORANGE`, `BRIGHT_RED`, `MAROON`, `GOLD`, `PASTEL_BLUE`, `MINT`, `CHARTREUSE`, `PURPLE`, `CRIMSON`.

There is also an optional `display_host` block higher up for shortening a long hostname:

```bash
case "$host_lower" in
    # example-long-hostname) display_host="short" ;;
    *) display_host="$host" ;;
esac
```

## Effort dots

Effort calibration lives in the model case-statement. Fable and Opus 4.7+ have 5 levels (low/medium/high/xhigh/max), where `ultracode` maps to the xhigh dot pattern; Opus 4.6 and Sonnet 4.6 have 4 (xhigh falls back to high); Haiku has no effort and stays blank. Add cases for new models as they ship.

## Requirements

- `bash`, `jq`, `git`, `gh` (GitHub PR detection); optionally `az` for Azure DevOps PR detection. The git segment degrades silently if any are missing
- A Nerd Font in your terminal for the robot icon and branch glyph (JetBrainsMono NF 3.4.0 was used during development)
- `timeout` (Linux) or `gtimeout` (macOS via coreutils); falls back to no-timeout if neither is available
- On Windows, `cygpath` is used to POSIX-ify the cwd if available
