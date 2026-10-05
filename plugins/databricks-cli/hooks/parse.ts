export type Invocation = { tool: string; bin: string; args: string[]; cwd: string; env: Record<string, string> }

const SEPARATORS = new Set(['&&', '||', ';', '|', '&', '\n', '(', ')', '`'])
const PREFIXES = new Set(['do', 'then', 'else', 'elif', 'if', '!', 'time', '{', 'env', 'command', 'builtin', 'exec', 'nohup', 'sudo', 'nice', 'xargs', 'uvx', 'pipx', 'timeout', 'while', 'until'])
const PREFIX_VALUED: Record<string, Set<string>> = {
  sudo: new Set(['-u', '-g', '-C', '-h', '-p', '-U', '-r', '-t', '-D']),
  timeout: new Set(['-k', '-s', '--kill-after', '--signal']),
  xargs: new Set(['-n', '-I', '-P', '-L', '-s', '-d', '-E', '-a']),
  env: new Set(['-u', '-C', '-S', '--unset', '--chdir']),
  nice: new Set(['-n']),
  exec: new Set(['-a']),
  uvx: new Set(['--from', '--with', '-p', '--python']),
  uv: new Set(['--from', '--with', '-p', '--python', '--project', '--directory']),
  pipx: new Set(['--spec', '--python']),
}
const MAX_CALLS = 50
const REDIRECT = /^(\d*>>?|\d*<|\d*>&\d*|&>>?)$/

let drives = false

export function useDrives(on: boolean): void {
  drives = on
}

export function posix(path: string): string {
  if (!drives) return path
  return path.replace(/\\/g, '/').replace(/^\/([A-Za-z])(\/|$)/, (_, d: string) => `${d.toUpperCase()}:/`)
}

export function isAbsolute(path: string): boolean {
  return path.startsWith('/') || (drives && /^[A-Za-z]:\//.test(path))
}

export function tokenize(command: string, subs: { at: number; body: string }[] = []): string[] {
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
      else if (ch === '\\' && quote === '"' && i + 1 < command.length) cur += command[++i] ?? ''
      else if (quote === '"' && ((ch === '$' && command[i + 1] === '(') || ch === '`')) {
        const end = closing(command, i)
        if (end < 0) cur += ch
        else {
          subs.push({ at: out.length, body: command.slice(ch === '`' ? i + 1 : i + 2, end) })
          cur += command.slice(i, end + 1)
          i = end
        }
      } else cur += ch
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
    } else if (ch === '(' || ch === ')' || ch === '`') {
      if (has || cur) out.push(cur)
      cur = ''
      has = false
      out.push(ch)
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
  const path = posix(raw)
  if (isAbsolute(path)) return path
  if (path.startsWith('~/')) return path
  const parts = base.split('/')
  for (const seg of path.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') parts.pop()
    else parts.push(seg)
  }
  return parts.join('/') || '/'
}

function operators(line: string): { word: string; tabs: boolean; expand: boolean }[] {
  const found: { word: string; tabs: boolean; expand: boolean }[] = []
  const outer: boolean[] = []
  let single = false
  let double = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (single) {
      if (ch === "'") single = false
      continue
    }
    if (ch === '\\') {
      i++
      continue
    }
    if (ch === '$' && line[i + 1] === '(') {
      outer.push(double)
      double = false
      i++
      continue
    }
    if (ch === ')' && outer.length && !double) {
      double = outer.pop() ?? false
      continue
    }
    if (ch === '"') {
      double = !double
      continue
    }
    if (double) continue
    if (ch === "'") {
      single = true
      continue
    }
    if (ch === '#' && (i === 0 || /\s/.test(line[i - 1] ?? ''))) break
    if (ch === '<' && line[i + 1] === '<' && line[i + 2] !== '<') {
      const m = line.slice(i).match(/^<<(-?)\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2/)
      if (m) {
        found.push({ word: m[3] ?? '', tabs: m[1] === '-', expand: !m[2] })
        i += m[0].length - 1
      }
    }
  }
  return found
}

function heredocless(command: string): string {
  const out: string[] = []
  const pending: { word: string; tabs: boolean; expand: boolean }[] = []
  for (const line of command.split('\n')) {
    const head = pending[0]
    if (head) {
      if ((head.tabs ? line.replace(/^\t+/, '') : line) === head.word) pending.shift()
      else if (head.expand) out.push(...substitutions(line))
      continue
    }
    out.push(line)
    pending.push(...operators(line))
  }
  return out.join('\n')
}

function closing(command: string, i: number): number {
  if (command[i] === '`') {
    let j = i + 1
    while (j < command.length && command[j] !== '`') j += command[j] === '\\' ? 2 : 1
    return j < command.length ? j : -1
  }
  let depth = 0
  for (let j = i + 1; j < command.length; j++) {
    if (command[j] === '(') depth++
    else if (command[j] === ')' && --depth === 0) return j
  }
  return -1
}

function substitutions(command: string): string[] {
  const out: string[] = []
  let single = false
  let double = false
  for (let i = 0; i < command.length; i++) {
    const ch = command[i]
    if (single) {
      if (ch === "'") single = false
      continue
    }
    if (ch === '\\') {
      i++
      continue
    }
    if (ch === "'" && !double) {
      single = true
      continue
    }
    if (ch === '"') {
      double = !double
      continue
    }
    if (ch === '#' && !double && (i === 0 || /\s/.test(command[i - 1] ?? ''))) {
      while (i + 1 < command.length && command[i + 1] !== '\n') i++
      continue
    }
    if ((ch === '$' && command[i + 1] === '(') || ch === '`') {
      const end = closing(command, i)
      if (end < 0) continue
      out.push(command.slice(ch === '`' ? i + 1 : i + 2, end))
      i = end
    }
  }
  return out
}

function expand(args: string[], loops: { name: string; words: string[] }[]): string[][] {
  let out = [args]
  for (const { name, words } of loops) {
    if (!name) continue
    const source = `\\$\\{${name}\\}|\\$${name}(?![A-Za-z0-9_])`
    const used = new RegExp(source)
    const ref = new RegExp(source, 'g')
    if (!out.some(a => a.some(x => used.test(x)))) continue
    out = out.flatMap(a => words.map(w => a.map(x => x.replace(ref, w)))).slice(0, MAX_CALLS)
  }
  return out
}

function skipFlags(toks: string[], j: number, word: string): number {
  const valued = PREFIX_VALUED[word]
  while (j < toks.length && (toks[j] ?? '').startsWith('-') && !SEPARATORS.has(toks[j] ?? '')) j += valued?.has(toks[j] ?? '') ? 2 : 1
  return j
}

export function invocations(command: string, sessionCwd: string, base: Record<string, string> = {}, tools: readonly string[] = ['databricks']): Invocation[] {
  const subs: { at: number; body: string }[] = []
  const toks = tokenize(heredocless(command), subs)
  const found: Invocation[] = []
  const loops: { name: string; words: string[] }[] = []
  const exported: Record<string, string> = { ...base }
  let cwd = sessionCwd
  let start = true
  for (let i = 0; i < toks.length && found.length < MAX_CALLS; i++) {
    const t = toks[i] ?? ''
    if (SEPARATORS.has(t)) {
      start = true
      continue
    }
    if (!start) continue
    start = false
    let end = i
    while (end < toks.length && !SEPARATORS.has(toks[end] ?? '')) end++
    for (let sub = subs[0]; sub && sub.at < end; sub = subs[0]) {
      subs.shift()
      found.push(...invocations(sub.body, cwd, exported, tools).slice(0, MAX_CALLS - found.length))
    }
    const env: Record<string, string> = {}
    let j = i
    for (;;) {
      const tok = toks[j] ?? ''
      const assign = tok.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s)
      const word = tok.split('/').pop() ?? ''
      if (assign) {
        env[assign[1] ?? ''] = assign[2] ?? ''
        j++
      } else if (word === 'uv' && toks[j + 1] === 'run') j = skipFlags(toks, j + 2, 'uv')
      else if (word === 'timeout') {
        j = skipFlags(toks, j + 1, word)
        if (/^\d/.test(toks[j] ?? '')) j++
      } else if (word === 'while' || word === 'until') {
        loops.push({ name: '', words: [] })
        j++
      } else if (word === 'command' && /^-[A-Za-z]*[vV]/.test(toks[j + 1] ?? '')) break
      else if (PREFIXES.has(word)) j = skipFlags(toks, j + 1, word)
      else break
    }
    const head = toks[j]?.split('/').pop()
    const dir = toks[j + 1]
    if (head === 'export') {
      for (let k = j + 1; k < toks.length && !SEPARATORS.has(toks[k] ?? ''); k++) {
        const m = (toks[k] ?? '').match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s)
        if (m) exported[m[1] ?? ''] = m[2] ?? ''
      }
      continue
    }
    if (head === 'for' && toks[j + 2] === 'in' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(dir ?? '')) {
      const words: string[] = []
      for (let k = j + 3; k < toks.length && !SEPARATORS.has(toks[k] ?? '') && toks[k] !== 'do'; k++) words.push(toks[k] ?? '')
      loops.push({ name: dir ?? '', words: words.slice(0, 20) })
      continue
    }
    if (head === 'for' || head === 'select') {
      loops.push({ name: '', words: [] })
      continue
    }
    if (head === 'done') {
      loops.pop()
      continue
    }
    if (head === 'cd' && dir && !SEPARATORS.has(dir)) {
      cwd = join(cwd, dir)
      continue
    }
    if (!head || !tools.includes(head)) continue
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
    for (const each of expand(args, loops)) if (found.length < MAX_CALLS) found.push({ tool: head, bin: toks[j] ?? head, args: each, cwd, env: { ...exported, ...env } })
    i = k - 1
  }
  for (const sub of subs) found.push(...invocations(sub.body, cwd, exported, tools).slice(0, MAX_CALLS - found.length))
  return found
}

export type DbKind = 'read' | 'download' | 'upload' | 'modify'

const IGNORED = new Set(['auth', 'configure', 'completion', 'help', 'version', 'cache', 'labs', 'quickstart', 'psql', 'ssh', 'aitools'])
const VALUE_FLAGS = new Set(['--limit', '--path', '--page-size', '--max-num-clusters', '--min-num-clusters', '--cluster-size', '--warehouse-type', '--spark-version', '--node-type-id', '--num-workers', '--description', '--owner', '--filter', '--source-dir', '--target-dir', '--key', '--scope', '--string-value', '-p', '--profile', '-o', '--output', '--file', '--format', '--language', '--json', '-t', '--target', '--var', '--cluster-id', '--job-id', '--run-id', '--warehouse-id', '--pipeline-id', '--catalog-name', '--schema-name', '--max-results', '--page-token', '--timeout', '--log-level', '--log-file', '--log-format', '--name', '--comment', '--storage-root', '--source-code-path'])
const READ_VERBS = new Set(['get', 'list', 'describe', 'summary', 'status', 'exists', 'read', 'search', 'ls', 'cat', 'me', 'validate', 'show'])
const REMOTE = /^(dbfs:|\/Volumes\/)/i
const UC_NAME = /^[^\s./:]+\.[^\s./:]+\.[^\s./:]+$/
const UC_GROUPS = new Set(['tables', 'functions', 'registered-models', 'model-versions', 'volumes', 'grants', 'online-tables', 'quality-monitors', 'lakehouse-monitors', 'table-constraints', 'artifact-allowlists', 'temporary-table-credentials', 'vector-search-indexes'])

export function positionals(args: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? ''
    if (a.startsWith('-')) {
      if (VALUE_FLAGS.has(a)) i++
      continue
    }
    out.push(a)
  }
  return out
}

function flag(args: string[], ...names: string[]): string {
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? ''
    for (const n of names) {
      if (a === n) return args[i + 1] ?? ''
      if (a.startsWith(`${n}=`)) return a.slice(n.length + 1)
    }
  }
  return ''
}

export function dbProfile(inv: Invocation): string {
  return flag(inv.args, '-p', '--profile')
}

export function dbKind(inv: Invocation): DbKind | null {
  const pos = positionals(inv.args)
  const [group = '', verb = ''] = pos
  if (!group || IGNORED.has(group)) return null
  if (group === 'fs') {
    if (verb === 'ls' || verb === 'cat') return 'read'
    if (verb === 'cp') {
      const rest = pos.slice(2)
      const src = rest[0] ?? ''
      const dst = rest[rest.length - 1] ?? ''
      if (REMOTE.test(src) && !REMOTE.test(dst)) return 'download'
      if (!REMOTE.test(src) && REMOTE.test(dst)) return 'upload'
    }
    return 'modify'
  }
  if (group === 'workspace') {
    if (verb === 'export' || verb === 'export-dir') return 'download'
    if (verb === 'import' || verb === 'import-dir') return 'upload'
  }
  if (group === 'bundle') return verb === 'deploy' ? 'upload' : READ_VERBS.has(verb) || verb === 'generate' ? 'read' : 'modify'
  if (group === 'sync') return 'upload'
  if (group === 'api') return verb.toLowerCase() === 'get' || /\/sql\/statements/.test(pos[2] ?? '') ? 'read' : 'modify'
  if (group === 'current-user') return 'read'
  if (verb === 'export' || verb === 'export-run') return 'download'
  if (READ_VERBS.has(verb) || verb.startsWith('list-') || verb.startsWith('get-')) return 'read'
  return 'modify'
}

function workspacePath(p: string): string {
  return p.replace(/^\/Workspace(?=\/)/, '').replace(/\/+$/, '') || '/'
}

function volumeOf(p: string): string {
  const m = p.replace(/^dbfs:/i, '').match(/^\/Volumes\/([^/]+)\/([^/]+)\/([^/]+)/)
  return m ? `UV:${m[1]}.${m[2]}.${m[3]}` : ''
}

export function dbTargets(inv: Invocation): string[] {
  const pos = positionals(inv.args)
  const [group = '', verb = '', ...rest] = pos
  const a0 = rest[0] ?? ''
  const a1 = rest[1] ?? ''
  const out: string[] = []
  const id = (prefix: string, value: string) => value && out.push(`${prefix}:${value}`)
  switch (group) {
    case 'workspace':
      if (verb === 'import-dir') id('WS', a1 && workspacePath(a1))
      else if (a0.startsWith('/')) id('WS', workspacePath(a0))
      else if (verb === 'list') out.push('S:workspace')
      break
    case 'fs':
      for (const p of rest) if (volumeOf(p)) out.push(volumeOf(p))
      break
    case 'catalogs':
      if (verb === 'list') out.push('S:catalog')
      else id('UC', a0)
      break
    case 'schemas':
      id('UC', verb === 'create' && a1 ? `${a1}.${a0}` : a0)
      break
    case 'tables':
    case 'functions':
    case 'registered-models':
      if (verb === 'list' || verb === 'list-summaries') id('UC', a0 && a1 ? `${a0}.${a1}` : flag(inv.args, '--catalog-name') && flag(inv.args, '--schema-name') ? `${flag(inv.args, '--catalog-name')}.${flag(inv.args, '--schema-name')}` : '')
      else if (group === 'tables' && verb === 'create' && a1 && rest[2]) id('UC', `${a1}.${rest[2]}.${a0}`)
      else id('UC', a0)
      break
    case 'volumes':
      if (verb === 'list') id('UC', a0 && a1 ? `${a0}.${a1}` : '')
      else if (verb === 'create') id('UV', a0 && a1 && rest[2] ? `${a0}.${a1}.${rest[2]}` : '')
      else id('UV', a0)
      break
    case 'clusters':
      if (verb === 'list') out.push('S:compute')
      else id('CL', flag(inv.args, '--cluster-id') || a0)
      break
    case 'warehouses':
      if (verb === 'list') out.push('S:compute')
      else id('SW', flag(inv.args, '--warehouse-id') || a0)
      break
    case 'jobs':
      if (verb === 'list') out.push('S:jobs')
      else id('J', flag(inv.args, '--job-id') || (/run/.test(verb) && verb !== 'run-now' ? '' : /^\d+$/.test(a0) ? a0 : ''))
      break
    case 'api': {
      if (!/\/sql\/statements/.test(a0)) break
      const body = flag(inv.args, '--json')
      const wh = body.match(/"warehouse_id"\s*:\s*"([^"]+)"/)?.[1]
      if (wh) out.push(`SW:${wh}`)
      break
    }
    case 'bundle':
      if (verb === 'deploy' || verb === 'destroy') out.push('S:jobs', 'S:pipelines', 'S:dashboards', 'S:apps', 'S:workspace')
      break
    case 'sync':
      out.push('S:workspace')
      break
    case 'pipelines':
      if (verb === 'list-pipelines') out.push('S:pipelines')
      else id('P', flag(inv.args, '--pipeline-id') || a0)
      break
    case 'apps':
      if (verb === 'list') out.push('S:apps')
      else id('A', a0)
      break
    case 'lakeview':
      if (verb === 'list') out.push('S:dashboards')
      else id('D', a0)
      break
  }
  const SECTION: Record<string, string> = { jobs: 'S:jobs', pipelines: 'S:pipelines', apps: 'S:apps', lakeview: 'S:dashboards', clusters: 'S:compute', warehouses: 'S:compute', catalogs: 'S:catalog' }
  if (out.length === 0 && (verb === 'create' || verb.startsWith('create-') || verb === 'import') && SECTION[group]) out.push(SECTION[group] ?? '')
  if (UC_GROUPS.has(group)) for (const p of rest) if (UC_NAME.test(p) && !out.includes(`UC:${p}`) && !out.includes(`UV:${p}`)) out.push(`UC:${p}`)
  return out
}

export const DB_TONE: Record<DbKind, string> = { read: 'purple', download: 'teal', upload: 'pink', modify: 'orange' }
