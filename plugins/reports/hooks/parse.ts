import type { Target } from '../types'

export type Invocation = { bin: string; args: string[]; cwd: string; maybe: boolean }

const SEPARATORS = new Set(['&&', '||', ';', '|', '&', '\n'])
const REDIRECT = /^(\d*>>?|\d*<|\d*>&\d*|&>>?)$/

let drives = false
let home = ''

export function useDrives(on: boolean): void {
  drives = on
}

export function useHome(path: string): void {
  home = path.replace(/\/+$/, '')
}

export function posix(path: string): string {
  if (!drives) return path
  return path.replace(/\\/g, '/').replace(/^\/([A-Za-z])(\/|$)/, (_, d: string) => `${d.toUpperCase()}:/`)
}

export function isAbsolute(path: string): boolean {
  return path.startsWith('/') || (drives && /^[A-Za-z]:\//.test(path))
}

export function tokenize(command: string): string[] {
  const out: string[] = []
  let cur = ''
  let quote = ''
  let has = false
  for (let i = 0; i < command.length; i++) {
    const ch = command[i] ?? ''
    if (!quote && ch === '#' && !has && !cur) {
      while (i + 1 < command.length && command[i + 1] !== '\n') i++
      continue
    }
    if (quote) {
      if (ch === quote) quote = ''
      else if (ch === '\\' && quote === '"' && /[$`"\\\n]/.test(command[i + 1] ?? '')) cur += (command[++i] ?? '').replace('\n', '')
      else cur += ch
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      has = true
    } else if (ch === '\\' && i + 1 < command.length) {
      cur += command[++i] ?? ''
      has = true
    } else if (ch === '\n') {
      if (has || cur) out.push(cur)
      cur = ''
      has = false
      out.push('\n')
    } else if (/\s/.test(ch)) {
      if (has || cur) out.push(cur)
      cur = ''
      has = false
    } else if (ch === '>' || ch === '<') {
      let op = /^\d+$/.test(cur) || (cur === '&' && !has) ? cur : ''
      if (!op && (has || cur)) out.push(cur)
      op += ch
      while (command[i + 1] === '>' || command[i + 1] === '&' || /\d/.test(command[i + 1] ?? '')) {
        if (command[i + 1] === '&' && op.endsWith('&')) break
        op += command[++i]
      }
      out.push(op)
      cur = ''
      has = false
    } else if (ch === ';' || ch === '|' || ch === '&') {
      if (ch === '&' && command[i + 1] === '>') {
        if (has || cur) out.push(cur)
        cur = '&'
        has = false
        continue
      }
      if (has || cur) out.push(cur)
      cur = ''
      has = false
      const two = command.slice(i, i + 2)
      if (two === '&&' || two === '||') {
        out.push(two)
        i++
      } else out.push(ch)
    } else {
      cur += ch
      has = true
    }
  }
  if (has || cur) out.push(cur)
  if (!quote) return out
  return command
    .split(/(&&|\|\||[;|\n])/)
    .flatMap(part => (/^(&&|\|\||[;|\n])$/.test(part) ? [part] : part.trim().split(/\s+/).filter(Boolean)))
}

export function join(base: string, raw: string): string {
  let path = posix(raw)
  if (path === '~' || path.startsWith('~/')) {
    if (!home) return path
    path = home + path.slice(1)
  }
  const drive = isAbsolute(path) && !path.startsWith('/') ? path.slice(0, 2) : ''
  const parts = isAbsolute(path) ? [drive] : base.split('/')
  for (const seg of path.slice(drive.length).split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') {
      if (parts.length > 1) parts.pop()
    } else parts.push(seg)
  }
  return parts.length > 1 ? parts.join('/') : `${parts[0] ?? ''}/`
}

export function binOf(bin: string, cwd: string, name: string): string {
  const path = posix(bin)
  if (!path.includes('/') || /[~$`]/.test(path)) return name
  if (isAbsolute(path)) return join('/', path)
  return isAbsolute(cwd) && !/[~$`]/.test(cwd) ? join(cwd, path) : name
}

export function invocations(command: string, sessionCwd: string): Invocation[] {
  const toks = tokenize(command)
  const found: Invocation[] = []
  let cwd = sessionCwd
  let start = true
  let maybe = false
  let gate = -1
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i] ?? ''
    if (SEPARATORS.has(t)) {
      if (t === '&&' && gate < 0) gate = found.length
      if (t === '||' && gate >= 0) for (const inv of found.slice(gate)) inv.maybe = true
      if (t !== '|' && t !== '&&' && t !== '||') gate = -1
      if (t !== '|') maybe = t === '||'
      start = true
      continue
    }
    if (!start) continue
    start = false
    let j = i
    while (j < toks.length && /^[A-Z_][A-Z0-9_]*=/.test(toks[j] ?? '')) j++
    const bin = toks[j] ?? ''
    const head = bin.split('/').pop()
    const dir = toks[j + 1]
    if (head === 'cd' && dir && !SEPARATORS.has(dir)) {
      cwd = join(cwd, dir)
      continue
    }
    if (head !== 'pbir') continue
    const args: string[] = []
    let k = j + 1
    while (k < toks.length && !SEPARATORS.has(toks[k] ?? '')) {
      const tok = toks[k++] ?? ''
      if (REDIRECT.test(tok)) {
        if (!/&\d*$/.test(tok) || tok.startsWith('&')) k++
        continue
      }
      args.push(tok)
    }
    found.push({ bin, args, cwd, maybe })
    i = k - 1
  }
  return found
}

function flag(args: string[], names: string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? ''
    for (const n of names) {
      if (a === n) return args[i + 1]
      if (a.startsWith(n + '=')) return a.slice(n.length + 1)
    }
  }
  return undefined
}

function positionals(args: string[], valued: string[]): string[] {
  const out: string[] = []
  for (let i = 1; i < args.length; i++) {
    const a = args[i] ?? ''
    if (a.startsWith('-')) {
      if (valued.includes(a)) i++
      continue
    }
    out.push(a)
  }
  return out
}

export function pbirReport(inv: Invocation): string | null {
  const { args, cwd } = inv
  if (args[0] === 'connect') {
    const pos = positionals(args, ['-o', '--output', '-p', '--profile'])
    const [first, second] = pos
    if (first && !second) return join(cwd, first.replace(/\/$/, ''))
    if (first && second) {
      const ws = first.replace(/\.Workspace$/, '')
      const rpt = second.replace(/\.Report$/, '')
      const out = flag(args, ['-o', '--output'])
      return join(out ? join(cwd, out) : cwd, `${ws}.Workspace/${rpt}.Report`)
    }
  }
  for (const a of args.slice(1)) {
    const m = a.match(/^(.*?\.Report)(\/|$)/)
    if (m?.[1]) return join(cwd, m[1])
  }
  return null
}

export function targetLabel(t: Target | null): string {
  return t ? t.path.split('/').filter(Boolean).slice(-2).join('/') : 'no target'
}
