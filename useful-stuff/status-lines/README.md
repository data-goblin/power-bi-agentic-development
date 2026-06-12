# Statusline

A Claude Code statusline script laid out over two lines (line 1: time, host + cwd, git; line 2: version, vim mode, model + effort, usage meters). Each segment is a separate file under `statusline.d/` and is sourced in numeric order, so you can edit one without touching the rest. A third line appears on demand when you click one of the usage meters (see [Clickable reset times](#clickable-reset-times)).

## Layout

```
status-lines/
├── statusline.sh        # entrypoint; reads JSON from Claude Code on stdin, sources segments
├── statusline-click.sh  # optional hyperlink handler; toggles the meter reset reveal on click
├── statusline.d/
│   ├── 01-version.sh    # Claude Code version (off by default)
│   ├── 02-host-cwd.sh   # host-colored cwd with a per-language repo glyph
│   ├── 03-git.sh        # branch, change count, PR number (GitHub + Azure DevOps), worktree
│   ├── 04-model.sh      # model name, version, effort dots
│   ├── 04a-vim.sh       # vim mode indicator (when editorMode is vim)
│   ├── 05-time.sh       # HH:MM
│   └── 06-meters.sh     # context %, 5-hour and 7-day rate % (click a bar to reveal its reset)
└── README.md
```

## What each segment shows

| Segment | Output |
|---|---|
| version | Claude Code version. Off by default; enable with `ENABLE_VERSION=TRUE` |
| host-cwd | hostname + current directory, colored per host, with a per-language glyph for git repos. `$HOME` collapses to the hostname so paths read as `host/project/...` |
| git | `<branch> <+adds> <-deletes>` plus the current PR number, resolved from GitHub (Claude Code provides it) or Azure DevOps (via `az repos pr list`, cached on disk). Worktree-aware. Untracked files count as adds. `not tracking` when not in a repo |
| vim | current vim mode (NORMAL / INSERT / VISUAL), colored lualine-style. Empty unless `editorMode` is `vim` |
| model | NerdFonts icon plus family name (Fable / Opus / Sonnet / Haiku); Fable uses a flame glyph, the others a robot. Older releases keep their version suffix; the family-latest hides it. Effort dots are calibrated per family |
| time | `HH:MM` |
| meters | Context window %, 5-hour and 7-day rate-limit % with a linear projection to cycle end. Each colored by threshold (dim / yellow / orange / red / maroon). Click the 5-hour (`S`) or 7-day (`W`) bar to reveal/hide a third line with that window's reset time (see [Clickable reset times](#clickable-reset-times)) |

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

Edit the flags at the top of `statusline.sh`:

```bash
ENABLE_HOST_CWD=TRUE
ENABLE_GIT=TRUE
ENABLE_MODEL=TRUE
ENABLE_TIME=TRUE
ENABLE_METERS=TRUE
ENABLE_VERSION=FALSE
ENABLE_VIM=TRUE
```

Set any to anything other than `TRUE` and the segment is skipped. Drop new segment files into `statusline.d/` named `<NN>-<name>.sh` and wire a `load_segment` call at the bottom of `statusline.sh` to add your own.

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

## Model-latest pins

The script hides the version suffix on the family-latest model and shows it on older ones. Bump these when a new model takes the family lead:

```bash
LATEST_FABLE_ID="fable-5"
LATEST_OPUS_ID="opus-4-7"
LATEST_SONNET_ID="sonnet-4-6"
LATEST_HAIKU_ID="haiku-4-5"
```

## Effort dots

Effort calibration lives in the model case-statement. Fable and Opus 4.7+ have 5 levels (low/medium/high/xhigh/max), where `ultracode` maps to the xhigh dot pattern; Opus 4.6 and Sonnet 4.6 have 4 (xhigh falls back to high); Haiku has no effort and stays blank. Add cases for new models as they ship.

## Requirements

- `bash`, `jq`, `git`, `gh` (GitHub PR detection); optionally `az` for Azure DevOps PR detection. The git segment degrades silently if any are missing
- A Nerd Font in your terminal for the robot icon and branch glyph (JetBrainsMono NF 3.4.0 was used during development)
- `timeout` (Linux) or `gtimeout` (macOS via coreutils); falls back to no-timeout if neither is available
- On Windows, `cygpath` is used to POSIX-ify the cwd if available
