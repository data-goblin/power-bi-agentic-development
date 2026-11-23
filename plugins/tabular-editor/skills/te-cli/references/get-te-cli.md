# Get the `te` CLI binary

Install `te` only when the user asks for it. Official install and update notes: https://docs.tabulareditor.com/en/cli/

The binary is published per platform on a public CDN, no account needed:

    https://cdn.tabulareditor.com/files/latest/cli/te-<os>-<arch>.tar.gz   (.zip on Windows)

Assets: `te-osx-arm64`, `te-osx-x64`, `te-linux-x64`, `te-linux-arm64` (`.tar.gz`), `te-win-x64`, `te-win-arm64` (`.zip`).

The CDN publishes no checksum or signature (`.sha256`, `.sig` and `SHA256SUMS` next to the archive returned 404 on 2026-11-23). Say that to the user before installing; do not pipe the download into `tar` or a shell. Download to a file, print its SHA256, extract, then check the binary runs.

## macOS / Linux

```bash
os=$(uname -s | tr 'A-Z' 'a-z'); [ "$os" = darwin ] && os=osx
arch=$(uname -m); case "$arch" in arm64|aarch64) arch=arm64 ;; x86_64|amd64) arch=x64 ;; esac
dir=$(mktemp -d)
curl -fsSL -o "$dir/te.tar.gz" "https://cdn.tabulareditor.com/files/latest/cli/te-$os-$arch.tar.gz"
sha256sum "$dir/te.tar.gz" 2>/dev/null || shasum -a 256 "$dir/te.tar.gz"
mkdir -p "$HOME/.local/bin"
tar -xzf "$dir/te.tar.gz" -C "$HOME/.local/bin" te
"$HOME/.local/bin/te" --version
```

Add `~/.local/bin` to `PATH` in the shell profile if it is not there.

## Windows (PowerShell)

```powershell
$arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
$dir  = "$env:LOCALAPPDATA\Programs\te"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
Invoke-WebRequest "https://cdn.tabulareditor.com/files/latest/cli/te-win-$arch.zip" -OutFile "$env:TEMP\te.zip"
(Get-FileHash "$env:TEMP\te.zip" -Algorithm SHA256).Hash
Expand-Archive -Force "$env:TEMP\te.zip" -DestinationPath $dir
& "$dir\te.exe" --version
```

Add `$dir` to the user `Path` if it is not there.

## Notes

- `te --version` prints the build. `latest` is the newest build at download time
- The CDN answers GET only; HEAD returns 404. Probe a file with a ranged GET (`curl -r 0-99 -o /dev/null -w "%{http_code}"`)
- Preview builds stop working after 2026-12-31 (Learn: te-cli-limitations); check the docs for the licence that follows
