import type { EngineInterface, Register, Timer } from 'claude-code'
import { openCommand } from './open'

import type { Explorer, Onboard, Target, TreeNode, Work } from '../types'
import { glyph, titleGlyph as dbTitle, type Tier } from './icons'
import type { RowSpec, RowsProps, Seg } from './rows'
import { ancestors, EMPTY, empty, emptyMark, isLoaded, merge, visible } from './tree'
import { chainOf, children, hostFrom, listCalls, PLACEHOLDER, roots } from './databricks'
import { DB_TONE, dbKind, dbProfile, dbTargets, type Invocation, invocations, positionals, posix, tokenize, useDrives } from './parse'

const STATE = { plugin: 'databricks-cli', key: 'explorer' } as const
const NODES = { plugin: 'databricks-cli', key: 'nodes' } as const
const PANE = 'databricks-pane'
const TITLE = 'Databricks'
const TITLE_COLOR = '#ff3621'
const HINT = 'waiting for a databricks command, or /databricks-pane'
const SORT = false
const WINDOW = 400
const DETAIL_ROWS = 12
const HEADER = '#header'
const MEMBER_VERBS = /^(create|delete|import|import-dir|mkdirs|rm|mv|rename|restore|deploy|destroy)/
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
const PLAIN_SPINNER = ['|', '/', '-', '\\']
const TONE_RANK = ['orange', 'pink', 'teal', 'purple']
const ACCENT = '#5b9bd5'
const LOGIN = 'databricks auth login --host <your workspace URL>'
const UNREACHABLE =
  /dial tcp|no such host|connection refused|connection reset|network is unreachable|no route to host|i\/o timeout|tls handshake timeout|context deadline exceeded|client\.timeout|proxyconnect|proxy error|timed? ?out|temporary failure in name resolution|could not resolve host|getaddrinfo|econnrefused|econnreset|etimedout|enotfound/i
const SIGNED_OUT =
  /(?:status|code|http)\W{0,3}401\b|\b401 unauthorized|\bunauthorized\b|unauthenticated|not authenticated|not logged in|no credentials|cannot configure default credentials|cannot get access token|(?:invalid|expired) (?:access |refresh |oauth )?token|token (?:is |has )?(?:invalid|expired|not set)|credential was not sent|has no \S+ profile configured|no configuration file found|no profiles configured|cannot load databricks config|databricks auth login/i
const FONT_SCRIPT =
  'if command -v fc-list >/dev/null 2>&1; then f=$(fc-list ":charset=$1" file | head -n1 | cut -d: -f1); ' +
  'else f=$(ls "$HOME"/Library/Fonts/*"$2"* /Library/Fonts/*"$2"* 2>/dev/null | head -n1); fi; ' +
  '[ -n "$f" ] || { echo missing; exit 0; }; m=$(stat -c %Z "$f" 2>/dev/null || stat -f %c "$f"); p=$PPID; ' +
  'while [ -n "$p" ] && [ "$p" -gt 1 ]; do c=$(ps -o comm= -p "$p" 2>/dev/null); c=$(basename "$c" 2>/dev/null | tr -d " "); case "$c" in ' +
  'ghostty|kitty|alacritty|Alacritty|foot|footclient|wezterm-gui|konsole|gnome-terminal-|xterm|urxvt|st|Terminal|iTerm2) ' +
  'e=$(ps -o etime= -p "$p" 2>/dev/null | awk -F\'[-:]\' \'{n=NF; s=$n+60*$(n-1); if (n>2) s+=3600*$(n-2); if (n>3) s+=86400*$(n-3); print s}\'); [ -n "$e" ] && [ $(( $(date +%s) - e )) -lt "$m" ] && echo stale || echo ok; exit 0;; esac; ' +
  'p=$(ps -o ppid= -p "$p" 2>/dev/null | tr -d " "); done; echo ok'

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
let closed = false
let noDock = false
let inflight: Promise<void> | null = null
let queued: Promise<void> | null = null
let platform: Promise<'linux' | 'darwin' | 'win32'> | null = null
const hosts = new Map<string, string>()

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

const slots = { busy: 0, queue: [] as (() => void)[] }

async function limited<T>(fn: () => Promise<T>): Promise<T> {
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

async function fontState($: EngineInterface, charset: string, name: string): Promise<'ok' | 'stale' | 'missing'> {
  try {
    const out = (await $.process.run(['sh', '-c', FONT_SCRIPT, 'sh', charset, name], { timeoutMs: 5_000 })).stdout.trim()
    return out === 'stale' || out === 'missing' ? out : 'ok'
  } catch {
    return 'missing'
  }
}

function quiet(p: Promise<unknown>): void {
  void p.catch(() => undefined)
}

async function detectGlyphs($: EngineInterface): Promise<void> {
  if ((await $.env.get('SSH_CONNECTION')) || (await $.env.get('SSH_TTY'))) {
    detected = 'nerd'
    return
  }
  const nerd = (await fontState($, 'f04eb', 'Nerd')) === 'ok'
  detected = nerd && (await fontState($, 'f3000', 'DatabricksSymbols')) === 'ok' ? 'databricks' : nerd ? 'nerd' : 'plain'
}

function fontNote(): string {
  if (!fontHint || hinted || !fellBack) return ''
  hinted = true
  return 'Tell user once: Databricks pane icons need github.com/data-goblin/databricks-nf plus a Nerd Font. Plugin option fontHint=off disables this.'
}

function tierFor(surface: string): Tier {
  if (glyphSetting === 'databricks' || glyphSetting === 'nerd' || glyphSetting === 'plain') return glyphSetting
  return surface === 'desktop' ? 'plain' : detected
}

function titleGlyph(tier: Tier): string {
  return dbTitle(tier)
}

function label(target: Target | null): string {
  return target?.profile ? `${TITLE} · ${target.profile}` : TITLE
}
function titleFor(target: Target | null): string {
  return `${titleGlyph(tierFor('terminal'))} ${label(target)}`
}
async function get($: EngineInterface): Promise<Explorer> {
  const [view, tree] = await Promise.all([$.state.get(STATE), $.state.get(NODES)])
  return { ...empty(), ...view.value, nodes: tree.value ?? [] }
}

async function put($: EngineInterface, fn: (ex: Explorer) => Explorer): Promise<void> {
  for (let i = 0; ; i++) {
    if (i >= 50) throw new Error('pane state is busy; try again')
    const [view, tree] = await Promise.all([$.state.get(STATE), $.state.get(NODES)])
    const cur: Explorer = { ...empty(), ...view.value, nodes: tree.value ?? [] }
    const next = anchored(cur, fn(cur))
    if (next.nodes !== cur.nodes) {
      const done = await $.state.set(NODES, next.nodes, { ifVersion: tree.version })
      if (!done.isSet) continue
    }
    const keys = Object.keys(next) as (keyof Explorer)[]
    if (!keys.some(k => k !== 'nodes' && next[k] !== cur[k])) return
    const { nodes: _nodes, ...rest } = next
    const done = await $.state.set(STATE, { ...rest, nodes: [] }, { ifVersion: view.version })
    if (done.isSet) return
  }
}

function patch($: EngineInterface, fn: (ex: Explorer) => Partial<Explorer>) {
  return put($, ex => ({ ...ex, ...fn(ex) }))
}

async function patchView($: EngineInterface, fn: (ex: Explorer) => Partial<Explorer>): Promise<void> {
  for (let i = 0; ; i++) {
    if (i >= 50) throw new Error('pane state is busy; try again')
    const view = await $.state.get(STATE)
    const cur: Explorer = { ...empty(), ...view.value, nodes: [] }
    const change = fn(cur)
    if (Object.keys(change).length === 0) return
    const done = await $.state.set(STATE, { ...cur, ...change, nodes: [] }, { ifVersion: view.version })
    if (done.isSet) return
  }
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

function live(work: Work | null, now: number): work is Work {
  if (!work) return false
  return work.until === null ? now - work.since < BUSY_MAX_MS : now < work.until
}

async function startWork($: EngineInterface, ids: string[], tone: string): Promise<number> {
  const mine = ++generation
  blink?.cancel()
  blink = null
  const at = await $.clock.now()
  await patchView($, cur => {
    const prior = live(cur.work, at) ? cur.work : null
    const lit = [...new Set([...(prior?.lit ?? []), ...ids])]
    return { work: { tone, lit, dim: (prior?.dim ?? []).filter(id => !lit.includes(id)), since: at, until: null } }
  })
  return mine
}

async function finishWork($: EngineInterface, mine: number, tone: string, ids: string[] = [], alsoLit: string[] = []): Promise<void> {
  const unique = [...new Set(ids)]
  const own = () => generation === mine
  const ex = await get($)
  const at = await $.clock.now()
  await patch($, cur => {
    const byId = new Map(cur.nodes.map(n => [n.id, n]))
    const open = new Set(cur.expanded)
    const dim = new Set(alsoLit)
    for (const id of unique) {
      const chain = ancestors(cur.nodes, id, byId)
      if (!chain.some(a => !open.has(a))) continue
      for (const a of chain) {
        if (!open.has(a)) dim.add(a)
        open.add(a)
      }
    }
    for (const id of unique) dim.delete(id)
    const prior = live(cur.work, at) ? cur.work : null
    const work: Work | null = own()
      ? unique.length
        ? { tone, lit: unique, dim: [...dim], since: prior?.since ?? at, until: at + FLASH_MS }
        : null
      : prior && unique.length
        ? { ...prior, lit: [...new Set([...prior.lit, ...unique])], dim: [...new Set([...prior.dim, ...dim])].filter(id => !unique.includes(id) && !prior.lit.includes(id)) }
        : cur.work
    if (unique.length === 0) return { work }
    const root = rootOf(cur)
    const away = follow && root !== '' && unique.some(id => id !== root && !ancestors(cur.nodes, id, byId).includes(root))
    return { work, expanded: [...open], ...(follow ? { scroll: null } : {}), ...(away ? { root: '' } : {}) }
  })
  if (!own() || unique.length === 0) return
  blink = $.clock.after(FLASH_MS, () => {
    if (!own()) return
    blink = null
    quiet(patchView($, () => (own() ? { work: null } : {})))
  })
  if (ex.target && !closed) await openPane($, { id: PANE, title: titleFor(ex.target) })
}

type Mark = { ids: string[]; tone: string }

function rootOf(ex: Explorer): string {
  return ex.root && ex.nodes.some(n => n.id === ex.root) ? ex.root : ''
}

function anchored(cur: Explorer, next: Explorer): Explorer {
  if (follow || cur.scroll === null || next.scroll !== cur.scroll || (next.nodes === cur.nodes && next.expanded === cur.expanded)) return next
  const top = visible(cur, SORT, rootOf(cur))[cur.scroll]?.node.id
  const at = top ? visible(next, SORT, rootOf(next)).findIndex(row => row.node.id === top) : -1
  return at < 0 || at === cur.scroll ? next : { ...next, scroll: at }
}


async function markBusy($: EngineInterface, marks: Mark[]): Promise<void> {
  if (marks.every(m => m.ids.length === 0)) return
  const at = await $.clock.now()
  await patchView($, cur => {
    const map = { ...cur.busy }
    for (const { ids, tone } of marks) for (const id of ids) map[id] = { tone, n: (map[id]?.n ?? 0) + 1, at }
    return { busy: map }
  })
}

async function clearBusy($: EngineInterface, marks: Mark[]): Promise<void> {
  if (marks.every(m => m.ids.length === 0)) return
  await patchView($, cur => {
    const map = { ...cur.busy }
    for (const { ids } of marks) {
      for (const id of ids) {
        const left = (map[id]?.n ?? 1) - 1
        const entry = map[id]
        if (left > 0 && entry) map[id] = { ...entry, n: left }
        else delete map[id]
      }
    }
    return { busy: map }
  })
}

async function point($: EngineInterface, target: Target | null, opened: 'asked' | 'unasked', fresh = false): Promise<boolean> {
  const moved = !sameTarget((await get($)).target, target)
  activeProfile = target?.profile ?? ''
  if (moved) {
    treeGen++
    hosts.clear()
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

async function navigate($: EngineInterface, n: TreeNode): Promise<void> {
  await patch($, cur => ({ root: n.id, cursor: n.id, scroll: null, expanded: [...new Set([...cur.expanded, n.id, ...ancestors(cur.nodes, n.id)])] }))
  if (await expandNode($, n)) await expandOpen($, n.id)
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
  const now = await $.clock.now()
  const isDouble = lastPress.key === n.id && now - lastPress.at < DOUBLE_MS
  lastPress = { key: isDouble ? '' : n.id, at: now }
  const ex = await get($)
  if (isDouble && ex.nodes.some(c => c.parent === n.id)) await navigate($, n)
  else if (isDouble) await openLocal($, ex, n)
  else await select($, n)
}

async function openWeb($: EngineInterface, ex: Explorer, n: TreeNode): Promise<void> {
  const url = webUrl(ex, n)
  if (url) await openUrl($, url)
  else $.ui.toast('no Databricks link: set host in ~/.databrickscfg or DATABRICKS_HOST')
}

async function hostOf($: EngineInterface, profile: string): Promise<string> {
  const known = hosts.get(profile)
  if (known !== undefined) return known
  let host = profile ? '' : ((await $.env.get('DATABRICKS_HOST')) ?? '').trim().replace(/\/+$/, '')
  const home = (await $.env.get('HOME')) || (await $.env.get('USERPROFILE')) || ''
  const file = (await $.env.get('DATABRICKS_CONFIG_FILE')) || `${posix(home).replace(/\/+$/, '')}/.databrickscfg`
  if (!host) {
    try {
      host = hostFrom(String(await $.fs.read(posix(file))), profile)
    } catch {
      host = ''
    }
  }
  if (host && !/^https?:\/\//.test(host)) host = `https://${host}`
  hosts.set(profile, host)
  return host
}
type Trouble = Onboard['kind'] | ''

class CliError extends Error {
  constructor(
    message: string,
    readonly trouble: Trouble,
  ) {
    super(message)
  }
}

function troubleOf(text: string): Trouble {
  return UNREACHABLE.test(text) ? 'unreachable' : SIGNED_OUT.test(text) ? 'signedOut' : ''
}

async function dbRun($: EngineInterface, tail: string[], profile: string): Promise<string> {
  const argv = ['databricks', ...tail, '-o', 'json', ...(profile ? ['-p', profile] : [])]
  let run: Awaited<ReturnType<EngineInterface['process']['run']>>
  try {
    run = await limited(() => $.process.run(argv, { timeoutMs: 60_000 }))
  } catch (err) {
    const text = (err instanceof Error ? err.message : String(err)).trim()
    throw new CliError(text.split('\n')[0] || 'databricks did not start', /timed? ?out/i.test(text) ? 'unreachable' : 'missing')
  }
  if (run.exitCode !== 0) {
    const text = (run.stderr || run.stdout).trim()
    throw new CliError(text.split('\n')[0] || `databricks ${tail.join(' ')} failed`, run.exitCode === 127 ? 'missing' : troubleOf(text))
  }
  if (run.isStdoutTruncated) throw new Error(`databricks ${tail.slice(0, 2).join(' ')}: too much output to show`)
  return run.stdout
}

async function implicitProfile($: EngineInterface): Promise<string> {
  return ((await $.env.get('DATABRICKS_CONFIG_PROFILE')) ?? '').trim()
}

const loading = new Map<string, Promise<boolean>>()
let treeGen = 0
let statusOwner = ''
let activeProfile = ''

function errorText(err: unknown): string {
  return `error: ${err instanceof Error ? err.message : String(err)}`
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
      if (!(await expandNode($, n))) failed.add(n.id)
    })
  }
}
function onboardOf(err: unknown): Onboard | null {
  return err instanceof CliError && err.trouble ? { kind: err.trouble, line: err.message } : null
}

function failed(cur: Explorer, target: Target | null, err: unknown): Partial<Explorer> {
  if (!sameTarget(cur.target, target)) return {}
  const onboard = onboardOf(err)
  return onboard ? { onboard } : { status: errorText(err) }
}

async function probe($: EngineInterface, profile: string): Promise<Onboard | null> {
  try {
    await dbRun($, ['current-user', 'me'], profile)
    return null
  } catch (err) {
    return onboardOf(err)
  }
}

async function doRefresh($: EngineInterface): Promise<void> {
  const target = (await get($)).target
  if (!target) return
  await patchView($, () => ({ status: 'loading' }))
  treeGen++
  hosts.clear()
  const onboard = await probe($, target.profile)
  if (onboard) {
    await patchView($, cur => (sameTarget(cur.target, target) ? { onboard, status: '' } : {}))
    return
  }
  try {
    await patch($, cur => (sameTarget(cur.target, target) ? { nodes: roots(), expanded: cur.nodes.length ? cur.expanded : [], status: '', onboard: null } : {}))
    await expandOpen($)
  } catch (err) {
    await patch($, cur => failed(cur, target, err))
  }
}
async function listChildren($: EngineInterface, n: TreeNode, profile: string): Promise<TreeNode[]> {
  const outputs = await Promise.all(listCalls(n).map(tail => dbRun($, tail, profile)))
  return children(n, outputs, await hostOf($, profile || (await implicitProfile($))))
}

const rerun = new Map<string, Promise<boolean>>()

function reloadNode($: EngineInterface, id: string): Promise<boolean> {
  const key = `${activeProfile}|reload:${id}`
  const running = loading.get(key)
  if (running) {
    const next =
      rerun.get(key) ??
      running.then(
        () => {
          rerun.delete(key)
          return reloadNode($, id)
        },
        () => {
          rerun.delete(key)
          return reloadNode($, id)
        },
      )
    rerun.set(key, next)
    return next
  }
  const job = (async () => {
    const pending = loading.get(`${activeProfile}|${id}`)
    if (pending) await pending.catch(() => false)
    const ex = await get($)
    const target = ex.target
    const n = ex.nodes.find(x => x.id === id)
    if (!n || !isLoaded(ex.nodes, n.id)) return true
    const gen = treeGen
    try {
      const kids = await listChildren($, n, target?.profile ?? '')
      const owned = statusOwner === n.id
      if (owned) statusOwner = ''
      await patch($, cur => (gen === treeGen && sameTarget(cur.target, target) && cur.nodes.some(x => x.id === n.id) ? { nodes: merge(cur.nodes, n.id, kids), ...(owned ? { status: '' } : {}), ...(cur.onboard ? { onboard: null } : {}) } : {}))
    } catch (err) {
      statusOwner = n.id
      await patchView($, cur => failed(cur, target, err))
      return false
    }
    await expandOpen($, n.id)
    return true
  })().finally(() => loading.delete(key))
  loading.set(key, job)
  return job
}

function expandNode($: EngineInterface, n: TreeNode): Promise<boolean> {
  const key = `${activeProfile}|${n.id}`
  const running = loading.get(key)
  if (running) return running
  const job = (async () => {
    const ex = await get($)
    const target = ex.target
    if (!ex.nodes.some(c => c.parent === n.id && c.kind === PLACEHOLDER)) return true
    const gen = treeGen
    try {
      const kids = await listChildren($, n, target?.profile ?? '')
      const owned = statusOwner === n.id
      if (owned) statusOwner = ''
      await patch($, cur => {
        if (gen !== treeGen || !sameTarget(cur.target, target)) return {}
        const ok = { ...(owned ? { status: '' } : {}), ...(cur.onboard ? { onboard: null } : {}) }
        if (!cur.nodes.some(x => x.parent === n.id && x.kind === PLACEHOLDER)) return ok
        return { nodes: cur.nodes.flatMap(x => (x.parent === n.id && x.kind === PLACEHOLDER ? (kids.length ? kids : [emptyMark(n.id)]) : [x])), ...ok }
      })
      return true
    } catch (err) {
      statusOwner = n.id
      await patchView($, cur => failed(cur, target, err))
      return false
    }
  })().finally(() => loading.delete(key))
  loading.set(key, job)
  return job
}

async function reveal($: EngineInterface, chain: string[]): Promise<void> {
  for (const id of chain) {
    const n = (await get($)).nodes.find(x => x.id === id)
    if (!n) return
    await patch($, cur => ({ expanded: [...new Set([...cur.expanded, n.id])] }))
    await expandNode($, n)
  }
}
function webUrl(_ex: Explorer, n: TreeNode): string {
  return n.url || ''
}

async function openLocal($: EngineInterface, ex: Explorer, n: TreeNode): Promise<void> {
  if (webUrl(ex, n)) await openUrl($, webUrl(ex, n))
}
async function select($: EngineInterface, n: TreeNode): Promise<void> {
  if (n.kind === PLACEHOLDER || n.kind === EMPTY) return
  const ex = await get($)
  const isLeaf = !ex.nodes.some(c => c.parent === n.id)
  await patch($, cur => {
    const open = new Set(cur.expanded)
    if (!isLeaf) open.has(n.id) ? open.delete(n.id) : open.add(n.id)
    return { expanded: [...open], cursor: n.id, selected: n.path ? n.id : cur.selected }
  })
  if (!isLeaf && (await expandNode($, n))) await expandOpen($, n.id)
  const detail = [`${n.kind.replace(/^section-/, '').replace(/_/g, ' ')} ${n.name}`, ...(n.path ? [`cli: ${n.path}`] : []), ...(n.note ? [n.note] : [])]
  await patchView($, cur => (cur.cursor === n.id ? { detail } : {}))
}
function contextFor(ex: Explorer, n: TreeNode): string {
  return [
    'The user has this Databricks object selected in the Databricks pane; "this", "it" or "the selected" in the prompt likely refers to it.',
    `${n.kind.replace(/_/g, ' ')}: ${n.name}`,
    ...(n.path ? [`databricks CLI argument: ${n.path}`] : []),
    ...(ex.target?.profile ? [`profile: ${ex.target.profile}`] : []),
    ...(n.url ? [`url: ${n.url}`] : []),
  ].join('\n')
}
const STATUS_GROUPS = new Set(['clusters', 'warehouses', 'apps', 'pipelines'])
const waiting = new Map<string, () => Promise<void>>()

function backgroundOf(result: unknown): string {
  if (!result || typeof result !== 'object') return ''
  const id = (result as { backgroundTaskId?: unknown }).backgroundTaskId
  return typeof id === 'string' ? id : ''
}

type Call = { inv: Invocation; kind: NonNullable<ReturnType<typeof dbKind>> }

type Lit = { touched: string[]; opened: string[] }

async function afterDb($: EngineInterface, calls: Call[], stale: Set<string>, succeeded: boolean): Promise<Lit> {
  const none: Lit = { touched: [], opened: [] }
  const fallback = await implicitProfile($)
  const canon = (p: string) => p || fallback || 'DEFAULT'
  const resolved = (inv: Invocation) => dbProfile(inv) || inv.env.DATABRICKS_CONFIG_PROFILE || ''
  const own = calls.filter(c => !c.inv.env.DATABRICKS_HOST && !c.inv.env.DATABRICKS_TOKEN)
  const first = own[0]
  if (!first) return none
  const current = (await get($)).target
  const want = resolved(first.inv)
  const profile = current && canon(current.profile) === canon(want) ? current.profile : want
  const moved = await point($, { kind: 'databricks', profile }, 'unasked')
  const shown = await get($)
  if (moved || shown.nodes.length === 0 || shown.onboard) await refresh($)
  if ((await get($)).onboard) return none
  const mine = own.filter(c => canon(resolved(c.inv)) === canon(profile))
  const prior = await get($)
  const before = new Set(prior.expanded)
  const targets = [...new Set(mine.flatMap(c => dbTargets(c.inv)))]
  await pool(targets, id => reveal($, chainOf(id)))
  const reloads = new Set<string>()
  for (const c of mine) {
    if (c.kind !== 'modify' && c.kind !== 'upload') continue
    if (!changesMembers(c.inv.args) && !STATUS_GROUPS.has(positionals(c.inv.args)[0] ?? '')) continue
    for (const id of dbTargets(c.inv)) {
      const chain = chainOf(id)
      const parent = chain[chain.length - 1]
      if (parent) reloads.add(parent)
      if (id.startsWith('S:')) reloads.add(id)
    }
  }
  await pool([...reloads].filter(id => isLoaded(prior.nodes, id) || stale.has(`${activeProfile}|${id}`)), id => reloadNode($, id))
  const fresh = await get($)
  const present = new Set(fresh.nodes.map(n => n.id))
  if (!succeeded) return none
  const touched = mine.flatMap(c => dbTargets(c.inv)).filter(id => present.has(id))
  return { touched, opened: touched.flatMap(id => chainOf(id)).filter(id => !before.has(id) && present.has(id)) }
}

function toneOf(calls: Call[]): string {
  const tones = new Set(calls.map(c => DB_TONE[c.kind]))
  return TONE_RANK.find(t => tones.has(t)) ?? 'orange'
}

type Line = { icon: [string, string]; title: string } | { text: string; dim?: true } | { label: string; cmd: string }

function onboardBlocks(o: Onboard): Line[][] {
  const signIn: [string, string] = ['\u{f0342}', '→']
  if (o.kind === 'missing') {
    return [
      [{ icon: ['\u{f05d6}', '⚠'], title: 'Databricks CLI not found' }, { text: 'This pane needs the Databricks CLI (databricks).' }],
      [
        { icon: ['\u{f01da}', '↓'], title: 'Install it' },
        { label: 'macOS or Linux: ', cmd: 'brew tap databricks/tap && brew install databricks' },
        { label: 'Windows: ', cmd: 'winget install Databricks.DatabricksCLI' },
      ],
      [{ icon: signIn, title: 'Then sign in to your workspace' }, { label: '', cmd: LOGIN }],
      [{ text: "Press ↻ when you're done. Or ask Claude to set it up for you.", dim: true }],
    ]
  }
  if (o.kind === 'signedOut') {
    return [
      [{ icon: ['\u{f0306}', '⚿'], title: 'Not signed in to Databricks' }, { label: '', cmd: LOGIN }],
      [{ text: "Press ↻ when you're done. Several workspaces? Pick one with -p <profile>.", dim: true }],
    ]
  }
  return [[{ icon: ['\u{f0164}', '⊘'], title: "Can't reach Databricks" }, { text: o.line, dim: true }, { text: 'Check your network or proxy, then press ↻.', dim: true }]]
}

function changesMembers(args: string[]): boolean {
  const [group = '', verb = ''] = positionals(args)
  if (group === 'fs') return false
  if (group === 'sync') return true
  return MEMBER_VERBS.test(verb) || (verb === 'update' && args.some(a => a.startsWith('--new-name')))
}

export const register: Register = (on, options) => {
  glyphSetting = typeof options?.glyphs === 'string' ? options.glyphs : 'auto'
  follow = options?.follow !== 'off'
  fontHint = options?.fontHint !== 'off'

  on('session.start', async ($, e, next) => {
    useDrives((await $.env.get('OS')) === 'Windows_NT')
    hinted = false
    fellBack = false
    quiet(detectGlyphs($).then(() => $.ui.invalidate('ui.render')))
    await patchView($, () => ({ work: null, busy: {} }))
    await $.command.register({ name: PANE, description: 'Open the Databricks pane; args: [profile]' })
    const ex = await get($)
    activeProfile = ex.target?.profile ?? ''
    if (ex.target) quiet(openPane($, { id: PANE, title: titleFor(ex.target) }))
    return next(e)
  })

  on('command.run', { command: PANE }, async ($, e) => {
    const terminalOnly = !(await $.session.surfaces().catch(() => ['terminal'])).some(x => x !== 'terminal')
    if (terminalOnly && e.presentation && !e.presentation.isFullscreen) return { text: 'The Databricks pane shows in the sidebar, which needs the fullscreen layout. Run /tui fullscreen, then /databricks-pane.' }
    if (terminalOnly && e.presentation && e.presentation.columns < 110) return { text: 'The Databricks pane shows in the sidebar, which needs a terminal at least 110 columns wide. Widen it, then run /databricks-pane.' }
    noDock = false
    const [profile = ''] = tokenize(e.args ?? '')
    await point($, { kind: 'databricks', profile }, 'asked', true)
    await refresh($)
    return { text: profile ? `Databricks pane on profile ${profile}.` : 'Databricks pane open.' }
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const command = e.tool === 'Bash' ? e.command : ''
    if (!/\bdatabricks\b/.test(command)) return next(e)
    const calls = invocations(command, await cwdOf($)).flatMap(inv => {
      const kind = dbKind(inv)
      return kind ? [{ inv, kind }] : []
    })
    if (calls.length === 0) return next(e)
    if (closed || noDock) return next(e)
    const ex = await get($)
    const have = new Set(ex.nodes.map(n => n.id))
    const marks: Mark[] = calls.map(c => ({ ids: [HEADER, ...dbTargets(c.inv).filter(id => have.has(id))], tone: DB_TONE[c.kind] }))
    const tone = toneOf(calls)
    await markBusy($, marks)
    const mine = await startWork($, [...new Set(marks.flatMap(m => m.ids.filter(id => id !== HEADER)))], tone)
    let result: Awaited<ReturnType<typeof next>>
    try {
      result = await next(e)
    } catch (err) {
      await clearBusy($, marks)
      await finishWork($, mine, tone)
      throw err
    }
    const task = result.deny ? '' : backgroundOf(result.result)
    const stale = new Set(loading.keys())
    const settle = async () => {
      await clearBusy($, marks)
      let lit: Lit = { touched: [], opened: [] }
      try {
        if (!result.deny && !closed && !noDock) lit = await afterDb($, calls, stale, !result.isError)
      } finally {
        await finishWork($, mine, tone, lit.touched, lit.opened)
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
    if (e.requestId === PANE && typeof e.element === 'string' && e.element.startsWith('onboard-') && e.data && typeof e.data === 'object') {
      const data = e.data as { press?: unknown; copy?: unknown }
      const text = typeof data.press === 'string' ? data.press : typeof data.copy === 'string' ? data.copy : ''
      if (text) await copyOf($, text, e.surface)
      return {}
    }
    if (e.requestId !== PANE || e.element !== 'rows' || !e.data || typeof e.data !== 'object') return next(e)
    const view = views.get(e.surface) ?? { from: 0, max: 0 }
    const data = e.data as { press?: unknown; key?: unknown; ctrl?: unknown; shift?: unknown; scrollTo?: unknown; copy?: unknown }
    const ex = await get($)
    if (typeof data.scrollTo === 'number') {
      const to = Math.round(Math.max(0, Math.min(1, data.scrollTo)) * view.max)
      if (to !== ex.scroll) await patchView($, () => ({ scroll: to }))
      return {}
    }
    if (typeof data.copy === 'string') {
      const n = ex.nodes.find(x => x.id === data.copy)
      if (n) await copyOf($, n.path || n.name, e.surface)
      return {}
    }
    if (typeof data.press === 'string') {
      const n = ex.nodes.find(x => x.id === data.press)
      if (!n) return {}
      if (ex.scroll === null) await patchView($, () => ({ scroll: view.from }))
      if (data.ctrl) await openWeb($, ex, n)
      else if (data.shift) await openLocal($, ex, n)
      else await press($, n)
      return {}
    }
    if (typeof data.key !== 'string') return {}
    const rows = visible(ex, SORT, rootOf(ex))
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
    else if (cur && (data.key === 'y' || data.key === 'Y')) await copyOf($, cur.node.path || cur.node.name, e.surface)
    else if (cur && (data.key === 'right' || data.key === 'l') && !cur.leaf && !cur.open) await select($, cur.node)
    else if (cur && (data.key === 'left' || data.key === 'h')) {
      if (!cur.leaf && cur.open) await patchView($, x => ({ expanded: x.expanded.filter(id => id !== cur.node.id) }))
      else if (cur.node.parent) await patchView($, () => ({ cursor: cur.node.parent }))
    } else if (cur && (data.key === ' ' || data.key === 'return')) await (data.key === 'return' && cur.leaf ? openLocal($, ex, cur.node) : select($, cur.node))
    return {}
  })

  on('ui.scroll', { component: 'Pane', requestId: PANE }, async ($, e) => {
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
    const ex = await get($)
    const now = await $.clock.now()
    const busyTone = (id: string) => {
      const b = ex.busy[id]
      return b && now - b.at < BUSY_MAX_MS ? b.tone : ''
    }
    const work = live(ex.work, now) ? ex.work : null
    const brightSet = new Set(work?.lit ?? [])
    const dimSet = new Set(work?.dim ?? [])
    const width = Math.max(20, e.props.bodyColumns)
    const rows = visible(ex, SORT, rootOf(ex))
    const detailRows = ex.detail.length ? Math.min(ex.detail.length, DETAIL_ROWS) + 2 : 0
    const room = Math.max(5, Math.min(WINDOW, (e.props.scroll?.bodyRows ?? 40) - 4 - detailRows))
    const focusId = follow && work && work.lit.length ? (work.lit[work.lit.length - 1] ?? ex.cursor) : ex.cursor
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
    const spin = (tone: string): Seg => ({ t: ' ', spin: true, b: true, c: TONES[tone]?.bright[1] ?? SHIMMER[1] })
    const rowSpec = (r: (typeof rows)[number]): RowSpec => {
      const n = r.node
      const g = glyph(n, tier)
      const arrow = r.leaf ? '  ' : tier === 'plain' ? (r.open ? '▾ ' : '▸ ') : r.open ? '\u{f47c} ' : '\u{f460} '
      const note = n.note ? ` ${n.note}` : ''
      const cols = Math.max(4, width - r.depth * 2 - 6 - note.length)
      const isBright = brightSet.has(n.id)
      const isDim = !isBright && dimSet.has(n.id)
      const name = clip(n.name, cols)
      const faded = n.hidden || n.kind === 'placeholder' || n.kind === EMPTY
      const tone = work?.tone ?? 'orange'
      const busy = busyTone(n.id)
      const left: Seg[] = [
        { t: '  '.repeat(r.depth) },
        { t: arrow, c: '#7a7a86' },
        isBright || isDim ? { t: g.char + ' ', sh: tone, dim: isDim, one: true } : { t: g.char + ' ', c: faded ? '#6e6e7a' : g.color },
        isBright || isDim ? { t: name, sh: tone, dim: isDim, b: isBright } : { t: name, c: faded ? '#6e6e7a' : g.label, b: n.id === ex.selected },
      ]
      if (busy) left.push(spin(busy))
      return { id: n.kind === 'placeholder' || n.kind === EMPTY ? '' : n.id, left: clean(left), right: note ? [{ t: note, c: '#6e6e7a' }] : [] }
    }
    const note = (text: string): RowSpec => ({ id: '', left: [{ t: text, c: '#6e6e7a' }], right: [] })
    const specs: RowSpec[] = [...pinned.map(rowSpec), ...(pinned.length > 0 ? [note('  ⋮')] : []), ...shown.map(rowSpec)]
    const barSize = Math.max(1, Math.round((specs.length * shown.length) / Math.max(1, rows.length)))
    const bar =
      rows.length > shown.length + pinned.length
        ? { pos: max ? Math.round((from / max) * (specs.length - barSize)) : 0, size: barSize, thumb: '#5b9bd5', track: '#4a4a56' }
        : undefined
    const icon = (nerd: string, fallback: string) => (tier === 'plain' ? fallback : nerd)
    const rootNode = ex.nodes.find(n => n.id === rootOf(ex))
    const rootName = rootNode ? rootNode.name : ''
    const head: RowSpec = {
      id: '',
      left: clean([
        { t: `${titleGlyph(tier)} `, c: TITLE_COLOR },
        { t: rootName || (label(ex.target)), b: true },
        ...(ex.status ? [{ t: `  ${ex.status}`, c: '#6e6e7a' }] : []),
        ...(busyTone(HEADER) ? [spin(busyTone(HEADER))] : []),
      ]),
      right: [],
    }
    const spinner = tier === 'plain' ? PLAIN_SPINNER : []
    return (
      <Box flexDirection="column" minHeight={Math.max(1, e.props.scroll?.bodyRows ?? 1)}>
        <Box flexDirection="row">
          <Box flexGrow={1} flexShrink={1}>
            <Client key="head" module="./rows.tsx" props={{ rows: [head], active: '', activeBg: '', hoverBg: '', tones: TONES, spinner } satisfies RowsProps} />
          </Box>
          <Box flexDirection="row" gap={2}>
            {rootNode && <Button key="up" plain dimColor label={icon('\u{f005d}', '↑')} onPress={() => quiet(goUp($))} />}
            {rootNode && <Button key="home" plain dimColor label={icon('\u{f02dc}', '⌂')} onPress={() => quiet(goHome($))} />}
            <Button key="refresh" plain dimColor label={icon('\u{f0450}', '↻')} onPress={() => quiet(refresh($))} />
            <Button key="collapse" plain dimColor label={icon('\u{eac5}', '⊟')} onPress={() => quiet(patchView($, () => ({ expanded: [] })))} />
            {sel && <Button key="clear" plain label={icon('\u{f0156}', '✕')} onPress={() => quiet(patchView($, () => ({ selected: '', detail: [] })))} />}
            <Text> </Text>
          </Box>
        </Box>
        <Box flexDirection="row">
          <Box flexGrow={1}>
            {work && !ex.query ? (
              <Client key="working" module="./rows.tsx" props={{ rows: [{ id: '', left: [{ t: 'Claude is working in Databricks...', sh: work.tone }], right: [] }], active: '', activeBg: '', hoverBg: '', tones: TONES, spinner } satisfies RowsProps} />
            ) : (
            <Input
              key="q"
              label="/ "
              placeholder="search"
              submitLabel="jump"
              autoFocus
              value={ex.query}
              onInput={(v: string) => quiet(patchView($, () => ({ query: v })))}
              onSubmit={(v: string) => quiet(patch($, cur => jumpTo(cur, v)))}
            />
            )}
          </Box>
          {ex.query ? <Button key="clearq" plain dimColor label={tier === 'plain' ? '×' : '\u{f0156}'} onPress={() => quiet(patchView($, () => ({ query: '' })))} /> : null}
        </Box>
        {ex.onboard && (
          <Box flexDirection="column" marginTop={1}>
            {onboardBlocks(ex.onboard).map((block, b) => (
              <Box key={`block-${b}`} flexDirection="column" marginTop={b > 0 ? 1 : 0}>
                {block.map((line, i) =>
                  'title' in line ? (
                    <Text key={`line-${i}`} wrap="wrap">
                      <Text color={TITLE_COLOR}>{`${icon(line.icon[0], line.icon[1])} `}</Text>
                      <Text bold>{line.title}</Text>
                    </Text>
                  ) : 'cmd' in line ? (
                    <Box key={`line-${i}`} marginLeft={2}>
                      <Client
                        key={`onboard-${b}-${i}`}
                        module="./rows.tsx"
                        props={{ rows: [{ id: line.cmd, left: [...(line.label ? [{ t: line.label }] : []), { t: line.cmd, c: ACCENT }], right: [] }], active: '', activeBg: '', hoverBg: '#2d2f33', tones: TONES, spinner } satisfies RowsProps}
                      />
                    </Box>
                  ) : (
                    <Box key={`line-${i}`} marginLeft={2}>
                      <Text wrap="wrap" dimColor={line.dim}>
                        {line.text}
                      </Text>
                    </Box>
                  ),
                )}
              </Box>
            ))}
          </Box>
        )}
        {!ex.onboard && ex.nodes.length === 0 && <Text dimColor>{ex.target ? 'nothing loaded yet' : HINT}</Text>}
        {!ex.onboard && <Client key="rows" module="./rows.tsx" props={{ rows: specs, active: ex.cursor, activeBg: '#3e4451', hoverBg: '#2d2f33', tones: TONES, spinner, ...(bar ? { bar } : {}) } satisfies RowsProps} />}
        {!ex.onboard && ex.detail.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            {ex.detail.slice(0, DETAIL_ROWS).map((l, i) => (
              <Text key={String(i)} dimColor={i > 0} bold={i === 0} wrap="truncate-end">
                {l.replace(/\s+/g, ' ')}
              </Text>
            ))}
            {sel && (
              <Box flexDirection="row" gap={2}>
                {webUrl(ex, sel) && <Button key="web" plain label={`${icon('\u{f059f}', '◎')} open in Databricks`} onPress={() => quiet(openWeb($, ex, sel))} />}
              </Box>
            )}
          </Box>
        )}
        <Box flexGrow={1} />
        {sel && (
          <Text dimColor wrap="truncate-start">
            selected: {sel.path || sel.name}
          </Text>
        )}
      </Box>
    )
  })
}
