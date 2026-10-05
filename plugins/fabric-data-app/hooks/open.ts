export const LINUX_LAUNCH = 'setsid -f -w "$@" </dev/null >/dev/null 2>&1 & p=$!; sleep 1; kill -0 "$p" 2>/dev/null && exit 0; wait "$p"'

export const LINUX_OPEN = [
  'set -f',
  'f=$1',
  'if command -v gio >/dev/null; then',
  '  if [ -f "$f" ] && command -v file >/dev/null && encoding=$(file -b --mime-encoding -- "$f") && [ -n "$encoding" ] && [ "$encoding" != binary ]; then',
  '    case $(gio info -a standard::content-type -- "$f" | sed -n \'s/.*standard::content-type: //p\') in',
  '      video/* | audio/*)',
  '        app=$(xdg-mime query default text/plain)',
  '        IFS=:',
  '        for dir in "${XDG_DATA_HOME:-$HOME/.local/share}" ${XDG_DATA_DIRS:-/usr/local/share:/usr/share}; do',
  '          [ -n "$app" ] && [ -f "$dir/applications/$app" ] && exec gio launch "$dir/applications/$app" "$f"',
  '        done',
  '        echo "No text/plain desktop application found for $f" >&2',
  '        exit 1',
  '        ;;',
  '    esac',
  '  fi',
  '  if (exec gio open "$f"); then exit 0; fi',
  'fi',
  'exec xdg-open "$f"',
].join('\n')

const WIN_OPEN = "$ErrorActionPreference = 'Stop'; [Diagnostics.Process]::Start([Diagnostics.ProcessStartInfo]@{ FileName = $env:PANE_OPEN_TARGET; UseShellExecute = $true }) | Out-Null"

export function openCommand(os: 'linux' | 'darwin' | 'win32', target: string) {
  const argv = os === 'linux'
    ? ['sh', '-c', LINUX_LAUNCH, 'sh', 'sh', '-c', LINUX_OPEN, 'sh', target]
    : os === 'darwin'
      ? ['open', '--', target]
      : ['powershell', '-NoProfile', '-NonInteractive', '-Command', WIN_OPEN]
  return {
    argv,
    init: {
      timeoutMs: 10_000,
      ...(os === 'win32' ? { env: { PANE_OPEN_TARGET: /^[a-z][a-z0-9+.-]*:\/\//i.test(target) ? target : target.replace(/\//g, '\\') } } : {}),
    },
  }
}
