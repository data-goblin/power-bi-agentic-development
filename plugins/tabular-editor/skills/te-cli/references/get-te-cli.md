# Get the `te` CLI binary (agent self-service)

The `te` (Tabular Editor CLI) binary is published per platform on a public CDN,
no account or auth needed:

    https://cdn.tabulareditor.com/files/cli/latest/te-<os>-<arch>.tar.gz   (.zip on Windows)

Pick the asset for the platform:

- macOS arm64 (Apple Silicon): `te-osx-arm64.tar.gz`
- macOS x64 (Intel): `te-osx-x64.tar.gz`
- Linux x64: `te-linux-x64.tar.gz`
- Linux arm64: `te-linux-arm64.tar.gz`
- Windows x64: `te-win-x64.zip`
- Windows arm64: `te-win-arm64.zip`

## macOS / Linux: detect, download, put on PATH

```bash
os=$(uname -s | tr 'A-Z' 'a-z'); [ "$os" = darwin ] && os=osx
arch=$(uname -m); case "$arch" in arm64|aarch64) arch=arm64 ;; x86_64|amd64) arch=x64 ;; esac
mkdir -p "$HOME/.local/bin"
curl -fsSL "https://cdn.tabulareditor.com/files/cli/latest/te-$os-$arch.tar.gz" \
  | tar xz -C "$HOME/.local/bin" te
chmod +x "$HOME/.local/bin/te"
export PATH="$HOME/.local/bin:$PATH"          # this shell
"$HOME/.local/bin/te" --version
```

Persist PATH across shells once (skip if `~/.local/bin` is already on PATH):

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc   # or ~/.zshrc
```

## Windows (PowerShell): download, put on PATH

```powershell
$arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
$dir  = "$env:LOCALAPPDATA\Programs\te"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
Invoke-WebRequest "https://cdn.tabulareditor.com/files/cli/latest/te-win-$arch.zip" -OutFile "$env:TEMP\te.zip"
Expand-Archive -Force "$env:TEMP\te.zip" -DestinationPath $dir
[Environment]::SetEnvironmentVariable('Path', "$([Environment]::GetEnvironmentVariable('Path','User'));$dir", 'User')
& "$dir\te.exe" --version
```

## Verify and stay current

`te --version` prints the build. The CDN `latest` path is always the newest at
download time; for a binary that keeps itself current, use the self-updating
`te` wrapper instead (`te --update`, plus a daily check on `te --version`).
