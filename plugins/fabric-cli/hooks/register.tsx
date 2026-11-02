import type { EngineInterface, Register, Timer } from 'claude-code'
import { LINUX_LAUNCH as LAUNCH, openCommand } from './open'

import type { Explorer, Target, TreeNode } from '../types'
import { glyph, type Tier } from './icons'
import { FABRIC_SVG } from './svg-data'
import { SETTING_DOCS } from './setting-data'
import type { RowSpec, RowsProps, Seg } from './rows'
import type { ZoneProps } from './zone'
import { ancestors, EMPTY, empty, emptyMark, isLoaded, merge, type Row, visible } from './tree'
import { type ApiFolder, type ApiItem, folderTree, inOneLake, itemUrl, modelOf, parseChildren, parseOneLake, parseWorkspaces, PLACEHOLDER, typeLabel } from './fabric'
import { FAB_TONE, type FabKind, fabCalls, fabGuids, fabKind, fabPositionals, fabWorkspaces, type Invocation, invocations, join, modelFromConnection, posix, queryOf, targetLabel, tokenize, useDrives } from './parse'
import { fabTouched, nodeAtPath } from './touch'
import { CliError, COPY, isAborted, REFRESH, runFailure, setupOf, setupRows, spawnFailure } from './setup'

const STATE = { plugin: 'fabric-cli', key: 'explorer' } as const
const NODES = { plugin: 'fabric-cli', key: 'nodes' } as const
const PANE = 'fabric-pane'
const TITLE = 'Fabric in Claude Code'
const TITLE_GLYPH = { fabric: 0xf2292, nerd: 'F', plain: 'F' }
const TITLE_COLOR = '#2dd4bf'
const HINT = 'waiting for a fab command, or /fabric-pane'
const SORT = false
const WINDOW = 400
const DETAIL_ROWS = 12
const HEADER = '#header'
const WHOLE_VERBS = new Set(['mkdir', 'create', 'rm', 'del', 'mv', 'move', 'rename'])
const BUSY_MAX_MS = 600_000
const FLASH_MS = 2700
const DOUBLE_MS = 450
const SHIMMER = ['#f97316', '#fb923c', '#fdba74', '#ffedd5']
const TONES: Record<string, { bright: string[]; dim: string[] }> = {
  orange: { bright: SHIMMER, dim: ['#8a4316', '#a3562a', '#bd7444', '#d29267'] },
  teal: { bright: ['#14b8a6', '#2dd4bf', '#5eead4', '#ccfbf1'], dim: ['#0f5e57', '#16786f', '#2a9488', '#4fb3a8'] },
  pink: { bright: ['#ec4899', '#f472b6', '#f9a8d4', '#fce7f3'], dim: ['#831843', '#9d174d', '#b8406f', '#cf6f93'] },
  purple: { bright: ['#a855f7', '#c084fc', '#d8b4fe', '#f3e8ff'], dim: ['#581c87', '#6b21a8', '#8b47c4', '#a874d6'] },
}
const FONT_SCRIPT =
  'f=; command -v fc-list >/dev/null 2>&1 && f=$(fc-list ":charset=$1" file 2>/dev/null | grep -vi lastresort | head -n1 | cut -d: -f1); ' +
  '[ -n "$f" ] || for g in "$HOME"/Library/Fonts/*"$2"* /Library/Fonts/*"$2"* "$HOME"/.local/share/fonts/*"$2"*; do [ -f "$g" ] && { [ -z "$3" ] || LC_ALL=C grep -aqE "$3" "$g"; } && { f=$g; break; }; done; ' +
  '[ -n "$f" ] || { echo missing; exit 0; }; m=$(stat -c %Z "$f" 2>/dev/null || stat -f %c "$f"); p=$PPID; ' +
  'while [ -n "$p" ] && [ "$p" -gt 1 ]; do c=$(ps -o comm= -p "$p" 2>/dev/null); c=$(basename "$c" 2>/dev/null | tr -d " "); case "$c" in ' +
  'ghostty|kitty|alacritty|Alacritty|foot|footclient|wezterm-gui|konsole|gnome-terminal-|xterm|urxvt|st|Terminal|iTerm2) ' +
  'e=$(ps -o etime= -p "$p" 2>/dev/null | awk -F\'[-:]\' \'{n=NF; s=$n+60*$(n-1); if (n>2) s+=3600*$(n-2); if (n>3) s+=86400*$(n-3); print s}\'); [ -n "$e" ] && [ $(( $(date +%s) - e )) -lt "$m" ] && echo stale || echo ok; exit 0;; esac; ' +
  'p=$(ps -o ppid= -p "$p" 2>/dev/null | tr -d " "); done; echo ok'
const NERD_PROBE = 'f04eb ebff eac5 f47c f460 ec82'
const NERD_VERSION = 'Nerd Fonts (3\\.([5-9]|[1-9][0-9])|[4-9]|[1-9][0-9]+)\\.'

let lastPress = { key: '', at: 0 }
const views = new Map<string, { from: number; max: number }>()
let detected: Tier = 'nerd'
let glyphSetting = 'auto'
let fontHint = true
let hinted = false
let fellBack = false
let follow = true
let blink: Timer | null = null
let generation = 0
let running = 0
let closed = false
let noDock = false
let inflight: Promise<void> | null = null
let queued: Promise<void> | null = null
let platform: Promise<'linux' | 'darwin' | 'win32'> | null = null

function osName($: EngineInterface): Promise<'linux' | 'darwin' | 'win32'> {
  platform ??= (async () => {
    if ((await $.env.get('OS')) === 'Windows_NT') return 'win32'
    try {
      return (await $.process.run(['uname', '-s'], { timeoutMs: 3_000 })).stdout.trim() === 'Darwin' ? 'darwin' : 'linux'
    } catch {
      return 'linux'
    }
  })()
  return platform
}

async function openPane($: EngineInterface, args: { id: string; title: string; focus?: true }): Promise<void> {
  if (noDock && !args.focus) return
  await $.ui.open(args)
}

async function cwdOf($: EngineInterface): Promise<string> {
  return posix(await $.session.cwd())
}

function jumpTo(ex: Explorer, query: string): Partial<Explorer> {
  const q = query.trim().toLowerCase()
  const hits = q ? ex.nodes.filter(n => n.name.toLowerCase().includes(q) || n.note.toLowerCase().includes(q)).slice(0, 10) : []
  const open = new Set(ex.expanded)
  for (const n of hits) for (const a of ancestors(ex.nodes, n.id)) open.add(a)
  return { query: '', expanded: [...open], cursor: hits[0]?.id ?? ex.cursor, scroll: null }
}

async function copyOf($: EngineInterface, text: string, surface?: string): Promise<void> {
  const done = await $.ui.copy({ text, ...(surface ? { surface: surface as 'terminal' } : {}) })
  $.ui.toast(done.isCopied ? `Copied ${text}` : 'Could not copy')
}

function clean(segs: Seg[]): Seg[] {
  for (const seg of segs) for (const k of Object.keys(seg) as (keyof Seg)[]) if (seg[k] === undefined) delete seg[k]
  return segs
}

async function installed($: EngineInterface, cmd: string): Promise<boolean> {
  try {
    return (await $.process.run(['sh', '-c', 'command -v "$1" >/dev/null 2>&1', 'sh', cmd], { timeoutMs: 5_000 })).exitCode === 0
  } catch {
    return false
  }
}

async function launch($: EngineInterface, ...choices: string[][]): Promise<void> {
  for (const argv of choices) {
    if (!(await installed($, argv[0] ?? ''))) continue
    try {
      if ((await $.process.run(['sh', '-c', LAUNCH, 'sh', ...argv], { timeoutMs: 15_000 })).exitCode === 0) return
    } catch {
      continue
    }
  }
  $.ui.toast(`could not start ${choices.map(c => c[0] ?? '').join(' or ')}`)
}

async function started($: EngineInterface, argv: string[]): Promise<void> {
  try {
    const run = await $.process.run(argv, { timeoutMs: 10_000 })
    if (run.exitCode !== 0) $.ui.toast(`could not start ${argv[0] ?? ''}: ${(run.stderr || run.stdout).trim().split('\n')[0] ?? ''}`)
  } catch {
    $.ui.toast(`could not start ${argv[0] ?? ''}`)
  }
}

const slots = { busy: 0, urgent: 0, queue: [] as (() => void)[] }

async function limited<T>(fn: () => Promise<T>, urgent = false): Promise<T> {
  if (urgent) {
    slots.urgent++
    try {
      return await fn()
    } finally {
      slots.urgent--
    }
  }
  if (slots.busy < 4) slots.busy++
  else await new Promise<void>(resolve => slots.queue.push(resolve))
  try {
    return await fn()
  } finally {
    const next = slots.queue.shift()
    if (next) next()
    else slots.busy--
  }
}

async function openUrl($: EngineInterface, url: string): Promise<void> {
  const { argv, init } = openCommand(await osName($), url)
  try {
    const run = await $.process.run(argv, init)
    if (run.exitCode !== 0) $.ui.toast(`could not open ${url} with ${argv[0]}: ${run.stderr.trim().split('\n')[0] || `exit ${run.exitCode}`}`)
  } catch {
    $.ui.toast(`could not open ${url} with ${argv[0]}`)
  }
}

function psq(arg: string): string {
  return `'${arg.replace(/'/g, "''")}'`
}

function shq(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`
}

async function terminal($: EngineInterface, linux: string[], cmd: string[], cwd = ''): Promise<void> {
  const line = cmd.map(shq).join(' ')
  const os = await osName($)
  if (os === 'linux') {
    if (!(await installed($, linux[0] ?? ''))) return $.ui.toast(`${linux[0] ?? ''} is not installed`)
    return launch($, ['xdg-terminal-exec', ...linux], ['x-terminal-emulator', '-e', ...linux])
  }
  if (os === 'darwin') {
    return started($, ['osascript', '-e', `tell application "Terminal" to do script "${(cwd ? `cd ${shq(cwd)} && ${line}` : line).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`, '-e', 'tell application "Terminal" to activate'])
  }
  const inner = `${cwd ? `Set-Location -LiteralPath ${psq(cwd.replace(/\//g, '\\'))}; ` : ''}& ${cmd.map(psq).join(' ')}`
  return started($, ['powershell', '-NoProfile', '-Command', `$ErrorActionPreference = 'Stop'; Start-Process powershell -ArgumentList @('-NoExit', '-Command', ${psq(inner)})`])
}

async function fontState($: EngineInterface, charset: string, name: string, version = ''): Promise<'ok' | 'stale' | 'missing'> {
  try {
    const out = (await $.process.run(['sh', '-c', FONT_SCRIPT, 'sh', charset, name, version], { timeoutMs: 5_000 })).stdout.trim()
    return out === 'stale' || out === 'missing' ? out : 'ok'
  } catch {
    return 'missing'
  }
}

async function detectGlyphs($: EngineInterface): Promise<void> {
  if ((await $.env.get('SSH_CONNECTION')) || (await $.env.get('SSH_TTY'))) {
    detected = 'nerd'
    return
  }
  const nerd = (await fontState($, NERD_PROBE, 'Nerd', NERD_VERSION)) === 'ok'
  detected = nerd && (await fontState($, 'f2621', 'FabricSymbols')) === 'ok' ? 'fabric' : nerd ? 'nerd' : 'plain'
}

function fontNote(): string {
  if (!fontHint || hinted || !fellBack) return ''
  hinted = true
  return 'Tell user once: Fabric pane icons need github.com/data-goblin/fabric-nf plus a Nerd Font. Plugin option fontHint=off disables this.'
}

function tierFor(surface: string): Tier {
  if (glyphSetting === 'fabric' || glyphSetting === 'nerd' || glyphSetting === 'plain') return glyphSetting
  return surface === 'desktop' ? 'plain' : detected
}

function titleGlyph(tier: Tier): string {
  return tier === 'fabric' ? String.fromCodePoint(TITLE_GLYPH.fabric) : tier === 'nerd' ? TITLE_GLYPH.nerd : TITLE_GLYPH.plain
}

function titleFor(target: Target | null): string {
  return target ? tenantName || targetLabel(target) : TITLE
}

let cached: Explorer | null = null
let savedNodes: TreeNode[] | null = null
let saveTimer: Timer | null = null

async function load($: EngineInterface): Promise<Explorer> {
  const [view, tree] = await Promise.all([$.state.get(STATE), $.state.get(NODES)])
  const nodes = tree.value ?? []
  savedNodes = nodes
  return { ...empty(), ...view.value, nodes }
}

async function get($: EngineInterface): Promise<Explorer> {
  if (cached) return cached
  const ex = await load($)
  cached ??= ex
  return cached
}

function flush($: EngineInterface): Promise<unknown> {
  saveTimer?.cancel()
  saveTimer = null
  if (!cached) return Promise.resolve()
  const { nodes, ...rest } = cached
  const writes: Promise<unknown>[] = [$.state.set(STATE, { ...rest, nodes: [] })]
  if (nodes !== savedNodes) {
    savedNodes = nodes
    writes.push($.state.set(NODES, nodes))
  }
  return Promise.all(writes)
}

function save($: EngineInterface): void {
  saveTimer?.cancel()
  saveTimer = $.clock.after(1_000, () => quiet(flush($)))
}

async function commit($: EngineInterface, fn: (ex: Explorer) => Explorer): Promise<void> {
  if (!cached) await get($)
  const now = cached ?? empty()
  const next = fn(now)
  if ((Object.keys(next) as (keyof Explorer)[]).every(k => next[k] === now[k])) return
  cached = next
  $.ui.invalidate('ui.render')
  save($)
}

function put($: EngineInterface, fn: (ex: Explorer) => Explorer): Promise<void> {
  return commit($, cur => anchored(cur, fn(cur)))
}

function patch($: EngineInterface, fn: (ex: Explorer) => Partial<Explorer>) {
  return put($, ex => ({ ...ex, ...fn(ex) }))
}

function patchView($: EngineInterface, fn: (ex: Explorer) => Partial<Explorer>): Promise<void> {
  return commit($, cur => {
    const change = fn(cur)
    return Object.keys(change).length === 0 ? cur : { ...cur, ...change }
  })
}

const sameTarget = (a: Target | null, b: Target | null) => JSON.stringify(a) === JSON.stringify(b)

function refresh($: EngineInterface): Promise<void> {
  if (inflight) {
    const rerun = () => {
      queued = null
      return refresh($)
    }
    queued ??= inflight.then(rerun, rerun)
    return queued
  }
  inflight = doRefresh($).finally(() => {
    inflight = null
  })
  return inflight
}

async function flash($: EngineInterface, ids: string[], alsoLit: string[] = []): Promise<void> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return
  const ex = await get($)
  await patch($, cur => {
    const byId = new Map(cur.nodes.map(n => [n.id, n]))
    const open = new Set(cur.expanded)
    const bright = new Set([...cur.flash.filter(id => !unique.includes(id)), ...unique])
    const dim = new Set([...cur.flashDim, ...alsoLit])
    for (const id of unique) {
      const chain = ancestors(cur.nodes, id, byId)
      if (!chain.some(a => !open.has(a))) continue
      for (const a of chain) {
        if (!open.has(a)) dim.add(a)
        open.add(a)
      }
    }
    for (const id of bright) dim.delete(id)
    const root = rootOf(cur)
    const away = follow && root !== '' && unique.some(id => id !== root && !ancestors(cur.nodes, id, byId).includes(root))
    return { flash: [...bright], flashDim: [...dim], expanded: [...open], ...(follow ? { scroll: null } : {}), ...(away ? { root: '' } : {}) }
  })
  if (ex.target && !closed) await openPane($, { id: PANE, title: titleFor(ex.target) })
}

type Mark = { ids: string[]; tone: string }

const STRENGTH: FabKind[] = ['read', 'download', 'upload', 'modify']

function toneOf(kinds: FabKind[]): string {
  return FAB_TONE[STRENGTH.reduce<FabKind>((best, k) => (kinds.includes(k) ? k : best), 'read')]
}

function rootOf(ex: Explorer): string {
  return ex.root && ex.nodes.some(n => n.id === ex.root) ? ex.root : ''
}

function anchored(cur: Explorer, next: Explorer): Explorer {
  if (follow || cur.scroll === null || next.scroll !== cur.scroll || (next.nodes === cur.nodes && next.expanded === cur.expanded)) return next
  const top = visible(cur, SORT, rootOf(cur))[cur.scroll]?.node.id
  const at = top ? visible(next, SORT, rootOf(next)).findIndex(row => row.node.id === top) : -1
  return at < 0 || at === cur.scroll ? next : { ...next, scroll: at }
}


async function begin($: EngineInterface, mark: Mark): Promise<void> {
  running++
  generation++
  blink?.cancel()
  blink = null
  const at = await $.clock.now()
  await patchView($, cur => {
    const map = { ...cur.busy }
    for (const id of mark.ids) map[id] = { tone: mark.tone, n: (map[id]?.n ?? 0) + 1, at }
    return { busy: map, work: { tone: mark.tone, at }, flash: [], flashDim: [] }
  })
}

async function finish($: EngineInterface, mark: Mark): Promise<void> {
  running = Math.max(0, running - 1)
  const mine = generation
  const idle = running === 0
  let lit = false
  await patchView($, cur => {
    const map = { ...cur.busy }
    for (const id of mark.ids) {
      const left = (map[id]?.n ?? 1) - 1
      const entry = map[id]
      if (left > 0 && entry) map[id] = { ...entry, n: left }
      else delete map[id]
    }
    lit = cur.flash.length > 0 || cur.flashDim.length > 0
    return { busy: map, ...(idle && generation === mine && !lit ? { work: null } : {}) }
  })
  if (!idle || !lit || generation !== mine) return
  blink?.cancel()
  blink = $.clock.after(FLASH_MS, () => {
    if (generation !== mine || running > 0) return
    blink = null
    quiet(patchView($, () => (generation === mine && running === 0 ? { work: null, flash: [], flashDim: [] } : {})))
  })
}

async function point($: EngineInterface, target: Target | null, opened: 'asked' | 'unasked', fresh = false): Promise<boolean> {
  const moved = !sameTarget((await get($)).target, target)
  if (moved) {
    treeGen++
    await put($, () => ({ ...empty(), target }))
  }
  else if (fresh) await patchView($, () => ({ expanded: [], query: '', selected: '', detail: [], cursor: '' }))
  if (opened === 'asked' || (moved && target)) {
    const title = titleFor(target)
    if (opened === 'asked') {
      closed = false
      await openPane($, { id: PANE, title, focus: true })
    } else if (!closed) await openPane($, { id: PANE, title })
  }
  return moved
}

async function goUp($: EngineInterface): Promise<void> {
  await patch($, cur => {
    const n = cur.nodes.find(x => x.id === cur.root)
    return { root: n?.parent ?? '', cursor: n?.id ?? cur.cursor, scroll: null }
  })
}

async function goHome($: EngineInterface): Promise<void> {
  await patchView($, () => ({ root: '', scroll: null }))
}

async function press($: EngineInterface, n: TreeNode): Promise<void> {
  await select($, n)
}

async function openWeb($: EngineInterface, ex: Explorer, n: TreeNode): Promise<void> {
  const url = webUrl(ex, n)
  if (url) await openUrl($, url)
  else $.ui.toast('no Fabric link for this object')
}

let fabContext: { bin: string; env: Record<string, string> } = { bin: 'fab', env: {} }
let treeGen = 0

function contextOf(inv: { bin: string; env: Record<string, string>; cwd: string }): typeof fabContext {
  const env = Object.fromEntries(Object.entries(inv.env).filter(([k]) => /^(FAB_|AZURE_|IDENTITY_|REQUESTS_CA_BUNDLE$|HTTPS?_PROXY$|NO_PROXY$)/i.test(k)))
  return { bin: binOf(inv.bin, inv.cwd), env }
}

function binOf(bin: string, cwd: string): string {
  if (!bin.includes('/') || /[~$`]/.test(bin)) return 'fab'
  if (bin.startsWith('/') || /^[A-Za-z]:\//.test(bin)) return bin
  return cwd.startsWith('/') && !/[~$`]/.test(cwd) ? join(cwd, bin) : 'fab'
}

function targetOf(env: Record<string, string>): Target {
  const identity = [env.FAB_TENANT_ID, env.FAB_SPN_CLIENT_ID].filter(Boolean).join('|')
  return identity ? { kind: 'fabric', identity } : { kind: 'fabric' }
}

function listing(stdout: string, n: TreeNode, nodes: TreeNode[]): { kids: TreeNode[]; become: string } {
  return inOneLake(n) ? parseOneLake(stdout, n) : { kids: parseChildren(stdout, n, nodes), become: '' }
}

async function fabLs($: EngineInterface, path?: string, urgent = false): Promise<string> {
  const ctx = fabContext
  const where = path ? `/${path.replace(/^\/+/, '')}` : '/'
  const run = await limited(
    () =>
      $.process.run([ctx.bin, 'ls', where, '-l', '--output_format', 'json'], {
        timeoutMs: 60_000,
        ...(Object.keys(ctx.env).length ? { env: ctx.env } : {}),
      }),
    urgent,
  ).catch((err: unknown) => {
    throw spawnFailure(err, ctx.bin)
  })
  if (run.exitCode !== 0) throw runFailure(run, 'fab ls failed')
  if (run.isStdoutTruncated) throw new Error(`fab ls ${where}: too much output to show`)
  return run.stdout
}

async function pages<T>($: EngineInterface, path: string, urgent: boolean): Promise<T[]> {
  const out: T[] = []
  let token = ''
  for (let page = 0; page < 50; page++) {
    const sep = path.includes('?') ? '&' : '?'
    const body = jsonOf<{ value?: T[]; continuationToken?: string; errorCode?: string; message?: string }>(
      await fabRaw($, ['api', token ? `${path}${sep}continuationToken=${encodeURIComponent(token)}` : path, '-q', 'text'], urgent),
    )
    if (!body || !Array.isArray(body.value)) throw new Error(body?.message ?? `fab api ${path} returned an unexpected shape`)
    out.push(...body.value)
    token = body.continuationToken ?? ''
    if (!token) break
  }
  return out
}

function folderOf(n: TreeNode): { ws: string; folder: string } | null {
  if (n.kind === 'workspace' && /^[0-9a-f-]{36}$/i.test(n.sig)) return { ws: n.sig, folder: '' }
  const m = n.kind === 'fabric folder' ? n.sig.match(/^([0-9a-f-]{36})\/([0-9a-f-]{36})$/i) : null
  return m ? { ws: m[1]!, folder: m[2]! } : null
}

async function childrenOf($: EngineInterface, n: TreeNode, nodes: TreeNode[], urgent = false): Promise<{ kids: TreeNode[]; become: string }> {
  const at = folderOf(n)
  if (at) {
    const listed = await Promise.all([pages<ApiItem>($, `workspaces/${at.ws}/items`, urgent), pages<ApiFolder>($, `workspaces/${at.ws}/folders`, urgent)]).catch(() => null)
    if (listed) return { kids: folderTree(listed[0], listed[1], n, nodes, at.folder, emptyMark), become: '' }
  }
  return listing(await fabLs($, n.path, urgent), n, nodes)
}

const loading = new Map<string, Promise<boolean>>()
let statusOwner = ''

function errorText(err: unknown): string {
  return `error: ${err instanceof Error ? err.message : String(err)}`
}

function wsNode(nodes: TreeNode[], workspace: string): TreeNode | undefined {
  const want = `W:${workspace}`.toLowerCase()
  return nodes.find(n => n.id.toLowerCase() === want)
}

function wsId(nodes: TreeNode[], workspace: string): string {
  return wsNode(nodes, workspace)?.id ?? `W:${workspace}`
}

async function pool<T>(items: T[], fn: (item: T) => Promise<unknown>, size = 4): Promise<void> {
  const queue = [...items]
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await fn(item)
    }),
  )
}

async function expandOpen($: EngineInterface, root = ''): Promise<void> {
  const failed = new Set<string>()
  for (let pass = 0; pass < 8; pass++) {
    const ex = await get($)
    const open = new Set(ex.expanded)
    const pending = new Set(ex.nodes.filter(c => c.kind === PLACEHOLDER).map(c => c.parent))
    const byId = new Map(ex.nodes.map(n => [n.id, n]))
    const todo = ex.nodes.filter(n => {
      if (!open.has(n.id) || !pending.has(n.id) || failed.has(n.id)) return false
      const chain = ancestors(ex.nodes, n.id, byId)
      return chain.every(a => open.has(a)) && (!root || chain.includes(root))
    })
    if (todo.length === 0) return
    await pool(todo, async n => {
      if (!(await expandFabric($, n))) failed.add(n.id)
    })
  }
}

async function fabRaw($: EngineInterface, args: string[], urgent = false): Promise<string> {
  const ctx = fabContext
  const run = await limited(
    () => $.process.run([ctx.bin, ...args], { timeoutMs: 60_000, ...(Object.keys(ctx.env).length ? { env: ctx.env } : {}) }),
    urgent,
  )
  if (run.exitCode !== 0 || run.isStdoutTruncated) throw new CliError((run.stderr || run.stdout).trim().split('\n')[0] || `fab ${args[0]} failed`, '')
  return run.stdout
}

function quiet(p: Promise<unknown>): void {
  void p.catch(() => undefined)
}

function orAborted<T>(fallback: T): (err: unknown) => T {
  return err => {
    if (isAborted(err)) throw err
    return fallback
  }
}

function swap<V>(into: Map<string, V>, from: Map<string, V>): void {
  into.clear()
  for (const [k, v] of from) into.set(k, v)
}

const domainOf = new Map<string, string>()
const domainName = new Map<string, string>()
const capacityOf = new Map<string, string>()
const capacityName = new Map<string, string>()
let tenantName = ''
let tenantId = ''
const capacityState = new Map<string, string>()
const capacityInfo = new Map<string, { name: string; region: string; subscription: string; group: string }>()

function capacityDetail(id: string): string[] {
  const info = capacityInfo.get(id.toLowerCase())
  const sku = capacitySku.get(id.toLowerCase()) ?? ''
  const state = capacityState.get(id.toLowerCase()) ?? ''
  return [
    ...(info ? [`Name: ${info.name}`] : []),
    `ID: ${id}`,
    ...(sku ? [`SKU: ${skuLabel(sku)}${skuLabel(sku) === sku ? '' : ` (${sku})`}`] : []),
    ...(state ? [`State: ${state === 'Active' ? 'Running' : state === 'Inactive' ? 'Paused' : state}`] : []),
    ...(info?.region ? [`Region: ${info.region}`] : []),
    ...(info?.group ? [`Resource group: ${info.group}`] : []),
  ]
}

function azureLinks(id: string): { cost: string; resource: string } | null {
  const info = capacityInfo.get(id.toLowerCase())
  if (!info?.subscription || !info.group) return null
  const at = tenantId ? `@${tenantId}/` : ''
  const group = `/subscriptions/${info.subscription}/resourceGroups/${info.group}`
  return {
    cost: `https://portal.azure.com/${at}#blade/Microsoft_Azure_CostManagement/Menu/open/costanalysis/scope/${encodeURIComponent(group)}`,
    resource: `https://portal.azure.com/#${at}resource${group}/providers/Microsoft.Fabric/capacities/${encodeURIComponent(info.name)}/overview`,
  }
}
const capacitySku = new Map<string, string>()
const SETTINGS_INDEX = 'https://learn.microsoft.com/fabric/admin/tenant-settings-index'

function skuLabel(sku: string): string {
  const up = sku.trim().toUpperCase()
  if (!up) return ''
  if (up === 'PP3') return 'PPU'
  const trial = up.match(/^FTL?(\d+)$/)
  return trial ? `F${trial[1]}` : up
}

function shownName(n: TreeNode): string {
  return n.kind === 'capacity' ? shortCapacity(n.name, capacitySku.get(n.sig.toLowerCase()) ?? '') : n.name
}

function shortCapacity(name: string, sku: string): string {
  const up = sku.trim().toUpperCase()
  if (/^FT/.test(up) || /^Trial-\d{8}T\d{6}Z-/.test(name)) return 'Fabric Trial'
  if (up === 'PP3' || /^Premium Per User\b/i.test(name)) return 'PPU'
  return name
}
type Setting = { settingName: string; title?: string; enabled?: boolean; tenantSettingGroup?: string; canSpecifySecurityGroups?: boolean; delegateToWorkspace?: boolean; delegateToCapacity?: boolean; delegateToDomain?: boolean; enabledSecurityGroups?: { name?: string }[]; excludedSecurityGroups?: { name?: string }[] }
const settingOf = new Map<string, Setting>()
const TENANT = '#tenant'
const TOGGLE = 'toggle:'
const PROPS = 'props:toggle'
let propsOpen = false
const TOGGLE_COLOR: Record<string, string> = { domains: '#c4b5fd', capacities: '#5eead4', find: '#fbbf24' }
const FIND = 'F:'
const CAP = 'cap:'
const capBusy = new Set<string>()

function switchable(n: TreeNode): boolean {
  const run = runState(n)
  return (run === 'paused' || run === 'running') && pausable(n.sig)
}

function pausable(capacity: string): boolean {
  return /^F\d+$/.test((capacitySku.get(capacity.toLowerCase()) ?? '').trim().toUpperCase())
}

async function toggleRun($: EngineInterface, capacity: string): Promise<void> {
  const key = capacity.toLowerCase()
  if (capBusy.has(key)) return
  if (!pausable(key)) return void $.ui.toast('Only F capacities can be paused or resumed here')
  const name = capacityInfo.get(key)?.name ?? capacityName.get(key) ?? ''
  if (!name) return void $.ui.toast('capacity name unknown; refresh the pane')
  const resume = paused(key)
  capBusy.add(key)
  $.ui.invalidate('ui.render')
  try {
    await withPending($, `${resume ? 'Resuming' : 'Pausing'} ${name}…`, () => fabRaw($, [resume ? 'start' : 'stop', `.capacities/${name}.Capacity`, '-f'], true))
    capacityState.set(key, resume ? 'Active' : 'Paused')
    $.ui.toast(`${name} ${resume ? 'resumed' : 'paused'}`)
  } catch (err) {
    $.ui.toast(`could not ${resume ? 'resume' : 'pause'} ${name}: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    capBusy.delete(key)
    await loadGroups($, true).catch(() => undefined)
    const ex = await get($)
    if (ex.cursor && ex.nodes.find(n => n.id === ex.cursor)?.sig.toLowerCase() === key) {
      const n = ex.nodes.find(x => x.id === ex.cursor)
      if (n) await patchView($, cur => (cur.cursor === n.id ? { detail: [`capacity ${shownName(n)}`, ...capacityDetail(n.sig)] } : {}))
    }
    $.ui.invalidate('ui.render')
  }
}
type Hit = { name: string; id: string; type: string; workspace: string; workspace_id: string }
let findMode = false
let findQuery = ''
let findHits: Hit[] | null = null
let finding = false

let nativeScroll = false
const optimistic = new Map<string, boolean>()
let pressedCursor = ''
const TENANT_CLOSED = '#tenant-closed'
const SETTINGS = 'TS:'
let tenantAsked = false
let tenantLoading = false

function jsonOf<T>(text: string): T | null {
  try {
    return JSON.parse(text.slice(Math.max(0, text.indexOf('{')))) as T
  } catch {
    return null
  }
}

let groupsLoaded: Promise<void> | null = null
let pending = ''

function warmGroups($: EngineInterface): Promise<void> {
  if (!groupsLoaded) {
    const job: Promise<void> = loadDomains($).then(
      async problem => {
        if (!problem) return
        if (groupsLoaded === job) groupsLoaded = null
        await patchView($, () => ({ status: errorText(problem) }))
      },
      () => {
        if (groupsLoaded === job) groupsLoaded = null
      },
    )
    groupsLoaded = job
  }
  return groupsLoaded
}

async function loadGroups($: EngineInterface, withCapacity: boolean): Promise<void> {
  const problem = await loadDomains($, withCapacity)
  if (problem) await patchView($, () => ({ status: errorText(problem) }))
}

async function withPending<T>($: EngineInterface, text: string, fn: () => Promise<T>): Promise<T> {
  pending = text
  $.ui.invalidate('ui.render')
  try {
    return await fn()
  } finally {
    pending = ''
    $.ui.invalidate('ui.render')
  }
}

type Listed = { result?: { data?: { id?: string; name?: string; state?: string; sku?: string; region?: string; subscriptionId?: string; resourceGroup?: string }[] } }

async function loadDomains($: EngineInterface, withCapacity = false): Promise<string> {
  const problems: string[] = []
  const failed = (what: string, err: unknown) => {
    if (isAborted(err)) throw err
    problems.push(`${what}: ${err instanceof Error ? err.message : String(err)}`)
  }
  const list = (path: string): Promise<Listed | null> =>
    fabRaw($, ['ls', path, '-l', '--output_format', 'json']).then(
      text => {
        const body = jsonOf<Listed>(text)
        if (!body) problems.push(`fab ls ${path} returned no JSON`)
        return body
      },
      (err: unknown) => {
        failed(`fab ls ${path}`, err)
        return null
      },
    )
  const [names, caps] = await Promise.all([list('/.domains'), list('/.capacities')])
  if (names) {
    const next = new Map<string, string>()
    for (const d of names.result?.data ?? []) if (d.id && d.name) next.set(d.id.toLowerCase(), d.name.replace(/\.Domain$/i, ''))
    swap(domainName, next)
  }
  if (caps) {
    const next = new Map<string, string>()
    for (const c of caps.result?.data ?? []) {
      if (!c.id || !c.name) continue
      const known = (v?: string) => (v && v !== 'Unknown' ? v : '')
      capacityInfo.set(c.id.toLowerCase(), { name: c.name.replace(/\.Capacity$/i, ''), region: c.region ?? '', subscription: known(c.subscriptionId), group: known(c.resourceGroup) })
      next.set(c.id.toLowerCase(), shortCapacity(c.name.replace(/\.Capacity$/i, ''), c.sku ?? ''))
      if (c.state) capacityState.set(c.id.toLowerCase(), c.state)
      if (c.sku) capacitySku.set(c.id.toLowerCase(), c.sku)
    }
    swap(capacityName, next)
  }
  const ran = domainName.size > 0 || withCapacity
  if (!ran) {
    if (names) domainOf.clear()
    return problems.join('; ')
  }
  const found = new Map<string, string>()
  const onCapacity = new Map<string, string>()
  let token = ''
  let complete = true
  for (let page = 0; page < 50; page++) {
    let text = ''
    try {
      text = await fabRaw($, ['api', token ? `workspaces?continuationToken=${encodeURIComponent(token)}` : 'workspaces'])
    } catch (err) {
      failed('fab api workspaces', err)
      complete = false
      break
    }
    const body = jsonOf<{ status_code?: number; text?: { value?: { id?: string; domainId?: string; capacityId?: string }[]; continuationToken?: string } }>(text)
    if (!body || (body.status_code && body.status_code >= 400)) {
      problems.push(`fab api workspaces returned ${body?.status_code ?? 'no JSON'}`)
      complete = false
      break
    }
    for (const w of body.text?.value ?? []) {
      if (!w.id) continue
      if (w.domainId && domainName.has(w.domainId.toLowerCase())) found.set(w.id.toLowerCase(), w.domainId.toLowerCase())
      if (w.capacityId) onCapacity.set(w.id.toLowerCase(), w.capacityId.toLowerCase())
    }
    token = body.text?.continuationToken ?? ''
    if (!token) break
  }
  if (complete) {
    swap(domainOf, found)
    swap(capacityOf, onCapacity)
  }
  return problems.join('; ')
}

async function loadTenant($: EngineInterface): Promise<void> {
  if (tenantName) return
  const saved = (await $.store.get('tenant').catch(() => undefined)) as { id?: string; name?: string } | undefined
  if (saved?.id && saved.name) {
    tenantId = saved.id
    tenantName = saved.name
    return
  }
  const status = await fabRaw($, ['auth', 'status'], true).catch(orAborted(''))
  const id = status.match(/Tenant ID:\s*([0-9a-f-]{36})/i)?.[1]?.toLowerCase()
  if (!id) return
  tenantId = id
  const body = jsonOf<{ text?: { value?: { tenantId?: string; displayName?: string }[] } }>(
    await fabRaw($, ['api', '-A', 'azure', 'tenants?api-version=2022-12-01'], true).catch(orAborted('')),
  )
  tenantName = body?.text?.value?.find(x => x.tenantId?.toLowerCase() === id)?.displayName ?? ''
  if (tenantName) await $.store.set('tenant', { id, name: tenantName }).catch(() => undefined)
}

const GROUP_KINDS = new Set(['domain', 'capacity'])

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function grouped(nodes: TreeNode[], on: boolean, byCapacity = false): TreeNode[] {
  const flat = nodes.filter(n => !GROUP_KINDS.has(n.kind)).map(n => (n.kind === 'workspace' && n.parent !== '' ? { ...n, parent: '' } : n))
  const spaces = flat.filter(n => n.kind === 'workspace')
  const domainKey = (n: TreeNode) => (on && domainOf.size > 0 ? (domainOf.get(n.sig.toLowerCase()) ?? 'none') : '')
  const capacityKey = (n: TreeNode) => (byCapacity ? (capacityOf.get(n.sig.toLowerCase()) ?? 'none') : '')
  const useDomains = spaces.some(n => domainKey(n) && domainKey(n) !== 'none')
  if (!useDomains && !byCapacity) return withSettings(flat)
  const domainLabel = (k: string) => (k === 'none' ? 'No domain' : (domainName.get(k) ?? `Domain ${k.slice(0, 8)}`))
  const capacityLabel = (k: string) => (k === 'none' ? 'No capacity (Pro workspaces)' : shortCapacity(capacityName.get(k) ?? `Capacity ${k.slice(0, 8)}`, capacitySku.get(k) ?? ''))
  const last = (a: string, b: string, none: boolean[]) => (none[0] ? 1 : none[1] ? -1 : a.localeCompare(b))
  const groups = new Map<string, TreeNode>()
  const counts = new Map<string, number>()
  const parentOf = (n: TreeNode): string => {
    let parent = ''
    if (useDomains) {
      const d = domainKey(n)
      parent = `D:${d}`
      if (!groups.has(parent)) groups.set(parent, { id: parent, parent: '', kind: 'domain', name: domainLabel(d), path: '', hidden: false, sig: d, note: '' })
    }
    if (byCapacity) {
      const c = capacityKey(n)
      const id = `${parent ? parent + '|' : ''}C:${c}`
      if (!groups.has(id)) groups.set(id, { id, parent, kind: 'capacity', name: capacityLabel(c), path: '', hidden: false, sig: c, note: '' })
      parent = id
    }
    for (let g: string | undefined = parent; g; g = groups.get(g)?.parent) counts.set(g, (counts.get(g) ?? 0) + 1)
    return parent
  }
  const placed = flat.map(n => (n.kind === 'workspace' ? { ...n, parent: parentOf(n) } : n))
  const sorted = [...groups.values()]
    .map(g => ({
      ...g,
      note: [g.kind === 'capacity' ? skuLabel(capacitySku.get(g.sig) ?? '') : '', plural(counts.get(g.id) ?? 0, 'workspace')].filter(Boolean).join(' - '),
    }))
    .sort((a, b) => last(a.name, b.name, [a.sig === 'none', b.sig === 'none']))
  return withSettings([...sorted, ...placed])
}

function padCount(note: string): string {
  return note.replace(/(^|- )(\d{1,3}) (workspaces?)$/, (_m, lead: string, count: string, word: string) => `${lead}${count.padStart(3)} ${word}`)
}

function splitNote(n: TreeNode, note: string): [string, string] {
  if (!runState(n)) return ['', note]
  const cut = note.indexOf(' - ')
  return cut < 0 ? ['', note] : [note.slice(0, cut), note.slice(cut)]
}

function runState(n: TreeNode): 'paused' | 'running' | 'fixed' | '' {
  if (n.kind !== 'capacity' || !capacityState.has(n.sig.toLowerCase())) return ''
  const sku = (capacitySku.get(n.sig.toLowerCase()) ?? '').toUpperCase()
  if (sku === 'PP3') return ''
  if (sku.startsWith('FT')) return 'fixed'
  return paused(n.sig) ? 'paused' : 'running'
}

function paused(capacity: string): boolean {
  const state = capacityState.get(capacity.toLowerCase())
  return Boolean(state) && state !== 'Active'
}

function withSettings(nodes: TreeNode[]): TreeNode[] {
  const rest = nodes.filter(n => n.id !== SETTINGS)
  const root: TreeNode = nodes.find(n => n.id === SETTINGS) ?? { id: SETTINGS, parent: '', kind: 'tenant settings', name: 'Tenant settings', path: '', hidden: false, sig: '', note: '' }
  const stub: TreeNode[] = rest.some(n => n.parent === SETTINGS) ? [] : [{ id: `${SETTINGS}/…`, parent: SETTINGS, kind: PLACEHOLDER, name: 'loading…', path: '', hidden: false, sig: '', note: '' }]
  return [root, ...stub, ...rest]
}

async function loadSettings($: EngineInterface): Promise<TreeNode[]> {
  const body = jsonOf<{ text?: { tenantSettings?: Setting[] }; status_code?: number }>(await fabRaw($, ['api', 'admin/tenantsettings'], true))
  const list = body?.text?.tenantSettings
  if (!list) throw new Error(body?.status_code === 403 || body?.status_code === 401 ? 'tenant settings need a Fabric admin' : 'no tenant settings returned')
  settingOf.clear()
  const groups = new Map<string, Setting[]>()
  for (const s of list) {
    settingOf.set(s.settingName, s)
    const g = s.tenantSettingGroup || 'Other'
    groups.set(g, [...(groups.get(g) ?? []), s])
  }
  const out: TreeNode[] = []
  for (const [g, items] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
    const id = `${SETTINGS}${g}`
    const on = items.filter(s => s.enabled).length
    out.push({ id, parent: SETTINGS, kind: 'setting group', name: g, path: '', hidden: false, sig: '', note: `${on} of ${items.length} on` })
    for (const s of [...items].sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))) {
      out.push({ id: `${id}/${s.settingName}`, parent: id, kind: 'tenant setting', name: s.title || s.settingName, path: '', hidden: false, sig: s.settingName, note: stateOf(s) })
    }
  }
  return out
}

function scoped(s: Setting): boolean {
  return Boolean(s.enabledSecurityGroups?.length || s.excludedSecurityGroups?.length || s.delegateToWorkspace || s.delegateToCapacity || s.delegateToDomain)
}

function stateOf(s: Setting): string {
  return s.enabled ? (scoped(s) ? 'On - scoped' : 'On') : 'Off'
}

function settingDocs(name: string): string {
  return SETTING_DOCS[name]?.[0] || SETTINGS_INDEX
}

function settingDetail(name: string): string[] {
  const s = settingOf.get(name)
  if (!s) return []
  const names = (list?: { name?: string }[]) => (list ?? []).map(x => x.name).filter(Boolean).join(', ')
  const delegated = [s.delegateToWorkspace ? 'workspace' : '', s.delegateToCapacity ? 'capacity' : '', s.delegateToDomain ? 'domain' : ''].filter(Boolean).join(', ')
  const [, description, byDefault, recommended, risk] = SETTING_DOCS[name] ?? ['', '', '', '', '']
  return [
    `State: ${stateOf(s)}`,
    ...(byDefault ? [`Default: ${byDefault}`] : []),
    ...(recommended ? [`Recommended: ${recommended}${risk ? ` (${risk} risk)` : ''}`] : []),
    `Setting: ${s.settingName}`,
    `Group: ${s.tenantSettingGroup ?? ''}`,
    ...(names(s.enabledSecurityGroups) ? [`Applies to: ${names(s.enabledSecurityGroups)}`] : s.enabled ? ['Applies to: entire organization'] : []),
    ...(names(s.excludedSecurityGroups) ? [`Except: ${names(s.excludedSecurityGroups)}`] : []),
    ...(delegated ? [`Delegated to: ${delegated}`] : []),
    ...(description ? [`About: ${description}`] : []),
  ]
}

function oneLakeReason(nodes: TreeNode[], n: TreeNode, err: unknown): string {
  const text = errorText(err)
  if (!/NotFound/i.test(text)) return text
  let ws: TreeNode | undefined = n
  while (ws && ws.kind !== 'workspace') ws = nodes.find(x => x.id === ws?.parent)
  const cap = ws ? capacityOf.get(ws.sig.toLowerCase()) : undefined
  if (cap && paused(cap)) return `capacity ${capacityName.get(cap) ?? cap} is paused, so OneLake is unavailable`
  return 'OneLake returned NotFound; the capacity may be paused'
}

async function toggleDomains($: EngineInterface): Promise<void> {
  const on = (await get($)).byDomain === false
  if (on && domainOf.size === 0) await withPending($, 'Fetching domains…', () => warmGroups($))
  await patch($, cur => ({ byDomain: on, nodes: grouped(cur.nodes, on, cur.byCapacity === true), root: /^[DC]:/.test(cur.root) ? '' : cur.root }))
}

async function toggleCapacity($: EngineInterface): Promise<void> {
  const ex = await get($)
  const on = ex.byCapacity !== true
  if (on && capacityOf.size === 0) {
    await withPending($, 'Fetching capacities…', async () => {
      await warmGroups($)
      if (capacityOf.size === 0) await loadGroups($, true)
    })
  }
  await patch($, cur => ({ byCapacity: on, nodes: grouped(cur.nodes, cur.byDomain !== false, on), root: /^[DC]:/.test(cur.root) ? '' : cur.root }))
}

async function relistRoot($: EngineInterface): Promise<void> {
  const target = (await get($)).target
  if (!target) return
  try {
    const kids = parseWorkspaces(await fabLs($))
    await patch($, cur => (sameTarget(cur.target, target) ? { nodes: grouped(merge(grouped(cur.nodes, false), '', kids), cur.byDomain !== false, cur.byCapacity === true), setup: null } : {}))
  } catch (err) {
    if (isAborted(err)) return void $.ui.invalidate('ui.render')
    statusOwner = ''
    const setup = setupOf(err)
    await patchView($, cur => (sameTarget(cur.target, target) ? { status: setup ? '' : errorText(err), setup } : {}))
  }
}

async function doRefresh($: EngineInterface): Promise<void> {
  const target = (await get($)).target
  if (!target) return
  await patchView($, () => ({ status: 'loading' }))
  treeGen++
  try {
    const view = await get($)
    const byDomain = view.byDomain !== false
    const byCapacity = view.byCapacity === true
    const [listing, problem] = await Promise.all([fabLs($), byDomain || byCapacity ? loadDomains($, byCapacity) : Promise.resolve(''), loadTenant($)])
    const nodes = grouped(parseWorkspaces(listing), byDomain, byCapacity)
    await patch($, cur => (sameTarget(cur.target, target) ? { nodes, expanded: cur.nodes.length ? cur.expanded : [], status: problem ? errorText(problem) : '', setup: null } : {}))
    await expandOpen($)
  } catch (err) {
    if (isAborted(err)) {
      await patchView($, cur => (cur.status === 'loading' ? { status: '' } : {}))
      return void $.ui.invalidate('ui.render')
    }
    const setup = setupOf(err)
    await patch($, cur => (sameTarget(cur.target, target) ? { status: setup ? '' : errorText(err), setup } : {}))
  }
}

const rerun = new Map<string, Promise<boolean>>()

function reloadNode($: EngineInterface, id: string): Promise<boolean> {
  const key = `reload:${id.toLowerCase()}`
  const running = loading.get(key)
  if (running) {
    const again = () => {
      rerun.delete(key)
      return reloadNode($, id)
    }
    const next = rerun.get(key) ?? running.then(again, again)
    rerun.set(key, next)
    return next
  }
  const job = (async () => {
    const pending = loading.get(id)
    if (pending) await pending.catch(() => false)
    const ex = await get($)
    const n = ex.nodes.find(x => x.id === id)
    if (!n || !isLoaded(ex.nodes, n.id)) return true
    const gen = treeGen
    try {
      const { kids } = await childrenOf($, n, ex.nodes)
      const owned = statusOwner === n.id
      if (owned) statusOwner = ''
      await patch($, cur => (gen === treeGen && cur.nodes.some(x => x.id === n.id) ? { nodes: merge(cur.nodes, n.id, kids), ...(owned ? { status: '' } : {}) } : {}))
    } catch (err) {
      statusOwner = n.id
      await patchView($, () => ({ status: errorText(err) }))
      return false
    }
    await expandOpen($, n.id)
    return true
  })().finally(() => loading.delete(key))
  loading.set(key, job)
  return job
}

async function reloadWorkspace($: EngineInterface, workspace: string): Promise<boolean> {
  const ws = wsNode((await get($)).nodes, workspace)
  return ws ? reloadNode($, ws.id) : true
}

function expandFabric($: EngineInterface, n: TreeNode, urgent = false): Promise<boolean> {
  const running = loading.get(n.id)
  if (running) return running
  const job = (async () => {
    const ex = await get($)
    if (!ex.nodes.some(c => c.parent === n.id && c.kind === PLACEHOLDER)) return true
    const gen = treeGen
    if (n.id === SETTINGS) {
      try {
        const kids = await loadSettings($)
        await patch($, cur => ({ nodes: cur.nodes.flatMap(x => (x.parent === SETTINGS && x.kind === PLACEHOLDER ? kids : [x])) }))
        return true
      } catch (err) {
        const why = errorText(err)
        await patch($, cur => ({ nodes: cur.nodes.map(x => (x.parent === SETTINGS && x.kind === PLACEHOLDER ? { ...x, name: why } : x)) }))
        return false
      }
    }
    if (inOneLake(n) && capacityState.size === 0) await warmGroups($)
    try {
      const { kids, become } = await childrenOf($, n, ex.nodes, urgent)
      const owned = statusOwner === n.id
      if (owned) statusOwner = ''
      const fill = kids.length ? kids : become === 'lakehouse table' ? [] : [emptyMark(n.id)]
      await patch($, cur =>
        gen === treeGen && cur.nodes.some(x => x.parent === n.id && x.kind === PLACEHOLDER)
          ? { nodes: cur.nodes.flatMap(x => (x.parent === n.id && x.kind === PLACEHOLDER ? fill : x.id === n.id && become ? [{ ...x, kind: become, note: become === 'lakehouse table' ? 'Delta table' : x.note }] : [x])), ...(owned ? { status: '' } : {}) }
          : owned
            ? { status: '' }
            : {},
      )
      return true
    } catch (err) {
      if (isAborted(err)) return false
      const why = inOneLake(n) ? oneLakeReason((await get($)).nodes, n, err) : errorText(err)
      await patch($, cur => ({ nodes: cur.nodes.map(x => (x.parent === n.id && x.kind === PLACEHOLDER ? { ...x, name: why } : x)) }))
      return false
    }
  })().finally(() => loading.delete(n.id))
  loading.set(n.id, job)
  return job
}

async function reveal($: EngineInterface, workspace: string, focus = false): Promise<void> {
  const n = wsNode((await get($)).nodes, workspace)
  if (!n) return
  await patch($, cur => ({ expanded: [...new Set([...cur.expanded, ...ancestors(cur.nodes, n.id), n.id])], ...(focus ? { cursor: n.id } : {}) }))
  await expandFabric($, n)
}

async function revealPath($: EngineInterface, path: string): Promise<void> {
  const segs = path.replace(/^\//, '').replace(/\/$/, '').split('/')
  for (let i = 2; i < segs.length; i++) {
    const n = nodeAtPath((await get($)).nodes, segs.slice(0, i).join('/'))
    if (!n) return
    await expandFabric($, n)
  }
}

let reportLinks = 'embed'

function embedUrl(reportId: string): string {
  return `https://app.powerbi.com/reportEmbed?reportId=${encodeURIComponent(reportId)}&autoAuth=true${tenantId ? `&ctid=${encodeURIComponent(tenantId)}` : ''}`
}

function linkFor(type: string, portal: string, reportId = ''): string {
  if (type !== 'Report' || reportLinks !== 'embed') return portal
  const id = reportId || (portal.match(/\/reports\/([0-9a-f-]{36})/i)?.[1] ?? '')
  return id ? embedUrl(id) : portal
}

function webUrl(_ex: Explorer, n: TreeNode): string {
  return linkFor(n.kind, n.url || '')
}

async function openLocal($: EngineInterface, ex: Explorer, n: TreeNode): Promise<void> {
  const model = modelOf(n)
  if (model) await terminal($, ['te', 'interactive', '-s', model.server, '-d', model.database], ['te', 'interactive', '-s', model.server, '-d', model.database])
  else if (webUrl(ex, n)) await openUrl($, webUrl(ex, n))
}

function tenantNode(nodes?: TreeNode[]): TreeNode {
  const spaces = nodes ? nodes.filter(x => x.kind === 'workspace').length : 0
  return { id: TENANT, parent: '', kind: 'tenant', name: tenantName || 'Fabric tenant', path: '', hidden: false, sig: tenantId, note: spaces ? plural(spaces, 'workspace') : '' }
}

const ROW_PX = 24
const SVG_NS = 'http://www.w3.org/2000/svg'

function guides(depth: number): string {
  const lines = Array.from({ length: depth }, (_, i) => `<rect x="${i * 16 + 7.5}" y="0" width="1" height="${ROW_PX}" fill="#34343c"/>`).join('')
  return `<svg xmlns="${SVG_NS}" width="${depth * 16}" height="${ROW_PX}" viewBox="0 0 ${depth * 16} ${ROW_PX}">${lines}</svg>`
}

function withOptimistic(ex: Explorer): Explorer {
  if (optimistic.size === 0 && !pressedCursor) return ex
  const open = new Set(ex.expanded)
  for (const [id, isOpen] of optimistic) {
    if (id === TENANT) isOpen ? open.delete(TENANT_CLOSED) : open.add(TENANT_CLOSED)
    else isOpen ? open.add(id) : open.delete(id)
  }
  return { ...ex, expanded: [...open], cursor: pressedCursor || ex.cursor }
}

function setFindQuery($: EngineInterface, v: string): void {
  findQuery = v
  $.ui.invalidate('ui.render')
}

function toggleFind($: EngineInterface): void {
  findMode = !findMode
  findHits = null
  findQuery = ''
  finding = false
  $.ui.invalidate('ui.render')
  if (findMode) {
    quiet(
      get($)
        .then(ex => openPane($, { id: PANE, title: titleFor(ex.target), focus: true }))
        .then(() => $.ui.focus({ requestId: PANE, key: 'q' })),
    )
  }
}

async function runFind($: EngineInterface, query: string): Promise<void> {
  findQuery = query
  if (!query.trim()) {
    findHits = null
    $.ui.invalidate('ui.render')
    return
  }
  finding = true
  $.ui.invalidate('ui.render')
  try {
    const body = jsonOf<{ result?: { data?: Hit[] } }>(await fabRaw($, ['find', query.trim(), '-l', '--output_format', 'json'], true))
    if (findQuery === query) findHits = (body?.result?.data ?? []).filter(h => h.id && h.name && h.type)
  } catch (err) {
    if (findQuery === query) {
      findHits = []
      await patchView($, () => ({ status: errorText(err) }))
    }
  } finally {
    if (findQuery === query) finding = false
    $.ui.invalidate('ui.render')
  }
}

async function revealHit($: EngineInterface, h: Hit): Promise<void> {
  findMode = false
  findHits = null
  findQuery = ''
  $.ui.invalidate('ui.render')
  let ex = await get($)
  const ws = wsNode(ex.nodes, h.workspace)
  if (!ws) {
    await patchView($, () => ({ status: `${h.workspace} is not in the tree` }))
    return
  }
  if (!isLoaded(ex.nodes, ws.id)) await expandFabric($, ws, true)
  ex = await get($)
  const target = ex.nodes.find(n => n.kind === h.type && n.name === h.name && ancestors(ex.nodes, n.id).includes(ws.id))
  const open = target ? ancestors(ex.nodes, target.id) : [...ancestors(ex.nodes, ws.id), ws.id]
  await patch($, cur => ({ expanded: [...new Set([...cur.expanded, ...open])], cursor: (target ?? ws).id, scroll: null }))
  if (target) await select($, target)
}

let hitTimer: { cancel: () => void } | null = null

function pressHit($: EngineInterface, index: number): void {
  const h = findHits?.[index]
  if (!h) return
  const now = Date.now()
  const key = `${FIND}${h.id}`
  const isDouble = lastPress.key === key && now - lastPress.at < DOUBLE_MS
  lastPress = { key: isDouble ? '' : key, at: now }
  hitTimer?.cancel()
  hitTimer = null
  if (isDouble) return void quiet(openUrl($, linkFor(h.type, itemUrl(h.workspace_id, h.type, h.id), h.id)))
  hitTimer = $.clock.after(DOUBLE_MS, () => {
    hitTimer = null
    quiet(revealHit($, h))
  })
}

function pressNow($: EngineInterface, n: TreeNode, r: Row): void {
  const now = Date.now()
  const isDouble = lastPress.key === n.id && now - lastPress.at < DOUBLE_MS
  lastPress = { key: isDouble ? '' : n.id, at: now }
  if (isDouble && n.id !== TENANT && n.kind !== 'tenant setting') {
    quiet(get($).then(ex => openWeb($, ex, n)))
    return
  }
  if (!r.leaf) optimistic.set(n.id, !r.open)
  pressedCursor = n.id
  $.ui.invalidate('ui.render')
  quiet(
    press($, n)
      .catch((err: unknown) => patchView($, () => ({ status: errorText(err) })))
      .finally(() => {
        optimistic.delete(n.id)
        if (pressedCursor === n.id) pressedCursor = ''
        $.ui.invalidate('ui.render')
      }),
  )
}

function treeRows(ex: Explorer): Row[] {
  const base = visible(ex, SORT, rootOf(ex))
  if (rootOf(ex)) return base
  const open = !ex.expanded.includes(TENANT_CLOSED)
  return [{ node: tenantNode(ex.nodes), depth: 0, open, leaf: false }, ...(open ? base.map(r => ({ ...r, depth: r.depth + 1 })) : [])]
}

async function select($: EngineInterface, n: TreeNode): Promise<void> {
  if (n.kind === PLACEHOLDER || n.kind === EMPTY) return
  if (n.id === TENANT) {
    await patch($, cur => ({
      expanded: cur.expanded.includes(TENANT_CLOSED) ? cur.expanded.filter(x => x !== TENANT_CLOSED) : [...cur.expanded, TENANT_CLOSED],
      cursor: TENANT,
      detail: [`tenant ${n.name}`, ...(tenantId ? [`Tenant ID: ${tenantId}`] : [])],
    }))
    return
  }
  if (n.kind === 'tenant setting') {
    await patch($, cur => ({ cursor: n.id, detail: [`tenant setting ${n.name}`, ...settingDetail(n.sig)] }))
    return
  }
  const ex = await get($)
  const isLeaf = !ex.nodes.some(c => c.parent === n.id)
  await patch($, cur => {
    const open = new Set(cur.expanded)
    if (!isLeaf) open.has(n.id) ? open.delete(n.id) : open.add(n.id)
    return { expanded: [...open], cursor: n.id, selected: n.path ? n.id : cur.selected }
  })
  if (!isLeaf && (await expandFabric($, n, true))) await expandOpen($, n.id)
  if (n.kind === 'capacity' && /^[0-9a-f-]{36}$/i.test(n.sig)) {
    await patchView($, cur => (cur.cursor === n.id ? { detail: [`capacity ${shownName(n)}`, ...capacityDetail(n.sig)] } : {}))
    return
  }
  const detail: string[] = [`${n.kind} ${n.name}`, ...(n.path ? [`fab path: ${n.path}`] : n.note && !GROUP_KINDS.has(n.kind) ? [n.note] : [])]
  const key = apiPathOf(n)
  const cached = key ? await cachedProps($, key) : undefined
  await patchView($, cur => (cur.cursor === n.id ? { detail: [...detail, ...(cached ?? [])] } : {}))
  const props = await properties($, n).catch((err: unknown) => (cached ? cached : [`properties unavailable: ${errorText(err)}`]))
  if (key && props.length && !props[0]?.startsWith('properties unavailable')) void rememberProps($, key, props)
  if (props.length && props.join('\n') !== (cached ?? []).join('\n')) await patchView($, cur => (cur.cursor === n.id ? { detail: [...detail, ...props] } : {}))
}

const PROPERTY_LABELS: [string, string][] = [
  ['type', 'Type'],
  ['id', 'ID'],
  ['description', 'Description'],
  ['folderId', 'Folder ID'],
  ['capacityId', 'Capacity'],
  ['capacityRegion', 'Region'],
  ['domainId', 'Domain'],
]

function propertyValue(key: string, value: string): string {
  if (key === 'capacityId') return capacityName.get(value.toLowerCase()) ?? value
  if (key === 'domainId') return domainName.get(value.toLowerCase()) ?? value
  return value
}

function apiPathOf(n: TreeNode): string {
  if (n.kind === 'workspace') return /^[0-9a-f-]{36}$/i.test(n.sig) ? `workspaces/${n.sig}` : ''
  const m = (n.url ?? '').match(/\/groups\/([0-9a-f-]{36})\/[^/]+\/([0-9a-f-]{36})/i)
  return m ? `workspaces/${m[1]}/items/${m[2]}` : ''
}

async function namesOf($: EngineInterface, list: string, suffix: RegExp, into: Map<string, string>): Promise<void> {
  if (into.size > 0) return
  const body = jsonOf<{ result?: { data?: { name?: string; id?: string }[] } }>(await fabRaw($, ['ls', list, '-l', '--output_format', 'json']).catch(orAborted('')))
  for (const d of body?.result?.data ?? []) if (d.id && d.name) into.set(d.id.toLowerCase(), d.name.replace(suffix, ''))
}

const PROPS_KEY = 'properties'
const PROPS_MAX = 500
let propCache: Map<string, string[]> | null = null

async function loadProps($: EngineInterface): Promise<Map<string, string[]>> {
  if (propCache) return propCache
  const saved = await $.store.get(PROPS_KEY).catch(() => undefined)
  const entries = Array.isArray(saved) ? saved.filter((x): x is [string, string[]] => Array.isArray(x) && typeof x[0] === 'string' && Array.isArray(x[1])) : []
  propCache = new Map(entries)
  return propCache
}

async function cachedProps($: EngineInterface, key: string): Promise<string[] | undefined> {
  return (await loadProps($)).get(key)
}

async function rememberProps($: EngineInterface, key: string, props: string[]): Promise<void> {
  const cache = await loadProps($)
  cache.delete(key)
  cache.set(key, props)
  while (cache.size > PROPS_MAX) cache.delete(cache.keys().next().value as string)
  await $.store.set(PROPS_KEY, [...cache.entries()]).catch(() => undefined)
}

async function properties($: EngineInterface, n: TreeNode): Promise<string[]> {
  const path = apiPathOf(n)
  if (!path) return []
  const body = jsonOf<Record<string, unknown>>(await fabRaw($, ['api', path, '-q', 'text'], true))
  if (!body) return []
  await Promise.all([
    body.capacityId ? namesOf($, '/.capacities', /\.Capacity$/i, capacityName) : Promise.resolve(),
    body.domainId ? namesOf($, '/.domains', /\.Domain$/i, domainName) : Promise.resolve(),
  ])
  return PROPERTY_LABELS.filter(([k]) => body[k] !== undefined && body[k] !== null && body[k] !== '').map(([k, label]) => `${label}: ${propertyValue(k, String(body[k]))}`)
}

function contextFor(ex: Explorer, n: TreeNode): string {
  return [
    'The user has this Fabric item selected in the Fabric pane; "this", "it" or "the selected" in the prompt likely refers to it.',
    `${n.kind}: ${n.name}`,
    `fab path: ${n.path}`,
    ...ex.detail.slice(2),
  ].join('\n')
}

const waiting = new Map<string, () => Promise<void>>()

function backgroundOf(result: unknown): string {
  if (!result || typeof result !== 'object') return ''
  const id = (result as { backgroundTaskId?: unknown }).backgroundTaskId
  return typeof id === 'string' ? id : ''
}

async function afterFab($: EngineInterface, calls: Invocation[], stale: Set<string>, succeeded: boolean): Promise<void> {
  const head = calls[0]
  if (!head) return
  fabContext = contextOf(head)
  const moved = await point($, targetOf(fabContext.env), 'unasked')
  const start = await get($)
  const fresh0 = moved || start.nodes.length === 0 || start.setup !== null
  if (fresh0) await refresh($)
  const prior = await get($)
  const before = new Set(prior.expanded)
  const lower = (xs: string[]) => [...new Map(xs.map(x => [x.toLowerCase(), x])).values()]
  const changes = calls.filter(inv => fabKind(inv) === 'modify' || fabKind(inv) === 'upload')
  const whole = new Set(
    changes
      .filter(inv => WHOLE_VERBS.has(inv.args[0] ?? '') || (inv.args[0] === 'set' && inv.args.some(a => /displayname/i.test(a))))
      .flatMap(inv => fabPositionals(inv.args.slice(1)).filter(a => /^\/?[^/]+\.Workspace\/?$/i.test(a)).flatMap(a => fabWorkspaces({ ...inv, args: ['', a] })))
      .map(w => w.toLowerCase()),
  )
  if (whole.size && !fresh0) await relistRoot($)
  await pool(lower(calls.flatMap(fabWorkspaces).filter(w => !whole.has(w.toLowerCase()))), w => reveal($, w))
  await pool(
    lower(
      changes.flatMap(fabWorkspaces).filter(w => {
        if (whole.has(w.toLowerCase())) return false
        const id = wsId(prior.nodes, w)
        return isLoaded(prior.nodes, id) || stale.has(id)
      }),
    ),
    w => reloadWorkspace($, w),
  )
  const folders = new Set<string>()
  for (const inv of changes) {
    for (const a of fabPositionals(inv.args.slice(1))) {
      const segs = a.replace(/^\/+|\/+$/g, '').split('/')
      for (let i = 2; i < segs.length; i++) {
        const n = nodeAtPath(prior.nodes, segs.slice(0, i).join('/'))
        if (n && isLoaded(prior.nodes, n.id)) folders.add(n.id)
      }
    }
  }
  await pool([...folders], id => reloadNode($, id))
  const guids = calls.flatMap(fabGuids)
  if (guids.length) {
    const cur = await get($)
    const spaces = byGuid(guids, cur.nodes).flatMap(id => cur.nodes.filter(n => n.id === id && n.kind === 'workspace'))
    const edited = calls.some(inv => fabGuids(inv).length && fabKind(inv) !== 'read' && fabKind(inv) !== 'download')
    await pool(spaces, w => (edited && isLoaded(cur.nodes, w.id) ? reloadWorkspace($, w.name) : isLoaded(cur.nodes, w.id) ? Promise.resolve() : expandFabric($, w, true).then(() => undefined)))
  }
  for (const a of lower(calls.flatMap(inv => inv.args.slice(1).filter(x => /\.Workspace\//i.test(x))))) await revealPath($, a)
  if (!succeeded) return
  const fresh = await get($)
  const lit = { touched: [] as string[], opened: [] as string[] }
  for (const inv of calls) {
    const touched = fabTouched(inv, fresh.nodes)
    const opened = touched.length ? fabWorkspaces(inv).map(w => wsId(fresh.nodes, w)).filter(id => !before.has(id)) : []
    lit.touched.push(...touched)
    lit.opened.push(...opened)
    const hit = byGuid(fabGuids(inv), fresh.nodes)
    const spaces = new Set(fresh.nodes.filter(n => n.kind === 'workspace' && hit.includes(n.id)).map(n => n.id))
    const items = hit.filter(id => !spaces.has(id))
    lit.touched.push(...(items.length ? items : [...spaces]))
    if (items.length) lit.opened.push(...[...spaces].filter(id => !before.has(id)))
  }
  await flash($, lit.touched, lit.opened)
}

async function pinWorkspaces($: EngineInterface, calls: Invocation[]): Promise<void> {
  const ex = await get($)
  const byId = new Map(ex.nodes.map(n => [n.id, n]))
  const spaceOf = (id: string) => [id, ...ancestors(ex.nodes, id, byId)].find(a => byId.get(a)?.kind === 'workspace')
  const ids = calls.flatMap(inv => [
    ...fabWorkspaces(inv).map(w => wsNode(ex.nodes, w)?.id ?? ''),
    ...byGuid(fabGuids(inv), ex.nodes).map(id => spaceOf(id) ?? ''),
  ])
  await patchView($, cur => {
    const pin = [...(cur.pin ?? [])]
    for (const id of ids) if (id && !pin.includes(id)) pin.push(id)
    return pin.length === (cur.pin ?? []).length ? {} : { pin }
  })
}

function byGuid(guids: string[], nodes: TreeNode[]): string[] {
  if (guids.length === 0) return []
  const want = new Set(guids)
  const own = (n: TreeNode) => (n.kind === 'fabric folder' ? (n.sig.split('/').pop() ?? '') : n.sig).toLowerCase()
  return nodes.filter(n => (n.sig && want.has(own(n))) || [...want].some(g => (n.url ?? '').toLowerCase().includes(g))).map(n => n.id)
}

const SQL_KINDS = new Set(['Lakehouse', 'Warehouse', 'SQLEndpoint', 'SQLDatabase', 'MirroredDatabase'])

async function queryNodes($: EngineInterface, queries: { inv: Invocation; q: ReturnType<typeof queryOf> }[], nodes: TreeNode[]): Promise<{ ids: string[]; workspaces: string[]; models: string[] }> {
  const ids: string[] = []
  const workspaces: string[] = []
  const models: string[] = []
  for (const { inv, q } of queries) {
    if (!q) continue
    let workspace = q.workspace
    let model = q.model
    if (q.report) {
      try {
        const base = posix(q.report).startsWith('/') ? posix(q.report) : `${posix(inv.cwd).replace(/\/+$/, '')}/${posix(q.report)}`
        const found = modelFromConnection(String(await $.fs.read(`${base.replace(/\/+$/, '')}/definition.pbir`)))
        if (found) ({ workspace, model } = found)
      } catch {
        continue
      }
    }
    if (workspace && model) {
      workspaces.push(workspace)
      const path = `${workspace}.workspace/${model}.semanticmodel`.toLowerCase()
      models.push(path)
      const n = nodes.find(x => x.path.toLowerCase() === path)
      if (n) ids.push(n.id)
    }
    if (q.database) ids.push(...nodes.filter(n => SQL_KINDS.has(n.kind) && n.name.toLowerCase() === q.database.toLowerCase()).map(n => n.id))
  }
  return { ids: [...new Set(ids)], workspaces: [...new Set(workspaces)], models }
}

async function afterQueries($: EngineInterface, asked: { ids: string[]; workspaces: string[]; models: string[] }): Promise<void> {
  if (closed || noDock) return
  await pool(asked.workspaces, w => reveal($, w))
  const fresh = await get($)
  const ids = [...new Set([...asked.ids, ...fresh.nodes.filter(n => asked.models.includes(n.path.toLowerCase())).map(n => n.id)])]
  await flash($, ids)
}

function wholeArg(args: string | undefined): string {
  const raw = (args ?? '').trim()
  return /^["']/.test(raw) ? (tokenize(raw)[0] ?? '') : raw
}

type RowsData = { press?: unknown; key?: unknown; ctrl?: unknown; shift?: unknown; scrollTo?: unknown; copy?: unknown; tab?: unknown }

async function rowsMessage($: EngineInterface, surface: string, data: RowsData): Promise<void> {
  const view = views.get(surface) ?? { from: 0, max: 0 }
  if (typeof data.tab === 'string' && data.tab.startsWith(CAP)) {
    quiet(toggleRun($, data.tab.slice(CAP.length)))
    return
  }
  const ex = await get($)
  if (typeof data.scrollTo === 'number') {
    const to = Math.round(Math.max(0, Math.min(1, data.scrollTo)) * view.max)
    if (to !== ex.scroll) await patchView($, () => ({ scroll: to }))
    return
  }
  if (typeof data.copy === 'string') {
    const n = ex.nodes.find(x => x.id === data.copy)
    if (n) await copyOf($, n.path || n.name, surface)
    return
  }
  if (typeof data.press === 'string' && data.press.startsWith(FIND)) {
    pressHit($, Number(data.press.slice(FIND.length)))
    return
  }
  if (typeof data.press === 'string') {
    const n = data.press === TENANT ? tenantNode() : ex.nodes.find(x => x.id === data.press)
    if (!n) return
    if (ex.scroll === null) await patchView($, () => ({ scroll: view.from }))
    if (data.ctrl) await openWeb($, ex, n)
    else if (data.shift) await openLocal($, ex, n)
    else {
      const row = treeRows(withOptimistic(ex)).find(r => r.node.id === n.id)
      if (row) pressNow($, n, row)
      else await press($, n)
    }
    return
  }
  if (typeof data.key !== 'string') return
  const rows = treeRows(ex)
  const at = rows.findIndex(r => r.node.id === ex.cursor)
  const cur = rows[at]
  const move = (d: number) => {
    const target = rows[Math.max(0, Math.min(rows.length - 1, (at < 0 ? 0 : at) + d))]
    return target ? patchView($, () => ({ cursor: target.node.id, scroll: null })) : Promise.resolve()
  }
  if (data.key === 'up' || data.key === 'k') await move(-1)
  else if (data.key === 'down' || data.key === 'j') await move(1)
  else if (data.key === 'pageup') await move(-10)
  else if (data.key === 'pagedown') await move(10)
  else if (data.key === 'home') await move(-rows.length)
  else if (data.key === 'end') await move(rows.length)
  else if (cur && (data.key === 'y' || data.key === 'Y')) await copyOf($, cur.node.path || cur.node.name, surface)
  else if (cur && (data.key === 'right' || data.key === 'l') && !cur.leaf && !cur.open) await select($, cur.node)
  else if (cur && (data.key === 'left' || data.key === 'h')) {
    if (!cur.leaf && cur.open) await patchView($, x => ({ expanded: x.expanded.filter(id => id !== cur.node.id) }))
    else if (cur.node.parent) await patchView($, () => ({ cursor: cur.node.parent }))
  } else if (cur && (data.key === ' ' || data.key === 'space' || data.key === 'return')) await (data.key === 'return' && cur.leaf ? openLocal($, ex, cur.node) : select($, cur.node))
}

export const register: Register = (on, options) => {
  glyphSetting = typeof options?.glyphs === 'string' ? options.glyphs : 'auto'
  follow = options?.follow !== 'off'
  fontHint = options?.fontHint !== 'off'
  reportLinks = options?.reportLinks === 'portal' ? 'portal' : 'embed'

  on('session.end', async ($, e, next) => {
    await flush($).catch(() => undefined)
    return next(e)
  })

  on('session.start', async ($, e, next) => {
    useDrives((await $.env.get('OS')) === 'Windows_NT')
    hinted = false
    fellBack = false
    quiet(detectGlyphs($).then(() => $.ui.invalidate('ui.render')))
    running = 0
    generation++
    blink?.cancel()
    blink = null
    saveTimer?.cancel()
    saveTimer = null
    cached = await load($)
    await patchView($, () => ({ flash: [], flashDim: [], work: null, busy: {} }))
    await $.command.register({ name: PANE, description: 'Open the Fabric pane; args: [workspace]', immediate: true })
    const ex = await get($)
    if (ex.target) quiet(openPane($, { id: PANE, title: titleFor(ex.target) }))
    return next(e)
  })

  on('command.run', { command: PANE }, async ($, e) => {
    const terminalOnly = !(await $.session.surfaces().catch(() => ['terminal'])).some(x => x !== 'terminal')
    if (terminalOnly && e.presentation && !e.presentation.isFullscreen) return { text: 'The Fabric pane shows in the sidebar, which needs the fullscreen layout. Run /tui fullscreen, then /fabric-pane.' }
    if (terminalOnly && e.presentation && e.presentation.columns < 110) return { text: 'The Fabric pane shows in the sidebar, which needs a terminal at least 110 columns wide. Widen it, then run /fabric-pane.' }
    noDock = false
    fellBack = false
    quiet(detectGlyphs($).then(() => $.ui.invalidate('ui.render')))
    const workspace = wholeArg(e.args)
    await point($, targetOf(fabContext.env), 'asked', true)
    $.clock.after(0, () => quiet(refresh($).then(() => (workspace ? reveal($, workspace.replace(/\.Workspace$/i, ''), true) : undefined))))
    return { text: workspace ? `Fabric pane on ${workspace}.` : 'Fabric pane open.' }
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const command = e.tool === 'Bash' ? e.command : ''
    if (!/\b(fab|te|pbir|sqlcmd)\b/.test(command)) return next(e)
    const found = invocations(command, await cwdOf($), {}, ['fab', 'te', 'pbir', 'sqlcmd'])
    const calls = fabCalls(found.filter(i => i.tool === 'fab'))
    const queries = found.filter(i => i.tool !== 'fab').flatMap(i => {
      const q = queryOf(i)
      return q ? [{ inv: i, q }] : []
    })
    if (calls.length === 0 && queries.length === 0) return next(e)
    if (closed || noDock) return next(e)
    const ex = await get($)
    const asked = await queryNodes($, queries, ex.nodes)
    const mark: Mark = {
      ids: [HEADER, ...calls.flatMap(inv => [...fabWorkspaces(inv).map(w => wsId(ex.nodes, w)), ...fabTouched(inv, ex.nodes), ...byGuid(fabGuids(inv), ex.nodes)]), ...asked.ids],
      tone: toneOf([...calls.map(fabKind), ...(queries.length ? (['read'] as FabKind[]) : [])]),
    }
    await begin($, mark)
    let result: Awaited<ReturnType<typeof next>>
    try {
      result = await next(e)
    } catch (err) {
      await finish($, mark)
      throw err
    }
    const task = result.deny ? '' : backgroundOf(result.result)
    const stale = new Set(loading.keys())
    const settle = async () => {
      try {
        if (result.deny || closed || noDock) return
        if (calls.length && !result.isError) await pinWorkspaces($, calls)
        if (calls.length) await afterFab($, calls, stale, !result.isError)
        if (queries.length && !result.isError) await afterQueries($, asked)
      } finally {
        await finish($, mark)
      }
    }
    if (task) waiting.set(task, settle)
    else void settle().catch(() => undefined)
    return result
  })

  on('ui.close', async ($, e, next) => {
    const result = await next(e)
    if (e.id === PANE && e.origin.kind === 'person') closed = true
    return result
  })

  on('ui.message', async ($, e, next) => {
    if (e.requestId === PANE && e.element.startsWith('z:') && e.data && typeof e.data === 'object') {
      const data = e.data as { zone?: unknown; ctrl?: unknown; shift?: unknown; key?: unknown; copy?: unknown }
      if (typeof data.key === 'string' || typeof data.copy === 'string') {
        await rowsMessage($, e.surface, data)
        return {}
      }
      const id = typeof data.zone === 'string' ? data.zone : ''
      if (id === PROPS) {
        propsOpen = !propsOpen
        $.ui.invalidate('ui.render')
        return {}
      }
      if (id.startsWith(FIND)) {
        pressHit($, Number(id.slice(FIND.length)))
        return {}
      }
      if (id.startsWith(CAP)) {
        quiet(toggleRun($, id.slice(CAP.length)))
        return {}
      }
      if (id === `${TOGGLE}find`) {
        toggleFind($)
        return {}
      }
      if (id === `${TOGGLE}domains`) quiet(toggleDomains($))
      else if (id === `${TOGGLE}capacities`) quiet(toggleCapacity($))
      else if (id) {
        const ex = withOptimistic(await get($))
        const row = treeRows(ex).find(r => r.node.id === id)
        if (row && data.ctrl) quiet(openWeb($, ex, row.node))
        else if (row && data.shift) quiet(openLocal($, ex, row.node))
        else if (row) pressNow($, row.node, row)
      }
      return {}
    }
    if (e.requestId === PANE && e.element.startsWith('tg:') && e.data && typeof e.data === 'object') {
      const tab = (e.data as { tab?: unknown }).tab
      if (tab === `${TOGGLE}domains`) quiet(toggleDomains($))
      else if (tab === `${TOGGLE}capacities`) quiet(toggleCapacity($))
      else if (tab === `${TOGGLE}find`) toggleFind($)
      return {}
    }
    if (e.requestId === PANE && e.element === 'setup' && e.data && typeof e.data === 'object') {
      const data = e.data as { press?: unknown; tab?: unknown; copy?: unknown }
      const pick = [data.tab, data.press, data.copy].find((v): v is string => typeof v === 'string') ?? ''
      if (pick === REFRESH) quiet(refresh($))
      else if (pick.startsWith(COPY)) await copyOf($, pick.slice(COPY.length), e.surface)
      return {}
    }
    if (e.requestId !== PANE || e.element !== 'rows' || !e.data || typeof e.data !== 'object') return next(e)
    await rowsMessage($, e.surface, e.data as RowsData)
    return {}
  })

  on('ui.scroll', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    if (nativeScroll) return next(e)
    const view = views.get('terminal') ?? views.get('desktop') ?? { from: 0, max: 0 }
    const ex = await get($)
    const to = Math.max(0, Math.min(view.max, (ex.scroll ?? view.from) + Math.sign(e.by) * Math.max(3, Math.abs(e.by))))
    if (to !== ex.scroll) await patchView($, () => ({ scroll: to }))
    return {}
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.origin?.kind === 'task-notification') {
      for (const [task, settle] of waiting) {
        if (!e.text.includes(task)) continue
        waiting.delete(task)
        void settle().catch(() => undefined)
      }
    }
    const ex = await get($)
    const n = ex.nodes.find(x => x.id === ex.selected)
    if (!ex.target || closed || noDock) return next(e)
    const hint = fontNote()
    const context = [...(e.context ?? []), ...(n ? [contextFor(ex, n)] : []), ...(hint ? [hint] : [])]
    return context.length === (e.context ?? []).length ? next(e) : next({ ...e, context })
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    if (e.surface !== 'terminal' && e.surface !== 'desktop') return next(e)
    if (e.surface === 'terminal' && e.props.placement === 'inline') {
      noDock = true
      void $.ui.close({ id: PANE }).catch(() => undefined)
      const { Box: Empty } = $.ui.resolve(e)
      return <Empty />
    }
    const tier = tierFor(e.surface)
    if (e.surface === 'terminal' && tier === 'plain' && glyphSetting === 'auto') fellBack = true
    const { Box, Text, Button, Input, Client } = $.ui.resolve(e)
    const ex = withOptimistic(await get($))
    if (ex.target && !tenantName && !tenantAsked && !tenantLoading) {
      tenantLoading = true
      $.clock.after(0, () =>
        quiet(
          loadTenant($)
            .then(() => {
              tenantAsked = true
              $.ui.invalidate('ui.render')
            })
            .finally(() => {
              tenantLoading = false
            }),
        ),
      )
      $.clock.after(0, () => quiet(warmGroups($).then(() => $.ui.invalidate('ui.render'))))
    }
    const now = await $.clock.now()
    const busyTone = (id: string) => {
      const b = ex.busy[id]
      return b && now - b.at < BUSY_MAX_MS ? b.tone : ''
    }
    const work = ex.work && now - ex.work.at < BUSY_MAX_MS ? ex.work : null
    const brightSet = new Set(work ? ex.flash : [])
    const dimSet = new Set(work ? ex.flashDim : [])
    const width = Math.max(20, e.props.bodyColumns)
    const rows = treeRows(ex)
    const detailRows = ex.detail.length ? Math.min(ex.detail.length, DETAIL_ROWS) + 4 : 0
    const room = Math.max(5, Math.min(WINDOW, (e.props.scroll?.bodyRows ?? 40) - 4 - detailRows - (pending ? 1 : 0)))
    const focusId = follow && work && ex.flash.length ? (ex.flash[ex.flash.length - 1] ?? ex.cursor) : ex.cursor
    const at = Math.max(0, rows.findIndex(r => r.node.id === focusId))
    const isLit = (id: string) => brightSet.has(id) || dimSet.has(id)
    const lit = follow && work ? rows.findIndex(r => isLit(r.node.id)) : -1
    const fits = lit >= 0 && at - lit < room - 2
    const base = Math.max(0, Math.min(Math.max(0, rows.findIndex(r => r.node.id === ex.cursor)) - Math.floor(room / 2), rows.length - room))
    const inView = lit >= base && at < base + room
    const flashing = lit >= 0 && !inView
    const nearBottom = (span: number) => Math.max(0, Math.min(fits ? Math.min(Math.max(0, lit - 1), at - span + 3) : at - span + 3, rows.length - span))
    let from = flashing ? nearBottom(room) : base
    const cap = Math.max(1, Math.floor(room / 3))
    const chain = new Set(flashing ? ancestors(ex.nodes, focusId) : [])
    const keep = (id: string) => chain.has(id) || isLit(id)
    let pinned = flashing ? rows.slice(0, from).filter(r => keep(r.node.id)).slice(-cap) : []
    if (pinned.length) {
      from = nearBottom(Math.max(3, room - pinned.length - 1))
      pinned = rows.slice(0, from).filter(r => keep(r.node.id)).slice(-cap)
    }
    const max = Math.max(0, rows.length - room)
    if (ex.scroll !== null) {
      from = Math.max(0, Math.min(ex.scroll, max))
      pinned = []
    }
    views.set(e.surface, { from, max })
    const shown = rows.slice(from, from + room - pinned.length)
    const sel = ex.nodes.find(n => n.id === ex.selected)
    const clip = (s: string, max = width) => (s.length > max ? s.slice(0, max - 1) + '…' : s)
    const kids = new Map<string, number>()
    for (const k of ex.nodes) if (k.parent && k.kind !== PLACEHOLDER && k.kind !== EMPTY && !GROUP_KINDS.has(k.kind)) kids.set(k.parent, (kids.get(k.parent) ?? 0) + 1)
    const noteOf = (r: (typeof rows)[number]) => r.node.note || (r.open && kids.get(r.node.id) ? plural(kids.get(r.node.id) ?? 0, 'item') : '')
    const rowSpec = (r: (typeof rows)[number]): RowSpec => {
      const n = { ...r.node, note: noteOf(r) }
      const g = glyph(n, tier)
      const arrow = r.leaf ? '  ' : tier === 'plain' ? (r.open ? '▾ ' : '▸ ') : r.open ? '\u{f47c} ' : '\u{f460} '
      const note = n.note ? ` ${padCount(n.note)}` : ''
      const busy = busyTone(n.id)
      const cols = Math.max(4, width - r.depth * 2 - 6 - note.length)
      const isBright = brightSet.has(n.id) || (work !== null && busy !== '')
      const isDim = !isBright && dimSet.has(n.id)
      const name = clip(shownName(n), cols)
      const faded = n.hidden || n.kind === 'placeholder' || n.kind === EMPTY
      const tone = work?.tone ?? 'orange'
      const left: Seg[] = [
        { t: '  '.repeat(r.depth) },
        { t: arrow, c: '#7a7a86' },
        ...(n.kind === 'placeholder' && n.name === 'loading…' ? [{ t: '', spin: true }, { t: ' ' }] : [isBright || isDim ? { t: g.char + ' ', sh: tone, dim: isDim, one: true } : { t: g.char + ' ', c: faded ? '#6e6e7a' : g.color }]),
        isBright || isDim ? { t: name, sh: tone, dim: isDim, b: isBright } : { t: name, c: faded ? '#6e6e7a' : g.label, b: n.id === ex.selected },
      ]
      const run = runState(n)
      const toggleable = switchable(n)
      const state: Seg[] = !run
        ? []
        : toggleable && capBusy.has(n.sig.toLowerCase())
          ? [{ t: '', spin: true }, { t: ' ' }]
          : [{ t: (tier === 'plain' ? (run === 'paused' ? '‖' : '▸') : run === 'paused' ? '\u{f03e4}' : '\u{f040a}') + ' ', c: run === 'paused' ? '#d9a54a' : run === 'fixed' ? '#6e6e7a' : '#5cc28a', ...(toggleable ? { tab: `${CAP}${n.sig}` } : {}) }]
      const [sku, tail] = splitNote(n, padCount(note.trim()))
      const right: Seg[] = sku ? [{ t: ` ${sku} `, c: '#6e6e7a' }, ...state.map(s => ({ ...s, t: s.t.trimEnd() })), { t: tail, c: '#6e6e7a' }] : [...state, ...(note ? [{ t: ` ${padCount(note.trim())}`, c: '#6e6e7a' }] : [])]
      return { id: n.kind === 'placeholder' || n.kind === EMPTY ? '' : n.id, left: clean(left), right }
    }
    const note = (text: string): RowSpec => ({ id: '', left: [{ t: text, c: '#6e6e7a' }], right: [] })
    const hitNode = (h: Hit): TreeNode => ({ id: '', parent: '', kind: h.type, name: h.name, path: '', hidden: false, sig: '', note: '' })
    const hitNote = (h: Hit) => `${h.workspace} - ${typeLabel(h.type)}`
    const findSpecs: RowSpec[] | null = !findMode
      ? null
      : finding
        ? [{ id: '', left: [{ t: '', spin: true }, { t: ` Searching Fabric for "${findQuery.trim()}"`, c: '#6e6e7a' }], right: [] }]
        : findHits === null
          ? [note('  Type a name and press Enter to search every workspace')]
          : findHits.length === 0
            ? [note(`  No matches for "${findQuery.trim()}"`)]
            : findHits.map((h, i) => {
                const g = glyph(hitNode(h), tier)
                const tail = hitNote(h)
                return { id: `${FIND}${i}`, left: clean([{ t: ' ' }, { t: g.char + ' ', c: g.color }, { t: clip(h.name, Math.max(4, width - tail.length - 6)), c: g.label }]), right: [{ t: ` ${tail}`, c: '#6e6e7a' }] }
              })
    const specs: RowSpec[] = findSpecs ?? [...pinned.map(rowSpec), ...(pinned.length > 0 ? [note('  ⋮')] : []), ...shown.map(rowSpec)]
    const barSize = Math.max(1, Math.round((specs.length * shown.length) / Math.max(1, rows.length)))
    const bar =
      rows.length > shown.length + pinned.length
        ? { pos: max ? Math.round((from / max) * (specs.length - barSize)) : 0, size: barSize, thumb: '#5b9bd5', track: '#4a4a56' }
        : undefined
    const icon = (nerd: string, fallback: string) => (tier === 'plain' ? fallback : nerd)
    const rootNode = ex.nodes.find(n => n.id === rootOf(ex))
    const headName = rootNode ? rootNode.name : TITLE
    const head: RowSpec = {
      id: '',
      left: clean([
        { t: `${titleGlyph(tier)} `, c: TITLE_COLOR },
        { t: headName, b: true },
        ...(ex.status ? [{ t: `  ${ex.status}`, c: '#6e6e7a' }] : []),
      ]),
      right: [],
    }
    const table = $.ui.resolve(e)
    const Svg = 'Svg' in table ? table.Svg : undefined
    const native = e.surface === 'desktop' && Boolean(Svg)
    const MUTED = '#6e6e7a'
    const icon16 = (source: string | undefined, alt: string, fallback: Seg, key: string) =>
      native && Svg && source ? <Svg key={key} source={source} alt={alt} width={16} height={16} /> : <Text key={key} color={fallback.c}>{fallback.t}</Text>
    const rule = (key: string) => <Text key={key} color="#2e2e34" wrap="truncate-end">{'─'.repeat(width)}</Text>
    const GUIDE = '#34343c'
    const nativeRow = (r: (typeof rows)[number]) => {
      const n = r.node
      const g = glyph(n, 'plain')
      const note = noteOf(r)
      const faded = n.hidden || n.kind === PLACEHOLDER || n.kind === EMPTY
      const room = Math.max(4, width - r.depth * 2 - 8 - note.length)
      const label = clip(shownName(n), room)
      const busy = busyTone(n.id)
      const spinning = n.kind === PLACEHOLDER && n.name === 'loading…'
      return (
        <Box key={`n:${n.id}`} position="relative" height={1} overflow="hidden" flexDirection="row" alignItems="center" backgroundColor={n.id === ex.cursor ? '#2a2d34' : undefined} hover={{ backgroundColor: '#232529' }}>
          {r.depth > 0 && Svg ? (
            <Svg key={`g:${n.id}`} source={guides(r.depth)} alt={`level ${r.depth}`} width={r.depth * 16} height={ROW_PX} />
          ) : (
            Array.from({ length: r.depth }, (_, i) => (
              <Box key={`g:${i}`} width={2} flexShrink={0}>
                <Text color={GUIDE}>│</Text>
              </Box>
            ))
          )}
          <Box width={2} flexShrink={0} flexDirection="row" alignItems="center">
            {r.leaf ? null : icon16(FABRIC_SVG[r.open ? 'ui:chevron-down' : 'ui:chevron-right'], r.open ? 'collapse' : 'expand', { t: r.open ? '⌄' : '›', c: MUTED }, `c:${n.id}`)}
          </Box>
          <Box flexDirection="row" alignItems="center" gap={1} flexShrink={1}>
            {spinning ? null : icon16(FABRIC_SVG[n.kind] ?? (n.kind === 'tenant setting' ? FABRIC_SVG[n.note.startsWith('On') ? 'ui:on' : 'ui:off'] : undefined), typeLabel(n.kind), { t: g.char, c: g.color }, `i:${n.id}`)}
            {spinning ? (
              <Client key={`ph:${n.id}`} module="./rows.tsx" props={{ rows: [{ id: '', left: [{ t: '', spin: true, c: MUTED }, { t: ' Loading…', c: MUTED }], right: [] }], active: '', activeBg: '', hoverBg: '', tones: TONES } satisfies RowsProps} />
            ) : (
              <Text color={faded ? MUTED : undefined} wrap="truncate-end">{faded ? n.name : label}</Text>
            )}
            {busy ? <Text color={TONES[busy]?.bright[1]}>…</Text> : null}
          </Box>
          <Box flexGrow={1} />
          {faded ? null : (
            <Box position="absolute" top={0} left={0} right={0} bottom={0}>
              <Client key={`z:${n.id}`} module="./zone.tsx" props={{ id: n.id } satisfies ZoneProps} width="100%" height="100%" />
            </Box>
          )}
          {splitNote(n, note)[0] ? <Text color={MUTED}>{splitNote(n, note)[0]}</Text> : null}
          {runState(n) ? (
            <Box position="relative" flexDirection="row" alignItems="center" marginLeft={splitNote(n, note)[0] ? 1 : 0} marginRight={splitNote(n, note)[0] ? 0 : 1}>
              {switchable(n) && capBusy.has(n.sig.toLowerCase()) ? (
                <Client key={`cs:${n.id}`} module="./rows.tsx" props={{ rows: [{ id: '', left: [{ t: '', spin: true }], right: [] }], active: '', activeBg: '', hoverBg: '', tones: TONES } satisfies RowsProps} />
              ) : (
                icon16(runState(n) === 'paused' ? FABRIC_SVG['ui:pause'] : runState(n) === 'fixed' ? dimmed(FABRIC_SVG['ui:play']) : FABRIC_SVG['ui:play'], runState(n) === 'fixed' ? 'trial, always running' : switchable(n) ? (runState(n) === 'paused' ? 'paused, click to resume' : 'running, click to pause') : runState(n), { t: '', c: MUTED }, `st:${n.id}`)
              )}
              {switchable(n) ? (
                <Box position="absolute" top={0} left={0} right={0} bottom={0}>
                  <Client key={`z:${CAP}${n.sig}`} module="./zone.tsx" props={{ id: `${CAP}${n.sig}` } satisfies ZoneProps} width="100%" height="100%" />
                </Box>
              ) : null}
            </Box>
          ) : null}
          {splitNote(n, note)[1] ? <Text color={MUTED}>{splitNote(n, note)[1]}</Text> : null}
        </Box>
      )
    }
    const dimmed = (source: string | undefined) => source?.replace(/#[0-9a-fA-F]{6}/g, '#5c5c66')
    const toggle = (key: string, isOn: boolean, svg: string, what: string, nerd: string, plain: string) =>
      native ? (
        <Box key={`tg:${key}`} position="relative" flexDirection="row" alignItems="center" paddingX={1} backgroundColor={isOn ? '#2f3540' : undefined} hover={{ backgroundColor: isOn ? '#38404d' : '#26282d' }}>
          {icon16(isOn ? FABRIC_SVG[svg] : dimmed(FABRIC_SVG[svg]), `${isOn ? 'Hide' : 'Show'} ${what}`, { t: plain, c: MUTED }, `ti:${key}`)}
          <Box position="absolute" top={0} left={0} right={0} bottom={0}>
            <Client key={`z:${TOGGLE}${key}`} module="./zone.tsx" props={{ id: `${TOGGLE}${key}` } satisfies ZoneProps} width="100%" height="100%" />
          </Box>
          <Box position="absolute" top={1} right={0} display="none" hover={{ display: 'flex' }} backgroundColor="#2b2b31" paddingX={1}>
            <Text>{`${isOn ? 'Hide' : 'Show'} ${what}`}</Text>
          </Box>
        </Box>
      ) : (
        <Box key={`tg:${key}`} width={2} flexShrink={0}>
          <Client key={`tg:${key}`} module="./rows.tsx" props={{ rows: [{ id: '', left: [{ t: icon(nerd, plain), c: isOn ? TOGGLE_COLOR[key] : MUTED, tab: `${TOGGLE}${key}` }], right: [] }], active: '', activeBg: '', hoverBg: '', tones: TONES } satisfies RowsProps} />
        </Box>
      )
    const details = ex.detail.slice(1, DETAIL_ROWS).map(l => {
      const at = l.indexOf(': ')
      const key = at > 0 ? l.slice(0, at) : ''
      return { key: key === 'fab path' ? 'Path' : key, value: (at > 0 ? l.slice(at + 2) : l).replace(/\s+/g, ' ') }
    })
    const shownNode = ex.cursor === TENANT ? tenantNode() : (ex.nodes.find(n => n.id === ex.cursor) ?? sel)
    const pathed = shownNode && shownNode.path ? shownNode : undefined
    const azure = shownNode?.kind === 'capacity' ? azureLinks(shownNode.sig) : null
    const headCount = shownNode && GROUP_KINDS.has(shownNode.kind) ? (shownNode.note.match(/\d+ workspaces?$/)?.[0] ?? '') : ''
    const actions = azure
      ? [
          { key: 'cost', svg: 'ui:open', nerd: '\u{f0379}', plain: '↗', label: 'Azure cost', run: () => quiet(openUrl($, azure.cost)) },
          { key: 'azure', svg: 'ui:open', nerd: '\u{f0379}', plain: '↗', label: 'Azure resource', run: () => quiet(openUrl($, azure.resource)) },
        ]
      : pathed
      ? [
          ...(webUrl(ex, pathed) ? [{ key: 'web', svg: 'ui:open', nerd: '\u{f0379}', plain: '↗', label: 'Open in Fabric', run: () => quiet(openWeb($, ex, pathed)) }] : []),
          ...(modelOf(pathed) ? [{ key: 'open', svg: 'ui:open', nerd: '\u{f0379}', plain: '↗', label: 'Open in te', run: () => quiet(openLocal($, ex, pathed)) }] : []),
        ]
      : []
    const toggles = (
      <Box flexDirection="row" alignItems="center" gap={native ? 1 : 2}>
        {ex.target && toggle('find', findMode, 'ui:search', 'Fabric search', '\u{f0349}', '⌕')}
        {ex.target && toggle('domains', ex.byDomain !== false, 'domain', 'domains', '\u{f0ac}', '◇')}
        {ex.target && toggle('capacities', ex.byCapacity === true, 'capacity', 'capacities', '\u{f04c5}', '◔')}
        {rootNode && <Button key="up" plain dimColor label={icon('\u{f005d}', '↑')} onPress={() => quiet(goUp($))} />}
        {rootNode && <Button key="home" plain dimColor label={icon('\u{f02dc}', '⌂')} onPress={() => quiet(goHome($))} />}
        <Button
          key="refresh"
          plain
          dimColor
          label={icon('\u{f0450}', '↻')}
          onPress={() => {
            tenantName = ''
            tenantAsked = false
            quiet($.store.delete('tenant'))
            quiet(refresh($))
          }}
        />
        <Button key="collapse" plain dimColor label={icon('\u{eac5}', '⊟')} onPress={() => quiet(patchView($, () => ({ expanded: [] })))} />
        <Text> </Text>
      </Box>
    )
    nativeScroll = native
    if (native) {
      const body = Math.max(10, e.props.scroll?.bodyRows ?? 30)
      const line = (key: string, child: unknown) => (
        <Box key={key} height={1} overflow="hidden" flexDirection="row" alignItems="center">
          {child as never}
        </Box>
      )
      const at = shownNode ? rows.findIndex(r => r.node.id === shownNode.id) : -1
      const depth = at >= 0 ? rows[at]!.depth + 1 : 1
      const lead = (d: number, key: string) => (Svg ? <Svg key={key} source={guides(d)} alt={`level ${d}`} width={d * 16} height={ROW_PX} /> : <Box key={key} width={d * 2} />)
      const propRow = (key: string, d: number, child: unknown) => (
        <Box key={key} height={1} overflow="hidden" flexDirection="row" alignItems="center" gap={1}>
          {lead(d, `${key}:g`)}
          {child as never}
        </Box>
      )
      const propLines = shownNode && ex.detail.length > 0
        ? [
            <Box key="pr:head" position="relative" height={1} overflow="hidden" flexDirection="row" alignItems="center" gap={1} hover={{ backgroundColor: '#232529' }}>
              {lead(depth, 'pr:head:g')}
              {icon16(FABRIC_SVG[propsOpen ? 'ui:chevron-down' : 'ui:chevron-right'], propsOpen ? 'collapse' : 'expand', { t: propsOpen ? '⌄' : '›', c: MUTED }, 'pr:chev')}
              {icon16(FABRIC_SVG['tenant settings'], 'Properties', { t: '⚙', c: MUTED }, 'pr:icon')}
              <Text color={MUTED}>Properties</Text>
              <Box position="absolute" top={0} left={0} right={0} bottom={0}>
                <Client key={`z:${PROPS}`} module="./zone.tsx" props={{ id: PROPS } satisfies ZoneProps} width="100%" height="100%" />
              </Box>
            </Box>,
            ...(propsOpen
              ? [
                  ...details.map((d, i) =>
                    propRow(
                      `pr:p:${i}`,
                      depth + 1,
                      <Box flexDirection="row" gap={1} flexGrow={1} flexShrink={1}>
                        <Box width={12} flexShrink={0}>
                          <Text color={MUTED}>{d.key}</Text>
                        </Box>
                        <Box flexShrink={1}>
                          <Text wrap="truncate-end">{d.value}</Text>
                        </Box>
                      </Box>,
                    ),
                  ),
                  ...(shownNode.kind === 'tenant setting'
                    ? [
                        propRow(
                          'pr:docs',
                          depth + 1,
                          <Box flexDirection="row" alignItems="center" gap={1}>
                            {icon16(FABRIC_SVG['ui:open'], 'Open docs', { t: '', c: MUTED }, 'ai:docs')}
                            <Button key="docs" plain label="Open docs" onPress={() => quiet(openUrl($, settingDocs(shownNode.sig)))} />
                          </Box>,
                        ),
                      ]
                    : []),
                  ...(pathed || actions.length
                    ? [
                        propRow(
                          'pr:actions',
                          depth + 1,
                          <Box flexDirection="row" alignItems="center" gap={2}>
                            {actions.map(a => (
                              <Box key={`a:${a.key}`} flexDirection="row" alignItems="center" gap={1}>
                                {icon16(FABRIC_SVG[a.svg], a.label, { t: '', c: MUTED }, `ai:${a.key}`)}
                                <Button key={a.key} plain label={a.label} onPress={a.run} />
                              </Box>
                            ))}
                            {pathed ? (
                              <Box key="a:copy" flexDirection="row" alignItems="center" gap={1}>
                                {icon16(FABRIC_SVG['ui:copy'], 'Copy', { t: '', c: MUTED }, 'ai:copy')}
                                <Button key="copy" plain label="Copy path" onPress={p => quiet(copyOf($, pathed.path, p.surface))} />
                              </Box>
                            ) : null}
                          </Box>,
                        ),
                      ]
                    : []),
                ]
              : []),
          ]
        : []
      const headRows = 4 + (pending ? 1 : 0) + (!ex.setup && ex.nodes.length === 0 ? 1 : 0)
      const findRow = (h: Hit, i: number) => (
        <Box key={`fh:${h.id}`} position="relative" height={1} overflow="hidden" flexDirection="row" alignItems="center" gap={1} hover={{ backgroundColor: '#232529' }}>
          {icon16(FABRIC_SVG[h.type], typeLabel(h.type), { t: glyph(hitNode(h), tier).char, c: glyph(hitNode(h), tier).color }, `fi:${h.id}`)}
          <Text wrap="truncate-end">{h.name}</Text>
          <Box flexGrow={1} />
          <Text color={MUTED} wrap="truncate-end">{hitNote(h)}</Text>
          <Box position="absolute" top={0} left={0} right={0} bottom={0}>
            <Client key={`z:${FIND}${i}`} module="./zone.tsx" props={{ id: `${FIND}${i}` } satisfies ZoneProps} width="100%" height="100%" />
          </Box>
        </Box>
      )
      const findLines = !findMode
        ? null
        : finding
          ? [
              <Box key="fh:busy" height={1}>
                <Client key="fh:spin" module="./rows.tsx" props={{ rows: [{ id: '', left: [{ t: '', spin: true }, { t: ` Searching Fabric for "${findQuery.trim()}"`, c: MUTED }], right: [] }], active: '', activeBg: '', hoverBg: '', tones: TONES } satisfies RowsProps} />
              </Box>,
            ]
          : findHits === null
            ? [<Text key="fh:hint" color={MUTED}>Type a name and press Enter to search every workspace</Text>]
            : findHits.length === 0
              ? [<Text key="fh:none" color={MUTED}>{`No matches for "${findQuery.trim()}"`}</Text>]
              : findHits.map(findRow)
      const lines = findLines ?? (at >= 0 ? rows.flatMap((r, i) => (i === at ? [nativeRow(r), ...propLines] : [nativeRow(r)])) : rows.map(nativeRow))
      const offset = e.props.scroll?.offset ?? 0
      const first = Math.max(0, offset - headRows - body)
      const last = Math.min(lines.length, offset - headRows + body * 2)
      return (
        <Box flexDirection="column">
          <Box key="desk-body" height={1} flexDirection="row" alignItems="center">
            <Box flexGrow={1} flexShrink={1} flexDirection="row" alignItems="center" gap={1}>
              {icon16(FABRIC_SVG.fabric, 'Microsoft Fabric', { t: titleGlyph(tier), c: TITLE_COLOR }, 'logo')}
              <Text bold wrap="truncate-end">{headName}</Text>
              {ex.status ? <Text color={MUTED} wrap="truncate-end">{ex.status}</Text> : null}
            </Box>
            {toggles}
          </Box>
          <Box height={3} flexDirection="row" alignItems="center" gap={1} overflow="hidden">
            <Box flexGrow={1} flexShrink={1} width="100%">
              <Input
                key="q"
                placeholder={findMode ? 'Search all of Fabric, Enter to search' : 'Filter, or Enter to jump'}
                value={findMode ? findQuery : ex.query}
                onInput={(v: string) => (findMode ? setFindQuery($, v) : quiet(patchView($, () => ({ query: v }))))}
                onSubmit={(v: string) => quiet(findMode ? runFind($, v) : patch($, cur => jumpTo(cur, v)))}
              />
            </Box>
            {ex.query ? <Button key="clearq" plain dimColor label="×" onPress={() => quiet(patchView($, () => ({ query: '' })))} /> : null}
          </Box>
          {pending ? (
            <Box height={1}>
              <Client key="pending" module="./rows.tsx" props={{ rows: [{ id: '', left: [{ t: '', spin: true }, { t: ' ' + pending, c: MUTED }], right: [] }], active: '', activeBg: '', hoverBg: '', tones: TONES } satisfies RowsProps} />
            </Box>
          ) : null}
          {!ex.setup && ex.nodes.length === 0 ? (
            <Box height={1}>
              <Text color={MUTED}>{ex.target ? 'nothing loaded yet' : HINT}</Text>
            </Box>
          ) : null}
          {ex.setup ? (
            <Box key="setup" flexDirection="column">
              {setupRows(ex.setup, 'plain', width).map((r, i) => (
                <Box key={`su:${i}`} height={1} overflow="hidden" flexDirection="row" alignItems="center">
                  {r.left.map((sg, j) => {
                    const tab = sg.tab ?? (r.id.startsWith(COPY) && sg.t.trim() ? r.id : '')
                    return tab ? (
                      <Button key={`sb:${j}`} plain label={sg.t} onPress={p => (tab === REFRESH ? quiet(refresh($)) : quiet(copyOf($, tab.slice(COPY.length), p.surface)))} />
                    ) : (
                      <Text key={`st:${j}`} color={sg.c} bold={sg.b}>{sg.t}</Text>
                    )
                  })}
                </Box>
              ))}
            </Box>
          ) : (
            <Box key="tree" flexDirection="column">
              {first > 0 ? <Box key="above" height={first} /> : null}
              {lines.slice(first, Math.max(first, last))}
              {last < lines.length ? <Box key="below" height={lines.length - Math.max(first, last)} /> : null}
            </Box>
          )}
        </Box>
      )
    }
    return (
      <Box flexDirection="column" minHeight={Math.max(1, e.props.scroll?.bodyRows ?? 1)}>
        <Box flexDirection="row" alignItems="center">
          <Box flexGrow={1} flexShrink={1}>
            {native ? (
              <Box flexDirection="row" alignItems="center" gap={1}>
                {icon16(FABRIC_SVG.fabric, 'Microsoft Fabric', { t: titleGlyph(tier), c: TITLE_COLOR }, 'logo')}
                <Text bold wrap="truncate-end">{headName}</Text>
                {ex.status ? <Text color={MUTED}>{ex.status}</Text> : null}
              </Box>
            ) : (
              <Client key="head" module="./rows.tsx" props={{ rows: [head], active: '', activeBg: '', hoverBg: '', tones: TONES } satisfies RowsProps} />
            )}
          </Box>
          {native ? toggles : null}
        </Box>
        <Box flexDirection="row" alignItems="center" marginTop={1} marginBottom={1} gap={1}>
          <Box flexGrow={1} flexShrink={1} width="100%">
            {work && !ex.query ? (
              <Client key="working" module="./rows.tsx" props={{ rows: [{ id: '', left: [{ t: '', spin: true }, { t: ' ' }, { t: tier === 'plain' ? '*' : '\u{ec82}', claude: true }, { t: ' Claude is working in Fabric...', sh: 'orange' }], right: [] }], active: '', activeBg: '', hoverBg: '', tones: TONES } satisfies RowsProps} />
            ) : (
              <Input
                key="q"
                placeholder={findMode ? 'Search all of Fabric, Enter to search' : 'Filter, or Enter to jump'}
                autoFocus
                value={findMode ? findQuery : ex.query}
                onInput={(v: string) => (findMode ? setFindQuery($, v) : quiet(patchView($, () => ({ query: v }))))}
                onSubmit={(v: string) => quiet(findMode ? runFind($, v) : patch($, cur => jumpTo(cur, v)))}
              />
            )}
          </Box>
          {ex.query ? <Button key="clearq" plain dimColor label={tier === 'plain' ? '×' : '\u{f0156}'} onPress={() => quiet(patchView($, () => ({ query: '' })))} /> : null}
          {native ? null : toggles}
        </Box>
        {pending ? (
          <Client key="pending" module="./rows.tsx" props={{ rows: [{ id: '', left: [{ t: '', spin: true }, { t: ' ' + pending, c: MUTED }], right: [] }], active: '', activeBg: '', hoverBg: '', tones: TONES } satisfies RowsProps} />
        ) : null}
        {!ex.setup && ex.nodes.length === 0 && <Text color={MUTED}>{ex.target ? 'nothing loaded yet' : HINT}</Text>}
        {ex.setup ? (
          <Client key="setup" module="./rows.tsx" props={{ rows: setupRows(ex.setup, tier, width), active: '', activeBg: '', hoverBg: '#2d2f33', tones: TONES } satisfies RowsProps} />
        ) : native ? (
          <Box key="rows" flexDirection="column">
            {pinned.map(nativeRow)}
            {pinned.length > 0 && <Text color={MUTED}>  ⋮</Text>}
            {shown.map(nativeRow)}
          </Box>
        ) : (
          <Client key="rows" module="./rows.tsx" props={{ rows: specs, active: ex.cursor, activeBg: '#3e4451', hoverBg: '#2d2f33', tones: TONES, ...(bar ? { bar } : {}) } satisfies RowsProps} />
        )}
        <Box flexGrow={1} />
        {shownNode && ex.detail.length > 0 && (
          <Box key="details" flexDirection="column">
            {rule('rule-top')}
            <Box flexDirection="row" alignItems="center" gap={1} marginBottom={1}>
              {icon16(FABRIC_SVG[shownNode.kind], typeLabel(shownNode.kind), { t: glyph(shownNode, tier).char, c: glyph(shownNode, tier).color }, 'sel')}
              <Text bold wrap="truncate-end">{shownNode.name}</Text>
              <Box flexGrow={1} />
              {headCount ? <Text color={MUTED}>{headCount}</Text> : null}
              {sel && <Button key="clear" plain dimColor label={icon('\u{f0156}', '✕')} onPress={() => quiet(patchView($, () => ({ selected: '', detail: [] })))} />}
            </Box>
            {details.map((d, i) => (
              <Box key={`p:${i}`} flexDirection="row" gap={1}>
                <Box width={12} flexShrink={0}>
                  <Text color={MUTED}>{d.key}</Text>
                </Box>
                <Box flexShrink={1}>
                  <Text wrap="truncate-end">{d.value}</Text>
                </Box>
              </Box>
            ))}
            {(pathed || actions.length > 0 || shownNode.kind === 'tenant setting') && rule('rule-actions')}
            {shownNode.kind === 'tenant setting' && (
              <Box flexDirection="row" alignItems="center" gap={1}>
                {native ? icon16(FABRIC_SVG['ui:open'], 'Open docs', { t: '', c: MUTED }, 'ai:docs') : null}
                <Button key="docs" plain label={native ? 'Open docs' : `${icon('\u{f0379}', '↗')} Open docs`} onPress={() => quiet(openUrl($, settingDocs(shownNode.sig)))} />
              </Box>
            )}
            {(pathed || actions.length > 0) && (
            <Box flexDirection="row" alignItems="center" gap={2}>
              {actions.map(a => (
                <Box key={`a:${a.key}`} flexDirection="row" alignItems="center" gap={1}>
                  {native ? icon16(FABRIC_SVG[a.svg], a.label, { t: '', c: MUTED }, `ai:${a.key}`) : null}
                  <Button key={a.key} plain label={native ? a.label : `${icon(a.nerd, a.plain)} ${a.label}`} onPress={a.run} />
                </Box>
              ))}
              {pathed ? (
                <Box key="a:copy" flexDirection="row" alignItems="center" gap={1}>
                  {native ? icon16(FABRIC_SVG['ui:copy'], 'Copy', { t: '', c: MUTED }, 'ai:copy') : null}
                  <Button key="copy" plain label={native ? 'Copy path' : `${icon('\u{f018f}', '⧉')} Copy path`} onPress={p => quiet(copyOf($, pathed.path, p.surface))} />
                </Box>
              ) : null}
            </Box>
            )}
          </Box>
        )}
      </Box>
    )
  })
}
