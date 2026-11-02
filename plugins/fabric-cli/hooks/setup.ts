import type { Setup, SetupKind } from '../types'
import type { Tier } from './icons'
import type { RowSpec, Seg } from './rows'

const ICON_COLOR = '#2dd4bf'
const COMMAND_COLOR = '#7dd3fc'
const TEXT_COLOR = '#c5c5cf'
const QUIET_COLOR = '#8a8a96'

export const COPY = 'copy:'
export const REFRESH = 'refresh'

const ICONS: Record<'missing' | 'install' | 'signin' | 'signedout' | 'unreachable', { nerd: string; plain: string }> = {
  missing: { nerd: '\u{f071}', plain: '✗' },
  install: { nerd: '\u{f019}', plain: '↓' },
  signin: { nerd: '\u{f090}', plain: '→' },
  signedout: { nerd: '\u{f023}', plain: '⊘' },
  unreachable: { nerd: '\u{f05aa}', plain: '≠' },
}

const NETWORK =
  /timed? ?out|timeout|name or service not known|nodename nor servname|getaddrinfo|temporary failure in name resolution|NameResolutionError|failed to resolve|could not resolve host|ENOTFOUND|EAI_AGAIN|connection (was )?(refused|reset|aborted)|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH|network is unreachable|no route to host|NewConnectionError|ConnectTimeoutError|ReadTimeoutError|failed to establish a new connection|max retries exceeded with url|ProxyError|proxy error|unable to connect to proxy|cannot connect to proxy|tunnel connection failed|407 proxy|SSLError|CERTIFICATE_VERIFY_FAILED|failed to connect/i
const SIGNED_OUT =
  /\b401\b|unauthori[sz]ed|not (logged|signed) in|not authenticated|no credentials|credentials? (is |are )?missing|authentication credential is missing|token (has )?expired|expired token|invalid (jwt )?token|token is invalid|failed to (get|obtain|acquire) (an )?access token|failed to decode jwt|(could not|cannot|unable to) configure default credentials|default credentials? (were )?not found|no (configuration|profile) (was )?found|auth(entication)? (is )?required|fab auth login|re-?login|(tenant|client) id is required|FAB_TENANT_ID must be set|interaction_required|invalid_grant|AADSTS\d+/i
const AUTH_CODES = /^(Unauthorized|AuthenticationFailed|ServicePrincipalAuthMissing|TokenExpired|InvalidToken|NotAuthenticated)$/i
const EXIT_NOT_FOUND = 127
const EXIT_AUTHORIZATION_REQUIRED = 4

export class CliError extends Error {
  readonly kind: SetupKind | ''

  constructor(message: string, kind: SetupKind | '') {
    super(message)
    this.kind = kind
  }
}

function firstLine(text: string): string {
  for (const raw of text.replace(/\x1b\[[0-9;]*m/g, '').split('\n')) {
    const line = raw.trim().replace(/^x\s+/, '')
    if (line) return line
  }
  return ''
}

function reported(stdout: string): { message: string; code: string } {
  const at = stdout.indexOf('{')
  if (at < 0) return { message: '', code: '' }
  try {
    const body = JSON.parse(stdout.slice(at)) as { result?: { message?: unknown; error_code?: unknown } }
    const message = typeof body.result?.message === 'string' ? body.result.message : ''
    const code = typeof body.result?.error_code === 'string' ? body.result.error_code : ''
    return { message: firstLine(message), code }
  } catch {
    return { message: '', code: '' }
  }
}

const MISSING = /ENOENT|not found|no such file|cannot start|could not start|failed to start/i

export function isAborted(err: unknown): boolean {
  return !(err instanceof CliError) && /aborted/i.test(err instanceof Error ? err.message : String(err))
}

export function spawnFailure(err: unknown, bin: string): Error {
  const text = err instanceof Error ? err.message : String(err)
  if (isAborted(err) && !/ENOENT/.test(text)) return err instanceof Error ? err : new Error(text)
  if (NETWORK.test(text)) return new CliError(firstLine(text) || `${bin} timed out`, 'unreachable')
  return new CliError(firstLine(text) || `${bin} could not start`, MISSING.test(text) ? 'missing' : '')
}

export function runFailure(run: { exitCode: number; stdout: string; stderr: string }, fallback: string): CliError {
  const json = reported(run.stdout)
  const line = json.message || firstLine(run.stderr) || firstLine(run.stdout) || fallback
  const all = `${json.message}\n${run.stderr}\n${run.stdout}`
  if (run.exitCode === EXIT_NOT_FOUND) return new CliError(line, 'missing')
  if (NETWORK.test(all)) return new CliError(line, 'unreachable')
  if (run.exitCode === EXIT_AUTHORIZATION_REQUIRED || AUTH_CODES.test(json.code) || SIGNED_OUT.test(all)) return new CliError(line, 'signed-out')
  return new CliError(line, '')
}

export function setupOf(err: unknown): Setup | null {
  return err instanceof CliError && err.kind ? { kind: err.kind, line: err.message } : null
}

type Part = { t: string; cmd?: string; refresh?: true; keep?: true; b?: true; c?: string }
const INDENT = '  '

type Line = { parts: Part[]; command?: string; head?: boolean }

const say = (t: string, c = TEXT_COLOR): Line => ({ parts: [{ t, c }] })
const command = (cmd: string): Line => ({ parts: [{ t: cmd, c: COMMAND_COLOR, keep: true }], command: cmd })
const gap: Line = { parts: [] }

function copyFor(kind: SetupKind, line: string, icon: (k: keyof typeof ICONS) => string): Line[] {
  const title = (k: keyof typeof ICONS, t: string): Line => ({ parts: [{ t: `${icon(k)} `, c: ICON_COLOR }, { t, b: true }], head: true })
  const press = (t: string): Part => ({ t, refresh: true, c: COMMAND_COLOR })
  const inline = (cmd: string): Part => ({ t: cmd, cmd, c: COMMAND_COLOR })
  if (kind === 'missing') {
    return [
      title('missing', 'Fabric CLI not found'),
      say('This pane needs the Fabric CLI (fab).'),
      gap,
      title('install', 'Install it'),
      command('uv tool install ms-fabric-cli'),
      { parts: [{ t: 'No uv yet? ', c: TEXT_COLOR }, inline('brew install uv'), { t: ' or ', c: TEXT_COLOR }, inline('winget install uv')] },
      gap,
      title('signin', 'Then sign in'),
      command('fab auth login'),
      gap,
      { parts: [{ t: 'Press ', c: QUIET_COLOR }, press('↻'), { t: " when you're done. Or ask Claude to set it up for you.", c: QUIET_COLOR }] },
    ]
  }
  if (kind === 'signed-out') {
    return [
      title('signedout', 'Not signed in to Fabric'),
      command('fab auth login'),
      gap,
      { parts: [{ t: 'Press ', c: QUIET_COLOR }, press('↻'), { t: " when you're done. To check which account you use: ", c: QUIET_COLOR }, inline('fab auth status')] },
    ]
  }
  return [
    title('unreachable', "Can't reach Fabric"),
    say(line, QUIET_COLOR),
    { parts: [{ t: 'Check your network or proxy, then press ', c: QUIET_COLOR }, press('↻'), { t: '.', c: QUIET_COLOR }] },
  ]
}

function seg(p: Part, t: string): Seg {
  return { t, ...(p.c ? { c: p.c } : {}), ...(p.b ? { b: true } : {}), ...(p.cmd ? { tab: COPY + p.cmd } : p.refresh ? { tab: REFRESH } : {}) }
}

function chunks(word: string, width: number): string[] {
  const chars = [...word]
  if (chars.length <= width) return [word]
  const out: string[] = []
  for (let i = 0; i < chars.length; i += width) out.push(chars.slice(i, i + width).join(''))
  return out
}

function wrapped(parts: Part[], width: number): Seg[][] {
  const lines: Seg[][] = [[]]
  let used = 0
  for (const p of parts) {
    const words = p.cmd || p.refresh || p.keep ? [p.t] : (p.t.match(/\S+\s*|\s+/g) ?? []).flatMap(w => chunks(w, width))
    for (const word of words) {
      const size = [...word.trimEnd()].length
      if (used > 0 && used + size > width) {
        lines.push([])
        used = 0
      }
      const t = used === 0 ? word.trimStart() : word
      if (!t) continue
      lines[lines.length - 1]?.push(seg(p, t))
      used += [...t].length
    }
  }
  return lines
}

export function setupRows(setup: Setup, tier: Tier, width: number): RowSpec[] {
  const icon = (k: keyof typeof ICONS) => (tier === 'plain' ? ICONS[k].plain : ICONS[k].nerd)
  const blank: RowSpec = { id: '', left: [{ t: ' ' }], right: [] }
  return [
    blank,
    ...copyFor(setup.kind, setup.line, icon).flatMap(line => {
      if (line.parts.length === 0) return [blank]
      const indent = line.head ? '' : INDENT
      return wrapped(line.parts, Math.max(8, width - indent.length)).map(left => ({ id: line.command ? COPY + line.command : '', left: indent ? [{ t: indent }, ...left] : left, right: [] }))
    }),
  ]
}
