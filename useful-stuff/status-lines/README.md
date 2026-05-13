# Statusline

A Claude Code statusline script with five segments: host + cwd, git status, model + effort, time, and three usage meters. Each segment is a separate file under `statusline.d/` and is sourced in numeric order, so you can edit one without touching the rest.

## Layout

```
status-lines/
├── statusline.sh        # entrypoint; reads JSON from Claude Code on stdin, sources segments
├── statusline.d/
│   ├── 02-host-cwd.sh   # host-colored cwd
│   ├── 03-git.sh        # branch, change count, current PR number
│   ├── 04-model.sh      # model name, version, effort dots
│   ├── 05-time.sh       # HH:MM
│   └── 06-meters.sh     # context %, 5-hour rate %, 7-day rate %
└── README.md
```

## What each segment shows

| Segment | Output |
|---|---|
| host-cwd | hostname + current directory, colored per host. `$HOME` collapses to the hostname so paths read as `host/project/...` |
| git | `<branch> <+adds> <-deletes>` plus the current PR number if `gh pr view` resolves one. Untracked files count as adds. `not tracking` when not in a repo |
| model | NerdFonts robot icon plus family name (Opus / Sonnet / Haiku). Older releases keep their version suffix; the family-latest hides it. Effort dots are calibrated per family |
| time | `HH:MM` |
| meters | Context window %, 5-hour rate-limit %, 7-day rate-limit %. Each colored by threshold (dim / yellow / orange / red / maroon) |

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
LATEST_OPUS_ID="opus-4-7"
LATEST_SONNET_ID="sonnet-4-6"
LATEST_HAIKU_ID="haiku-4-5"
```

## Effort dots

Effort calibration lives in the model case-statement. Opus 4.7 has 5 levels (low/medium/high/xhigh/max); Opus 4.6 and Sonnet 4.6 have 4 (xhigh falls back to high); Haiku has no effort and stays blank. Add cases for new models as they ship.

## Requirements

- `bash`, `jq`, `git`, `gh` (for PR detection; the segment degrades silently if missing)
- A Nerd Font in your terminal for the robot icon and branch glyph (JetBrainsMono NF 3.4.0 was used during development)
- `timeout` (Linux) or `gtimeout` (macOS via coreutils); falls back to no-timeout if neither is available
- On Windows, `cygpath` is used to POSIX-ify the cwd if available
