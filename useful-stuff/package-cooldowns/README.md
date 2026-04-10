# Package manager 7-day release cooldowns

Blocks package versions published within the last 7 days. Reduces exposure to supply-chain attacks where malicious releases typically get detected and yanked within hours to days; recent examples include the May 2026 mini-shai-hulud TanStack/router compromise. A short cooldown trades freshness for time-for-the-community-to-notice.

`setup-pkg-cooldowns.sh` upgrades each tool and writes the configs below. Run it on a new machine or after a major toolchain update. Each block is gated on `command -v <tool>` so the script is safe to run when some tools aren't installed.

## Tools covered

| Tool | Config file | Key | Value | Min version |
|---|---|---|---|---|
| uv | `~/.config/uv/uv.toml` | `exclude-newer` | `7 days` | 0.11.x |
| bun | `~/.bunfig.toml` | `[install] minimumReleaseAge` | `604800` (seconds) | 1.3.x |
| pnpm | `pnpm config` store (`~/Library/Preferences/pnpm/rc` on macOS, `~/.config/pnpm/rc` on Linux, `%APPDATA%\pnpm\rc` on Windows) | `minimumReleaseAge` | `7 days` | 10.16+ |
| npm | `~/.npmrc` | `min-release-age` | `7d` | 11.10+ |
| pip | `~/.config/pip/pip.conf` | `[install] uploaded-prior-to` | `P7D` | 26.1+ |

## Not covered

- **cargo**: stable `cargo` 1.95 has no native `config.toml` option for a release-age cooldown. The third-party [`cargo-cooldown`](https://crates.io/crates/cargo-cooldown) crate wraps `cargo` if you need this; not installed by the script.

## Customize the window

The script pins `DAYS=7` at the top. Change that constant if you want a different window. Note bun's `minimumReleaseAge` is in seconds and is computed as `DAYS * 86400`.

## Idempotent

Each block uses `grep + sed` to update an existing setting in place, falling back to `printf >>` to append a new one. Re-running the script does not duplicate keys; it overwrites the same line.

## Toolchain upgrade caveats

The script tries to self-upgrade each tool before writing the config (`uv self update`, `bun upgrade`, `pnpm self-update`, `rustup update stable`). It does NOT upgrade `npm` (you'll need `nvm install --lts` or `volta install node` separately) or `pip` (`python3 -m pip install --upgrade pip`). If the installed version is below the minimum listed above, the setting is written but silently ignored at install time. After running the script, verify with:

```bash
uv --version    # >= 0.11
bun --version   # >= 1.3
pnpm --version  # >= 10.16
npm --version   # >= 11.10
pip --version   # >= 26.1
```

## Verify the cooldown is active

```bash
uv config get exclude-newer 2>/dev/null || grep exclude-newer ~/.config/uv/uv.toml
grep -A1 '\[install\]' ~/.bunfig.toml
pnpm config get minimumReleaseAge
npm config get min-release-age
python3 -c "import configparser; p=configparser.ConfigParser(); p.read('${HOME}/.config/pip/pip.conf'); print(p.get('install','uploaded-prior-to', fallback='not set'))"
```
