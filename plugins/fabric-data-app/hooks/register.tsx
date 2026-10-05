import { type EngineInterface, type Register, type Timer, update } from 'claude-code'
import { openCommand } from './open'

import type { AppInfo, FileNode, FileTree, Source, Theme } from '../types'
import { merge, parseSources } from './apps'
import { CLIS } from './clis'
import { glyphFor, type Tier } from './glyphs'
import type { RowSpec, RowsProps, Seg } from './rows'
import { CHEVRON_CLOSED, CHEVRON_OPEN, fileIcon, GIT_COLOR, plainIcon, stronger } from './icons'
import { type CliCall, cliCalls, deploys, mutates, tokenize } from './parse'
import {
  ancestorsOf,
  type Change,
  DEFAULT_THEME,
  dirname,
  emptyTree,
  inside,
  join,
  mapLimit,
  parseGit,
  parseNumstat,
  rollCounts,
  rollUp,
  parseTheme,
  posix,
  replaceChildren,
  resolvePath,
  stamp,
  toNodes,
  underAny,
  useDrives,
  visibleRows,
} from './tree'

const PANE = 'fabric-app-pane'
const TREE = { plugin: 'fabric-data-app', key: 'tree' } as const
const APPS = { plugin: 'fabric-data-app', key: 'apps' } as const
const THEME = { plugin: 'fabric-data-app', key: 'theme' } as const
const ADD_COLOR = '#98c379'
const DEL_COLOR = '#e06c75'
const TITLE = 'Fabric apps'
const WORKING = 'Claude is working in Fabric...'
const FONT_HINT = 'Tell user once: Fabric app pane icons need github.com/data-goblin/fabric-nf plus a Nerd Font. Plugin option fontHint=off disables this.'
const BUSY_MAX_MS = 600_000
const FLASH_MS = 2700
const DOUBLE_MS = 450
const FIND_LIMIT = 200
const READ_LIMIT = 8
const SOURCE_INPUTS = ['fabric.yaml', 'rayfin/rayfin.yml', 'rayfin/data/schema.ts']
const APP_INPUTS = [...new Set([...SOURCE_INPUTS, ...CLIS.flatMap(c => [c.marker, ...c.inputs])])]
const LIST_LIMIT = 16
const TONES: Record<string, { bright: string[]; dim: string[] }> = {
  orange: { bright: ['#f97316', '#fb923c', '#fdba74', '#ffedd5'], dim: ['#8a4316', '#a3562a', '#bd7444', '#d29267'] },
  teal: { bright: ['#14b8a6', '#2dd4bf', '#5eead4', '#ccfbf1'], dim: ['#0f5e57', '#16786f', '#2a9488', '#4fb3a8'] },
}
const THEME_FILE = '.local/state/omarchy/current/theme/colors.toml'
const APP_COLOR = '#5a91e2'
const FONT_SCRIPT =
  'if command -v fc-list >/dev/null 2>&1; then f=$(fc-list ":charset=$1" file | head -n1 | cut -d: -f1); ' +
  'else f=$(ls "$HOME"/Library/Fonts/*"$2"* /Library/Fonts/*"$2"* 2>/dev/null | head -n1); fi; ' +
  '[ -n "$f" ] || { echo missing; exit 0; }; m=$(stat -c %Z "$f" 2>/dev/null || stat -f %c "$f"); p=$PPID; ' +
  'while [ -n "$p" ] && [ "$p" -gt 1 ]; do c=$(ps -o comm= -p "$p" 2>/dev/null); c=$(basename "$c" 2>/dev/null | tr -d " "); case "$c" in ' +
  'ghostty|kitty|alacritty|Alacritty|foot|footclient|wezterm-gui|konsole|gnome-terminal-|xterm|urxvt|st|Terminal|iTerm2) ' +
  'e=$(ps -o etime= -p "$p" 2>/dev/null | awk -F\'[-:]\' \'{n=NF; s=$n+60*$(n-1); if (n>2) s+=3600*$(n-2); if (n>3) s+=86400*$(n-3); print s}\'); [ -n "$e" ] && [ $(( $(date +%s) - e )) -lt "$m" ] && echo stale || echo ok; exit 0;; esac; ' +
  'p=$(ps -o ppid= -p "$p" 2>/dev/null | tr -d " "); done; echo ok'
const PRUNE = ['node_modules', '.git', 'dist', 'target', '.venv', '__pycache__', '.playwright']
const HOME_PRUNE = ['Library', 'AppData', '.Trash']

let blink: Timer | null = null
let generation = 0
let workTimer: Timer | null = null
let workGen = 0
let epoch = 0
let lastPress = { key: '', at: 0 }
let view: { from: number; max: number; ids: string[] } = { from: 0, max: 0, ids: [] }
let shownApps: AppInfo[] = []
let gitTops = new Set<string>()
let gitRun: Promise<void> | null = null
let gitNext: Promise<void> | null = null
let closed = false
let noDock = false
let detected: Tier = 'nerd'
let glyphSetting = 'auto'
let follow = true
let fontHint = true
let hinted = false
let fellBack = false
let remote = false

function tierFor(surface: string): Tier {
  if (glyphSetting === 'fabric' || glyphSetting === 'nerd' || glyphSetting === 'plain') return glyphSetting
  return surface === 'desktop' ? 'plain' : detected
}

function fontNote(): string {
  if (!fontHint || hinted || !fellBack) return ''
  hinted = true
  return FONT_HINT
}

function quiet(p: Promise<unknown>): void {
  void p.catch(() => undefined)
}
let scanning: Promise<void> | null = null
let scanJobs: Job[] = []
const running = new Map<string, Job>()

type Since = { ms: number; mark: string; os: 'linux' | 'darwin' | 'win32' }
type Job = { since: Since; usedCli: boolean; deploy: boolean; deployDir: string; busy: boolean }

let platform: Promise<'linux' | 'darwin' | 'win32'> | null = null
let markId = 0
let home = ''

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

async function sinceNow($: EngineInterface, watch: boolean): Promise<Since> {
  const ms = await $.clock.now()
  if (!watch) return { ms, mark: '', os: 'linux' }
  const os = await osName($)
  if (os !== 'darwin') return { ms, mark: '', os }
  const mark = `${((await $.env.get('TMPDIR')) || '/tmp').replace(/\/+$/, '')}/${PANE}-${await $.session.id()}-${++markId}.mark`
  try {
    await $.process.run(['touch', mark], { timeoutMs: 3_000 })
    return { ms, mark, os }
  } catch {
    return { ms, mark: '', os }
  }
}

async function dropMarks($: EngineInterface, marks: string[]): Promise<void> {
  const live = marks.filter(Boolean)
  if (live.length) await $.process.run(['rm', '-f', ...live], { timeoutMs: 3_000 }).catch(() => undefined)
}

async function copyOf($: EngineInterface, id: string, root: string, absolute: boolean, surface?: string): Promise<void> {
  const text = !absolute && id.startsWith(root + '/') ? id.slice(root.length + 1) : id
  const done = await $.ui.copy({ text, ...(surface ? { surface: surface as 'terminal' } : {}) })
  $.ui.toast(done.isCopied ? `Copied ${text}` : `Could not copy: ${done.reason}`)
}

function fit(text: string, cols: number): string {
  return text.length > cols ? text.slice(0, cols - 1) + '…' : text
}

function clean(segs: Seg[]): Seg[] {
  for (const seg of segs) for (const k of Object.keys(seg) as (keyof Seg)[]) if (seg[k] === undefined) delete seg[k]
  return segs
}

async function listNames($: EngineInterface, dir: string): Promise<{ name: string; kind: string }[]> {
  try {
    return (await $.fs.list(dir)).map(e => ({ name: e.name, kind: e.kind }))
  } catch {
    return []
  }
}

async function sourcesOf($: EngineInterface, dir: string): Promise<Source[]> {
  const fp = join(dir, 'rayfin/functions-python')
  const udfDefs = await Promise.all(
    (await listNames($, fp)).filter(e => e.kind === 'dir').map(async e => ({ folder: e.name, text: await readText($, join(fp, `${e.name}/definition.json`)) })),
  )
  const tsFunctions = (await listNames($, join(dir, 'rayfin/functions')))
    .filter(e => e.kind === 'file' && /\.(ts|js)$/.test(e.name) && !/\.d\.ts$/.test(e.name) && e.name !== 'index.ts')
    .map(e => e.name.replace(/\.(ts|js)$/, ''))
  return parseSources({
    fabricYaml: await readText($, join(dir, 'fabric.yaml')),
    rayfinYml: await readText($, join(dir, 'rayfin/rayfin.yml')),
    schemaTs: await readText($, join(dir, 'rayfin/data/schema.ts')),
    udfDefs,
    tsFunctions,
  })
}

async function get($: EngineInterface): Promise<FileTree> {
  return { ...emptyTree(''), ...(await $.state.get(TREE)).value }
}

async function getApps($: EngineInterface): Promise<AppInfo[]> {
  return (await $.state.get(APPS)).value ?? []
}

async function put($: EngineInterface, fn: (t: FileTree) => FileTree): Promise<void> {
  await update($, TREE, value => {
    const cur = { ...emptyTree(''), ...value }
    return anchored(cur, fn(cur))
  })
}

type Item = { node: FileNode; depth: number; open: boolean; source?: Source; child?: string }

function topOf(t: FileTree): string {
  return t.top && t.nodes.some(n => n.id === t.top) ? t.top : ''
}

function itemsOf(t: FileTree, apps: AppInfo[]): Item[] {
  const byDir = new Map(apps.map(a => [a.dir, a]))
  const rows: Item[] = []
  const sources = (app: AppInfo, depth: number) => {
    const synthetic = (key: string, name: string): FileNode => ({ id: `${app.dir}#${key}`, parent: app.dir, name, kind: 'file', hidden: false, mtime: 0, loaded: false })
    if (app.error) rows.push({ node: synthetic('error', app.error), depth, open: false, source: { kind: 'error', name: app.error, note: '' } })
    if (app.sources.length === 0) rows.push({ node: synthetic('none', 'no data sources configured'), depth, open: false, source: { kind: 'none', name: 'no data sources configured', note: '' } })
    app.sources.forEach((src, i) => {
      rows.push({ node: synthetic(`s${i}`, src.name), depth, open: false, source: src })
      for (const child of src.children ?? []) rows.push({ node: synthetic(`s${i}:${child}`, child), depth: depth + 1, open: false, source: src, child })
    })
  }
  const top = topOf(t)
  const topApp = byDir.get(top)
  if (topApp) sources(topApp, 0)
  for (const r of visibleRows(t, top)) {
    rows.push(r)
    const app = byDir.get(r.node.id)
    if (app && r.open) sources(app, r.depth + 1)
  }
  return rows
}

function anchored(cur: FileTree, next: FileTree): FileTree {
  if (follow || cur.scroll === null || next.scroll !== cur.scroll || (next.nodes === cur.nodes && next.expanded === cur.expanded)) return next
  const top = itemsOf(cur, shownApps)[cur.scroll]?.node.id
  const at = top ? itemsOf(next, shownApps).findIndex(r => r.node.id === top) : -1
  return at < 0 || at === cur.scroll ? next : { ...next, scroll: at }
}

function patch($: EngineInterface, fn: (t: FileTree) => Partial<FileTree>) {
  return put($, t => ({ ...t, ...fn(t) }))
}

function appOf(apps: AppInfo[], path: string): AppInfo | undefined {
  return apps
    .filter(a => path === a.dir || path.startsWith(a.dir + '/'))
    .sort((a, b) => b.dir.length - a.dir.length)[0]
}

function chainOf(apps: AppInfo[], id: string): string[] {
  const app = appOf(apps, id)
  if (!app || id === app.dir) return []
  const out: string[] = []
  let dir = dirname(id)
  while (dir.length >= app.dir.length) {
    out.push(dir)
    if (dir === app.dir) break
    dir = dirname(dir)
  }
  return out
}

async function list($: EngineInterface, dir: string): Promise<FileNode[]> {
  const entries = await $.fs.list(dir)
  const resolved = await Promise.all(
    entries.map(async e => {
      if (!e.isLink) return { name: e.name, kind: e.kind, mtimeMs: e.mtimeMs, isLink: false }
      try {
        const target = await $.fs.stat(join(dir, e.name))
        return target.kind === 'dir'
          ? { name: e.name, kind: 'dir' as const, mtimeMs: target.mtimeMs, isLink: false }
          : { name: e.name, kind: 'file' as const, mtimeMs: target.mtimeMs, isLink: true }
      } catch {
        return { name: e.name, kind: 'other' as const, mtimeMs: 0, isLink: true }
      }
    }),
  )
  return toNodes(dir, resolved)
}

async function loadDirs($: EngineInterface, dirs: string[]): Promise<Map<string, FileNode[]>> {
  const root = (await get($)).root
  const listed = new Map<string, FileNode[]>()
  const failed: string[] = []
  await mapLimit(dirs, LIST_LIMIT, async dir => {
    try {
      listed.set(dir, await list($, dir))
    } catch (err) {
      failed.push(`${shortPath(dir)} (${err instanceof Error ? err.message : String(err)})`)
    }
  })
  await patch($, t => (t.root === root ? { nodes: replaceChildren(t.nodes, listed), status: failed.length ? `could not list ${failed.join(', ')}` : '' } : {}))
  return listed
}

async function readText($: EngineInterface, path: string): Promise<string> {
  try {
    return String(await $.fs.read(path))
  } catch {
    return ''
  }
}

async function walkMarkers($: EngineInterface, root: string): Promise<string[]> {
  const hits: string[] = []
  let level = [root]
  let seen = 0
  for (let depth = 0; depth < 6 && level.length && seen < 20_000; depth++) {
    const next: string[] = []
    for (const dir of level) {
      for (const n of await list($, dir).catch(() => [] as FileNode[])) {
        seen++
        if (n.kind === 'dir' && !PRUNE.includes(n.name) && !(root === home && HOME_PRUNE.includes(n.name))) next.push(n.id)
        for (const cli of CLIS) {
          const [first, ...rest] = cli.marker.split('/')
          if (n.name !== first) continue
          if (rest.length === 0 && n.kind !== 'dir') hits.push(n.id)
          else if (rest.length && n.kind === 'dir' && (await $.fs.stat(join(n.id, rest.join('/'))).then(st => st.kind === 'file', () => false))) hits.push(join(n.id, rest.join('/')))
        }
      }
    }
    level = next
  }
  return hits
}

function markerOf(path: string): { dir: string; cli: string } | null {
  for (const cli of CLIS) if (path.endsWith(`/${cli.marker}`)) return { dir: path.slice(0, -(cli.marker.length + 1)) || '/', cli: cli.name }
  return null
}

async function discover($: EngineInterface, root: string): Promise<AppInfo[]> {
  const names = root === home ? [...PRUNE, ...HOME_PRUNE] : PRUNE
  const prune = names.flatMap((name, i) => (i === 0 ? ['-name', name] : ['-o', '-name', name]))
  const markers = CLIS.flatMap((c, i) => [...(i ? ['-o'] : []), ...(c.marker.includes('/') ? ['-path', `*/${c.marker}`] : ['-name', c.marker])])
  let hits: string[] = []
  try {
    if ((await osName($)) === 'win32') hits = await walkMarkers($, root)
    else {
      const run = await $.process.run(['find', '-H', root, '-maxdepth', '6', '(', ...prune, ')', '-prune', '-o', '(', ...markers, ')', '-print0'], { timeoutMs: 10_000 })
      hits = run.stdout.split('\0').filter(Boolean)
    }
  } catch {
    hits = []
  }
  const kinds = new Map<string, string[]>()
  for (const hit of hits) {
    const found = markerOf(hit)
    if (!found) continue
    const names = kinds.get(found.dir) ?? []
    if (!names.includes(found.cli)) names.push(found.cli)
    kinds.set(found.dir, names)
  }
  const dirs = [...kinds.keys()].sort((a, b) => a.localeCompare(b))
  return mapLimit(dirs, READ_LIMIT, dir => appAt($, dir, kinds.get(dir) ?? []))
}

async function appAt($: EngineInterface, dir: string, names: string[]): Promise<AppInfo> {
  const clis = CLIS.filter(c => names.includes(c.name))
  const cli = clis.map(c => c.name).join('+')
  try {
    const parts = await Promise.all(clis.map(c => c.read(dir, rel => readText($, join(dir, rel)))))
    const info = parts.reduce((a, b) => merge(a, b))
    return { ...info, sources: await sourcesOf($, dir) }
  } catch (err) {
    const name = dir.split('/').pop() || dir
    return { dir, name, title: name, cli, workspace: '', item: '', portal: '', hosting: '', sources: [], error: `could not read this app: ${err instanceof Error ? err.message : String(err)}` }
  }
}

async function syncApps($: EngineInterface, found?: AppInfo[], at = epoch): Promise<{ added: string[]; changed: string[] }> {
  const t = await get($)
  if (!t.root || epoch !== at) return { added: [], changed: [] }
  const before = await getApps($)
  const apps = (found ?? (await discover($, t.root))).filter(a => a.dir !== t.root)
  const now = await get($)
  if (epoch !== at || now.root !== t.root) return { added: [], changed: [] }
  await $.state.set(APPS, apps)
  const old = new Map(before.map(a => [a.dir, JSON.stringify(a)]))
  const added = apps.filter(a => !old.has(a.dir)).map(a => a.dir)
  const changed = apps.filter(a => old.has(a.dir) && old.get(a.dir) !== JSON.stringify(a)).map(a => a.dir)
  await patch($, cur => {
    if (cur.root !== t.root) return {}
    const keep = new Set(apps.map(a => a.dir))
    const appNodes: FileNode[] = apps.map(a => {
      const prev = cur.nodes.find(n => n.id === a.dir)
      return { id: a.dir, parent: cur.root, name: a.title, kind: 'dir', hidden: false, mtime: 0, loaded: prev?.loaded ?? false }
    })
    const rest = cur.nodes.filter(n => n.parent !== cur.root && !keep.has(n.id) && underAny(n.parent, keep, cur.root))
    return { nodes: [...appNodes, ...rest] }
  })
  return { added, changed }
}

type GitScan = { dir: string; git: Record<string, string>; ignored: string[]; untrackedDirs: string[]; diff: Record<string, [number, number]>; files: Record<string, Change> }

async function gitAt($: EngineInterface, dir: string): Promise<{ top: string; prefix: string } | null> {
  const run = await $.process.run(['git', '-C', dir, 'rev-parse', '--show-prefix', '--show-toplevel'], { timeoutMs: 10_000 })
  if (run.exitCode !== 0) return null
  const [prefix = '', toplevel = ''] = run.stdout.split('\n')
  return { top: toplevel.trim(), prefix: prefix.trim() }
}

async function scanGit($: EngineInterface, dir: string, prefix: string): Promise<GitScan | null> {
  const git = (args: string[]) => $.process.run(['git', '--no-optional-locks', '-C', dir, ...args], { timeoutMs: 20_000, env: { GIT_OPTIONAL_LOCKS: '0' } })
  const run = await git(['status', '--porcelain=v1', '-z', '--ignored=traditional', '--untracked-files=normal', '--', '.'])
  if (run.exitCode !== 0) return null
  const parsed = parseGit(run.stdout, dir, prefix)
  const diff: Record<string, [number, number]> = {}
  const head = await git(['diff', 'HEAD', '--numstat', '-z', '--', '.'])
  if (head.exitCode === 0) parseNumstat(head.stdout, dir, prefix, diff)
  const files = { ...parsed.files }
  if (parsed.untrackedDirs.length) {
    const others = await git(['ls-files', '-o', '--exclude-standard', '-z', '--', ...parsed.untrackedDirs.map(d => d.slice(dir.length + 1) || '.')])
    if (others.exitCode === 0) for (const rel of others.stdout.split('\0').filter(Boolean)) files[join(dir, rel)] = 'new'
  }
  for (const path of Object.keys(diff)) if (files[path] === 'new') delete diff[path]
  return { dir, git: parsed.git, ignored: parsed.ignored, untrackedDirs: parsed.untrackedDirs, diff, files }
}

async function readGit($: EngineInterface): Promise<void> {
  const t = await get($)
  if (!t.root) return
  const root = t.root
  try {
    const apps = await getApps($)
    const base = await gitAt($, root)
    const rootScan = base ? await scanGit($, root, base.prefix) : null
    if (base && !rootScan) return
    const loose = rootScan ? new Set([...rootScan.untrackedDirs, ...rootScan.ignored]) : null
    const candidates = apps.filter(a => !loose || loose.has(a.dir)).sort((x, y) => x.dir.length - y.dir.length)
    const found = await mapLimit(candidates, READ_LIMIT, a => gitAt($, a.dir).catch(() => null))
    const own: { dir: string; top: string; prefix: string }[] = []
    candidates.forEach((a, i) => {
      const g = found[i]
      if (!g || (base && g.top === base.top) || own.some(o => o.top === g.top && a.dir.startsWith(o.dir + '/'))) return
      own.push({ dir: a.dir, top: g.top, prefix: g.prefix })
    })
    const extra = await mapLimit(own, READ_LIMIT, o => scanGit($, o.dir, o.prefix).catch(() => null))
    const scans = [...(rootScan ? [rootScan] : []), ...extra.filter((x): x is GitScan => x !== null)]
    const owned = scans.map(x => x.dir).filter(d => d !== root)
    gitTops = new Set([...(base ? [base.top] : []), ...own.filter((_, i) => extra[i]).map(o => o.top)])
    const git: Record<string, string> = {}
    const ignored: string[] = []
    const untrackedDirs: string[] = []
    const diff: Record<string, [number, number]> = {}
    const files: Record<string, Change> = {}
    for (const scan of scans) {
      const deeper = owned.filter(d => d !== scan.dir && d.startsWith(scan.dir === '/' ? '/' : scan.dir + '/'))
      const keep = (p: string) => !deeper.some(d => p === d || p.startsWith(d + '/'))
      for (const [p, l] of Object.entries(scan.git)) if (keep(p)) git[p] = stronger(git[p], l)
      ignored.push(...scan.ignored.filter(keep))
      untrackedDirs.push(...scan.untrackedDirs.filter(keep))
      for (const [p, d] of Object.entries(scan.diff)) if (keep(p)) diff[p] = d
      for (const [p, c] of Object.entries(scan.files)) if (keep(p)) files[p] = c
    }
    await patch($, cur => (cur.root === root ? { git, ignored, untrackedDirs, diff: rollUp(diff, root), counts: rollCounts(files, root) } : {}))
  } catch {
    gitTops = new Set()
  }
}

function refreshGit($: EngineInterface): Promise<void> {
  if (!gitRun) {
    gitRun = readGit($).finally(() => {
      gitRun = null
    })
    return gitRun
  }
  const rerun = () => {
    gitNext = null
    return refreshGit($)
  }
  gitNext ??= gitRun.then(rerun, rerun)
  return gitNext
}

async function reset($: EngineInterface, start: string, focus = false, found?: AppInfo[]): Promise<void> {
  const mine = ++epoch
  const apps = found ?? (await discover($, start))
  const root = apps.some(a => a.dir === start) ? dirname(start) : start
  const keepHidden = (await get($)).showHidden
  if (epoch !== mine) return
  generation += 1
  blink?.cancel()
  blink = null
  await put($, () => ({ ...emptyTree(root), showHidden: keepHidden }))
  await $.state.set(APPS, [])
  const title = titleOf(root)
  closed = false
  if (focus) await openPane($, { id: PANE, title, focus: true })
  else await openPane($, { id: PANE, title })
  await syncApps($, apps, mine)
  await refreshGit($)
}

function titleOf(root: string): string {
  return `${TITLE}: ${root.split('/').pop() || root}`
}

function isLoaded(t: FileTree, dir: string): boolean {
  return Boolean(t.nodes.find(n => n.id === dir)?.loaded)
}

async function revealPaths($: EngineInterface, paths: string[]): Promise<void> {
  const apps = await getApps($)
  for (let pass = 0; pass < 32; pass++) {
    const t = await get($)
    const need = new Set<string>()
    for (const p of paths) {
      for (const dir of chainOf(apps, p).reverse()) {
        if (!isLoaded(t, dir)) {
          need.add(dir)
          break
        }
      }
    }
    if (need.size === 0) return
    await loadDirs($, [...need])
  }
}

async function changedSince($: EngineInterface, dirs: string[], since: Since): Promise<string[]> {
  if (dirs.length === 0 || since.os === 'win32') return []
  const prune = PRUNE.flatMap((name, i) => (i === 0 ? ['-name', name] : ['-o', '-name', name]))
  const test = since.mark ? ['-newer', since.mark] : ['-newermt', `@${(since.ms / 1000).toFixed(3)}`]
  try {
    const run = await $.process.run(['find', '-H', ...dirs, '-xdev', '(', ...prune, ')', '-prune', '-o', '-type', 'f', ...test, '-print0'], {
      timeoutMs: 8_000,
    })
    return run.stdout.split('\0').filter(Boolean)
  } catch {
    return []
  }
}

async function flash($: EngineInterface, ids: string[], tone = 'orange', ends = 0): Promise<void> {
  const unique = [...new Set(ids)]
  if (unique.length === 0 && ends === 0) return
  const apps = await getApps($)
  const root = (await get($)).root
  const now = await $.clock.now()
  const seen = new Set(view.ids)
  const inView = unique.every(id => seen.has(id))
  let mode = 'none' as 'none' | 'flash' | 'work'
  await patch($, cur => {
    mode = 'none'
    if (cur.root !== root) return {}
    const w = ends > 0 ? cur.work : null
    if (!w && unique.length === 0) return {}
    const open = new Set(cur.expanded)
    const prior = w ? w.lit : cur.flashOn ? cur.flash : []
    const bright = new Set([...prior.filter(id => !unique.includes(id)), ...unique])
    const dim = new Set<string>(w ? w.dim : cur.flashOn ? cur.flashDim : [])
    const tones: Record<string, string> = !w && cur.flashOn ? { ...cur.flashTones } : {}
    for (const id of unique) {
      tones[id] = tone
      const chain = chainOf(apps, id)
      if (!chain.some(a => !open.has(a))) continue
      for (const a of chain) {
        if (!open.has(a)) {
          dim.add(a)
          tones[a] ??= tone
        }
        if (follow) open.add(a)
      }
    }
    for (const id of bright) dim.delete(id)
    const top = topOf(cur)
    const away = follow && top !== '' && unique.some(id => id !== top && !inside(top, id))
    const reveal: Partial<FileTree> = unique.length
      ? { expanded: [...open], ...(follow && !inView ? { scroll: null } : {}), ...(away ? { top: '' } : {}) }
      : {}
    if (w) {
      const n = Math.max(0, w.n - ends)
      if (n === 0 && unique.length === 0) return { work: null }
      if (n === 0) mode = 'work'
      return { ...reveal, work: { ...w, n, lit: [...bright], dim: [...dim], until: n === 0 ? now + FLASH_MS : 0 } }
    }
    mode = 'flash'
    return { ...reveal, flash: [...bright], flashDim: [...dim], flashOn: true, flashTones: tones }
  })
  if (mode === 'flash') {
    const mine = ++generation
    blink?.cancel()
    blink = $.clock.after(FLASH_MS, () => {
      if (generation !== mine) return
      blink = null
      quiet(patch($, cur => (generation === mine ? { flash: [], flashDim: [], flashOn: false, flashTones: {} } : {})))
    })
  } else if (mode === 'work') {
    const mine = ++workGen
    workTimer?.cancel()
    workTimer = $.clock.after(FLASH_MS, () => {
      if (workGen !== mine) return
      workTimer = null
      quiet(patch($, cur => (workGen === mine && cur.work?.n === 0 ? { work: null } : {})))
    })
  }
  if (unique.length === 0) return
  const t = await get($)
  if (!closed) await openPane($, { id: PANE, title: titleOf(t.root) })
}

function touchedBy(apps: AppInfo[], calls: CliCall[]): string[] {
  return [...new Set(calls.map(c => (c.cwd ? appOf(apps, c.cwd)?.dir : undefined)).filter((d): d is string => Boolean(d)))]
}

async function startWork($: EngineInterface, tone: string, lit: string[]): Promise<void> {
  const at = await $.clock.now()
  workGen += 1
  workTimer?.cancel()
  workTimer = null
  await patch($, cur => {
    const live = cur.work && cur.work.n > 0 ? cur.work : null
    return {
      work: {
        tone: live?.tone === 'teal' ? 'teal' : tone,
        n: (live?.n ?? 0) + 1,
        at,
        until: 0,
        lit: [...new Set([...(live?.lit ?? []), ...lit])],
        dim: live?.dim ?? [],
      },
    }
  })
}

function endWork($: EngineInterface): Promise<void> {
  return flash($, [], 'orange', 1)
}

async function afterBash($: EngineInterface, jobs: Job[]): Promise<{ ids: string[]; tone: string }> {
  const t = await get($)
  if (!t.root) return { ids: [], tone: 'orange' }
  const usedCli = jobs.some(j => j.usedCli)
  const deploy = jobs.some(j => j.deploy)
  const deployDir = jobs.map(j => j.deployDir).find(Boolean) ?? ''
  const since = jobs.reduce((a, j) => (j.since.ms < a.ms ? j.since : a), jobs[0]?.since ?? { ms: 0, mark: '', os: 'linux' as const })
  const { added, changed } = usedCli ? await syncApps($) : { added: [], changed: [] }
  const apps = await getApps($)
  await refreshGit($)
  const ignored = new Set((await get($)).ignored)
  const fresh = added.length ? [] : await changedSince($, apps.map(a => a.dir), since)
  const hits = fresh.filter(p => !underAny(p, ignored, t.root)).slice(0, FIND_LIMIT)
  const newMarker = hits.some(p => markerOf(p) !== null)
  const sync = usedCli ? { added: [], changed: [] } : newMarker ? await syncApps($) : { added: [], changed: await refreshApps($, hits) }
  await revealPaths($, hits)
  const loaded = await get($)
  const open = new Set(loaded.expanded)
  await loadDirs($, [...new Set([...loaded.nodes.filter(n => n.kind === 'dir' && n.loaded && open.has(n.id)).map(n => n.id), ...hits.map(dirname)])])
  const present = new Set((await get($)).nodes.map(n => n.id))
  const ids = [...added, ...changed, ...sync.added, ...sync.changed, ...hits.filter(p => present.has(p))]
  if (deploy) {
    const target = deployDir ? appOf(apps, deployDir) : undefined
    const deployed = [...changed, ...sync.changed].filter(d => apps.some(a => a.dir === d))
    return { ids: deployed.length ? deployed : target ? [target.dir] : [], tone: 'teal' }
  }
  return { ids, tone: 'orange' }
}

function scheduleScan($: EngineInterface, job: Job): void {
  scanJobs.push(job)
  if (scanning) return
  scanning = (async () => {
    try {
      while (scanJobs.length) {
        const jobs = scanJobs
        scanJobs = []
        let lit = { ids: [] as string[], tone: 'orange' }
        try {
          lit = await afterBash($, jobs)
        } catch (err) {
          await report($, `refresh failed: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
          await dropMarks($, jobs.map(j => j.since.mark))
        }
        try {
          await flash($, lit.ids, lit.tone, jobs.filter(j => j.busy).length)
        } catch (err) {
          await report($, `refresh failed: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    } finally {
      scanning = null
    }
  })()
  quiet(scanning)
}

async function report($: EngineInterface, text: string): Promise<void> {
  await patch($, () => ({ status: text })).catch(() => $.ui.toast(text))
}

function feedsApp(app: AppInfo, path: string): boolean {
  if (!path.startsWith(app.dir + '/')) return false
  const rel = path.slice(app.dir.length + 1)
  return (
    APP_INPUTS.includes(rel) ||
    /^rayfin\/functions\/[^/]+\.(ts|js)$/.test(rel) ||
    /^rayfin\/functions-python\/[^/]+\/definition\.json$/.test(rel)
  )
}

async function refreshApps($: EngineInterface, paths: string[]): Promise<string[]> {
  const at = epoch
  const root = (await get($)).root
  for (let i = 0; i < 5; i++) {
    const cur = await $.state.get(APPS)
    const apps = cur.value ?? []
    const dirs = new Set<string>()
    for (const p of paths) {
      const app = appOf(apps, p)
      if (app && feedsApp(app, p)) dirs.add(app.dir)
    }
    if (dirs.size === 0) return []
    const fresh = await Promise.all(apps.map(a => (dirs.has(a.dir) ? appAt($, a.dir, a.cli.split('+')) : a)))
    const now = await get($)
    if (epoch !== at || now.root !== root) return []
    const changed = fresh.filter((a, j) => JSON.stringify(a) !== JSON.stringify(apps[j])).map(a => a.dir)
    if (changed.length === 0) return []
    if ((await $.state.set(APPS, fresh, { ifVersion: cur.version })).isSet) return changed
  }
  return []
}

async function touched($: EngineInterface, paths: string[]): Promise<void> {
  const markers = paths.filter(p => markerOf(p) !== null)
  const sync = markers.length ? await syncApps($) : { added: [], changed: await refreshApps($, paths) }
  const apps = await getApps($)
  const within = paths.filter(p => appOf(apps, p))
  if (within.length === 0 && sync.added.length === 0) return
  await revealPaths($, within)
  await loadDirs($, [...new Set(within.map(dirname))].filter(d => appOf(apps, d)))
  await refreshGit($)
  await flash($, [...sync.added, ...within])
}

async function openTarget($: EngineInterface, target: string): Promise<void> {
  const { argv, init } = openCommand(await osName($), target)
  try {
    const run = await $.process.run(argv, init)
    if (run.exitCode !== 0) $.ui.toast(`could not open ${target} with ${argv[0]}: ${run.stderr.trim().split('\n')[0] || `exit ${run.exitCode}`}`)
  } catch {
    $.ui.toast(`could not open ${target} with ${argv[0]}`)
  }
}

async function toggle($: EngineInterface, n: FileNode): Promise<void> {
  if (n.kind === 'dir' && !n.loaded) await loadDirs($, [n.id])
  await patch($, t => {
    const open = new Set(t.expanded)
    if (n.kind === 'dir') open.has(n.id) ? open.delete(n.id) : open.add(n.id)
    return { expanded: [...open], cursor: n.id, selected: n.kind === 'dir' && n.parent !== t.root ? t.selected : n.id }
  })
}

async function press($: EngineInterface, n: FileNode): Promise<void> {
  const now = await $.clock.now()
  const isDouble = lastPress.key === n.id && now - lastPress.at < DOUBLE_MS
  lastPress = { key: isDouble ? '' : n.id, at: now }
  if (!isDouble) await toggle($, n)
  else if (n.kind === 'dir') await navigate($, n)
  else await openNode($, n, false)
}

async function navigate($: EngineInterface, n: FileNode): Promise<void> {
  if (!n.loaded) await loadDirs($, [n.id])
  await patch($, cur => ({ top: n.id, cursor: n.id, scroll: null, expanded: [...new Set([...cur.expanded, n.id])] }))
}

async function goUp($: EngineInterface): Promise<void> {
  await patch($, cur => {
    const n = cur.nodes.find(x => x.id === topOf(cur))
    return { top: n && n.parent !== cur.root ? n.parent : '', cursor: n?.id ?? cur.cursor, scroll: null }
  })
}

async function goHome($: EngineInterface): Promise<void> {
  await patch($, () => ({ top: '', scroll: null }))
}

async function openNode($: EngineInterface, n: FileNode, web: boolean): Promise<void> {
  const app = (await getApps($)).find(a => a.dir === n.id)
  await openTarget($, app ? (web ? app.portal || app.dir : app.dir) : n.id)
}

function faint(hex: string): string {
  const v = parseInt(hex.slice(1), 16)
  const ch = (shift: number) => Math.round(0x26 + (((v >> shift) & 255) - 0x26) * 0.3)
  return `#${[16, 8, 0].map(x => ch(x).toString(16).padStart(2, '0')).join('')}`
}

async function fontState($: EngineInterface, charset: string, name: string): Promise<'ok' | 'stale' | 'missing'> {
  try {
    const out = (await $.process.run(['sh', '-c', FONT_SCRIPT, 'sh', charset, name], { timeoutMs: 5_000 })).stdout.trim()
    return out === 'stale' || out === 'missing' ? out : 'ok'
  } catch {
    return 'missing'
  }
}

function shortPath(path: string): string {
  return home && (path === home || path.startsWith(`${home}/`)) ? `~${path.slice(home.length)}` : path
}

function jumpTo(t: FileTree, query: string): Partial<FileTree> {
  const q = query.trim().toLowerCase()
  const hits = q ? t.nodes.filter(n => n.name.toLowerCase().includes(q)).slice(0, 10) : []
  const open = new Set(t.expanded)
  for (const n of hits) for (const a of ancestorsOf(n.id, t.root)) open.add(a)
  const top = topOf(t)
  const first = hits[0]?.id
  return { query: '', expanded: [...open], cursor: first ?? t.cursor, scroll: null, top: first && top && !inside(top, first) ? '' : top }
}

let lastDetect = 0

async function detectGlyphs($: EngineInterface): Promise<void> {
  lastDetect = await $.clock.now()
  if (remote) {
    detected = 'nerd'
    return
  }
  const nerd = (await fontState($, 'f04eb', 'Nerd')) === 'ok'
  detected = nerd && (await fontState($, 'f2002', 'FabricSymbols')) === 'ok' ? 'fabric' : nerd ? 'nerd' : 'plain'
}

async function startup($: EngineInterface, detect: boolean): Promise<void> {
  if (detect) {
    remote = Boolean((await $.env.get('SSH_CONNECTION')) || (await $.env.get('SSH_TTY')))
    await detectGlyphs($)
  }
  try {
    await $.state.set(THEME, parseTheme(String(await $.fs.read(`${(await $.env.get('HOME')) ?? ''}/${THEME_FILE}`))))
  } catch {
    await $.state.set(THEME, DEFAULT_THEME)
  }
  const t = await get($)
  if (t.flashOn || t.work) await patch($, () => ({ flash: [], flashDim: [], flashOn: false, flashTones: {}, work: null }))
  const cwd = await cwdOf($)
  if (!t.root) await put($, () => emptyTree(cwd))
  const apps = await discover($, t.root || cwd)
  if (apps.length) {
    if (!t.root || t.nodes.length === 0) await reset($, t.root || cwd, false, apps)
    else await openPane($, { id: PANE, title: titleOf(t.root || cwd) })
  }
}

export const register: Register = (on, options) => {
  glyphSetting = typeof options?.glyphs === 'string' ? options.glyphs : 'auto'
  follow = options?.follow !== 'off'
  fontHint = options?.fontHint !== 'off'
  on('session.start', async ($, e, next) => {
    useDrives((await $.env.get('OS')) === 'Windows_NT')
    home = posix(((await $.env.get('HOME')) || (await $.env.get('USERPROFILE')) || '').replace(/[\\/]+$/, ''))
    hinted = false
    fellBack = false
    closed = false
    noDock = false
    await $.command.register({ name: PANE, description: 'Show the Fabric apps under a folder; args: [path]' })
    quiet(startup($, true))
    return next(e)
  })

  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    quiet(startup($, false))
    return next(e)
  })

  on('command.run', { command: PANE }, async ($, e) => {
    const terminal = (await $.session.surfaces()).includes('terminal')
    if (terminal && e.presentation && !e.presentation.isFullscreen) return { text: `The Fabric app pane shows in the sidebar, which needs the fullscreen layout. Run /tui fullscreen, then /${PANE}.` }
    if (terminal && e.presentation && e.presentation.columns < 110) return { text: `The Fabric app pane shows in the sidebar, which needs a terminal at least 110 columns wide. Widen it, then run /${PANE}.` }
    noDock = false
    const raw = (e.args ?? '').trim()
    const arg = /^["']/.test(raw) ? (tokenize(raw)[0] ?? '') : raw
    const cwd = await cwdOf($)
    const root = arg ? resolvePath(cwd, arg) : cwd
    if (arg) {
      const kind = await $.fs.stat(root).then(
        st => st.kind,
        () => 'missing',
      )
      if (kind !== 'dir') return { text: kind === 'missing' ? `No folder at ${shortPath(root)}.` : `${shortPath(root)} is not a folder.` }
    }
    await reset($, root, true)
    const apps = await getApps($)
    return { text: `${apps.length} Fabric app${apps.length === 1 ? '' : 's'} under ${shortPath(root)}.` }
  })

  on('tool.call', async ($, e, next) => {
    if (e.tool !== 'Edit' && e.tool !== 'Write' && e.tool !== 'NotebookEdit' && e.tool !== 'Bash') return next(e)
    const cwd = await cwdOf($)
    const calls = e.tool === 'Bash' ? cliCalls(e.command, cwd, home) : []
    const known = e.tool === 'Bash' ? await getApps($) : []
    const since = await sinceNow($, e.tool === 'Bash' && (calls.length > 0 || known.length > 0))
    const busy = calls.length && !closed && !noDock && (await get($)).root ? (calls.some(deploys) ? 'teal' : 'orange') : ''
    if (busy) await startWork($, busy, touchedBy(known, calls))
    let result: Awaited<ReturnType<typeof next>>
    try {
      result = await next(e)
    } catch (err) {
      quiet(dropMarks($, [since.mark]))
      if (busy) await endWork($)
      throw err
    }
    const record = e.tool === 'Bash' && !result.deny && !result.isError && result.result && typeof result.result === 'object' ? (result.result as { backgroundTaskId?: unknown }) : undefined
    const task = typeof record?.backgroundTaskId === 'string' ? record.backgroundTaskId : ''
    if (result.deny || (result.isError && e.tool !== 'Bash')) {
      quiet(dropMarks($, [since.mark]))
      if (busy) await endWork($)
      return result
    }
    const t = await get($)
    if (e.tool === 'Bash') {
      const used = calls.filter(mutates)
      const usedCli = used.length > 0
      if (usedCli && !t.root) await reset($, cwd)
      const deployed = used.find(deploys)
      const job: Job = { since, usedCli, deploy: Boolean(deployed), deployDir: deployed?.cwd ?? '', busy: Boolean(busy) }
      if (!usedCli && (await getApps($)).length === 0) {
        quiet(dropMarks($, [since.mark]))
        if (task && busy) running.set(task, { ...job, usedCli: false })
        else if (busy) await endWork($)
      } else if (task) running.set(task, job)
      else scheduleScan($, job)
    } else {
      const file =
        'file_path' in e && typeof e.file_path === 'string'
          ? e.file_path
          : 'notebook_path' in e && typeof e.notebook_path === 'string'
            ? e.notebook_path
            : ''
      if (file) quiet(touched($, [posix(file)]))
    }
    return result
  })

  on('skill.prompt', async ($, e, next) => {
    const result = await next(e)
    if (CLIS.some(c => c.skills.some(s => e.skill === s || e.skill.endsWith(`:${s}`)))) {
      quiet(
        (async () => {
          const t = await get($)
          const cwd = await cwdOf($)
          if (!t.root || t.nodes.length === 0) await reset($, t.root || cwd)
          else await openPane($, { id: PANE, title: titleOf(t.root) })
        })(),
      )
    }
    return result
  })

  on('ui.message', async ($, e, next) => {
    if (e.requestId !== PANE || e.element !== 'rows' || !e.data || typeof e.data !== 'object') return next(e)
    const data = e.data as { press?: unknown; key?: unknown; ctrl?: unknown; shift?: unknown; scrollTo?: unknown; copy?: unknown }
    const t = await get($)
    if (typeof data.scrollTo === 'number') {
      const to = Math.round(Math.max(0, Math.min(1, data.scrollTo)) * view.max)
      if (to !== t.scroll) await patch($, () => ({ scroll: to }))
      return {}
    }
    if (typeof data.copy === 'string') {
      await copyOf($, data.copy, t.root, Boolean(data.shift), e.surface)
      return {}
    }
    if (typeof data.press === 'string') {
      const n = t.nodes.find(x => x.id === data.press)
      if (!n) return {}
      if (t.scroll === null) await patch($, () => ({ scroll: view.from }))
      if (data.ctrl || data.shift) await openNode($, n, Boolean(data.ctrl))
      else await press($, n)
      return {}
    }
    if (typeof data.key !== 'string') return {}
    const top = topOf(t)
    const rows = visibleRows(t, top)
    const at = rows.findIndex(r => r.node.id === t.cursor)
    const cur = rows[at]?.node
    const move = (d: number) => {
      const target = rows[Math.max(0, Math.min(rows.length - 1, (at < 0 ? 0 : at) + d))]
      return target ? patch($, () => ({ cursor: target.node.id, scroll: null })) : Promise.resolve()
    }
    if (data.key === 'up' || data.key === 'k') await move(-1)
    else if (data.key === 'down' || data.key === 'j') await move(1)
    else if (data.key === 'pageup') await move(-10)
    else if (data.key === 'pagedown') await move(10)
    else if (data.key === 'home') await move(-rows.length)
    else if (data.key === 'end') await move(rows.length)
    else if (cur && (data.key === 'y' || data.key === 'Y')) await copyOf($, cur.id, t.root, data.key === 'Y' || Boolean(data.shift), e.surface)
    else if (cur && (data.key === 'right' || data.key === 'l') && cur.kind === 'dir' && !t.expanded.includes(cur.id)) await toggle($, cur)
    else if (cur && (data.key === 'left' || data.key === 'h')) {
      if (cur.kind === 'dir' && t.expanded.includes(cur.id)) await toggle($, cur)
      else if (cur.parent !== (top || t.root)) await patch($, () => ({ cursor: cur.parent }))
    } else if (cur && data.key === 'return') await (cur.kind === 'file' ? openNode($, cur, false) : toggle($, cur))
    else if (cur && data.key === ' ') await toggle($, cur)
    return {}
  })

  on('ui.close', async ($, e, next) => {
    const result = await next(e)
    if (e.id === PANE && e.origin.kind === 'person') closed = true
    return result
  })

  on('ui.scroll', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const t = await get($)
    const to = Math.max(0, Math.min(view.max, (t.scroll ?? view.from) + Math.sign(e.by) * Math.max(3, Math.abs(e.by))))
    if (to !== t.scroll) await patch($, () => ({ scroll: to }))
    return {}
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind === 'task-notification') {
      for (const [task, job] of running) {
        if (!e.text.includes(task)) continue
        running.delete(task)
        if (job.usedCli || (await getApps($)).length > 0) scheduleScan($, job)
        else {
          quiet(dropMarks($, [job.since.mark]))
          if (job.busy) await endWork($)
        }
      }
    }
    const t = await get($)
    const lines: string[] = []
    const app = t.selected ? appOf(await getApps($), t.selected) : undefined
    if (app) {
      lines.push(
        t.selected === app.dir
          ? 'The user has this Fabric app selected in the Fabric app pane; "this" or "it" likely refers to it.'
          : `The user has this file of a Fabric app selected in the Fabric app pane; "this" or "it" likely refers to it: ${t.selected}`,
        `app: ${app.title} (${app.cli}) at ${app.dir}`,
      )
      if (app.item) lines.push(`deployed item: workspace ${app.workspace}, item ${app.item}`)
    }
    const hint = closed || noDock ? '' : fontNote()
    const context = [...(lines.length ? [lines.join('\n')] : []), ...(hint ? [hint] : [])]
    return context.length ? next({ ...e, context: [...(e.context ?? []), ...context] }) : next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    if (e.surface !== 'terminal' && e.surface !== 'desktop') return next(e)
    if (e.surface === 'terminal' && e.props.placement === 'inline') {
      noDock = true
      quiet($.ui.close({ id: PANE }))
      const { Box: Empty } = $.ui.resolve(e)
      return <Empty />
    }
    if (glyphSetting === 'auto' && e.surface === 'terminal' && detected !== 'fabric' && (await $.clock.now()) - lastDetect > 60_000) {
      const was = detected
      quiet(
        detectGlyphs($).then(() => {
          if (detected !== was) $.ui.invalidate('ui.render')
        }),
      )
    }
    const tier = tierFor(e.surface)
    if (e.surface === 'terminal' && tier === 'plain' && glyphSetting === 'auto') fellBack = true
    const { Box, Text, Button, Input, Client } = $.ui.resolve(e)
    const t = await get($)
    const apps = await getApps($)
    shownApps = apps
    const appByDir = new Map(apps.map(a => [a.dir, a]))
    const theme: Theme = (await $.state.get(THEME)).value ?? DEFAULT_THEME
    const now = await $.clock.now()
    const work = t.work && (t.work.until ? now < t.work.until : now - t.work.at < BUSY_MAX_MS) ? t.work : null
    const shining = [...(t.flashOn ? t.flash : []), ...(work ? work.lit : [])]
    const bright = new Set(shining)
    const dimmed = new Set([...(t.flashOn ? t.flashDim : []), ...(work ? work.dim : [])].filter(id => !bright.has(id)))
    const toneOf = (id: string) => (work && (work.lit.includes(id) || work.dim.includes(id)) ? work.tone : (t.flashTones[id] ?? 'orange'))
    const ignored = new Set(t.ignored)
    const untracked = new Set(t.untrackedDirs)
    const width = Math.max(24, e.props.bodyColumns)
    const rows = itemsOf(t, apps)
    const room = Math.max(5, (e.props.scroll?.bodyRows ?? 40) - 3 - (t.selected ? 1 : 0))
    const isLit = (id: string) => bright.has(id) || dimmed.has(id)
    const focus = follow && shining.length ? (shining[shining.length - 1] ?? t.cursor) : t.cursor
    const at = Math.max(0, rows.findIndex(r => r.node.id === focus))
    const lit = follow && (bright.size > 0 || dimmed.size > 0) ? rows.findIndex(r => isLit(r.node.id)) : -1
    const fits = lit >= 0 && at - lit < room - 2
    const base = Math.max(0, Math.min(Math.max(0, rows.findIndex(r => r.node.id === t.cursor)) - Math.floor(room / 2), rows.length - room))
    const inView = lit >= base && at < base + room
    const flashing = lit >= 0 && !inView
    const nearBottom = (span: number) => Math.max(0, Math.min(fits ? Math.min(Math.max(0, lit - 1), at - span + 3) : at - span + 3, rows.length - span))
    let from = flashing ? nearBottom(room) : base
    const cap = Math.max(1, Math.floor(room / 3))
    const chain = new Set(flashing ? ancestorsOf(focus, t.root) : [])
    const keep = (id: string) => chain.has(id) || isLit(id)
    let pinned = flashing ? rows.slice(0, from).filter(r => keep(r.node.id)).slice(-cap) : []
    if (pinned.length) {
      from = nearBottom(Math.max(3, room - pinned.length - 1))
      pinned = rows.slice(0, from).filter(r => keep(r.node.id)).slice(-cap)
    }
    const max = Math.max(0, rows.length - room)
    if (t.scroll !== null) {
      from = Math.max(0, Math.min(t.scroll, max))
      pinned = []
    }
    const shown = rows.slice(from, from + room - pinned.length - (pinned.length ? 1 : 0))
    view = { from, max, ids: [...pinned, ...shown].map(r => r.node.id) }

    const sourceSpec = (r: Item): RowSpec => {
      const src = r.source
      if (!src || src.kind === 'none' || src.kind === 'error')
        return {
          id: '',
          left: clean([{ t: '  '.repeat(r.depth + 1) }, { t: fit(src?.name ?? '', Math.max(4, width - r.depth * 2 - 4)), c: src?.kind === 'error' ? theme.urgent : theme.muted, i: true }]),
          right: [],
        }
      const g = glyphFor(r.child ? (src.kind === 'UserDataFunction' ? 'function' : 'table') : src.kind, tier)
      const note = r.child ? '' : src.note
      const cols = Math.max(4, width - r.depth * 2 - 6 - (note ? note.length + 1 : 0))
      const name = r.node.name.length > cols ? r.node.name.slice(0, cols - 1) + '…' : r.node.name
      return {
        id: '',
        left: clean([{ t: '  '.repeat(r.depth + 1) }, { t: g.char + ' ', c: g.color }, { t: name, c: r.child ? theme.fg || undefined : g.color, b: !r.child }]),
        right: note ? [{ t: ` ${note}`, c: theme.muted }] : [],
      }
    }

    const rowSpec = (r: Item): RowSpec => {
      if (r.source) return sourceSpec(r)
      const n = r.node
      const app = appByDir.get(n.id)
      const status = t.git[n.id] ?? (underAny(dirname(n.id), untracked, t.root) ? '?' : undefined)
      const isIgnored = !status && underAny(n.id, ignored, t.root)
      const gitColor = status === 'D' || status === 'U' ? theme.urgent : status ? (GIT_COLOR[status] ?? theme.muted) : undefined
      const isBright = bright.has(n.id)
      const isDim = !isBright && dimmed.has(n.id)
      const glyph = app ? glyphFor('app', tier).char : tier === 'plain' ? plainIcon(n, r.open) : fileIcon(n, r.open, n.kind === 'dir' && gitTops.has(n.id))
      const iconColor = app
        ? APP_COLOR
        : isIgnored
          ? theme.muted
          : (gitColor ?? (n.hidden ? theme.muted : n.kind === 'dir' ? theme.accent : theme.muted))
      const nameColor = app ? APP_COLOR : isIgnored ? theme.muted : (gitColor ?? (n.hidden ? theme.muted : theme.fg || undefined))
      const loc = t.diff[n.id]
      const meta = app ? `${app.cli}${app.item ? ' deployed' : ' local'}` : loc ? '' : n.kind === 'file' ? stamp(n.mtime) : ''
      const locText = loc ? `${loc[0] ? ` +${loc[0]}` : ''}${loc[1] ? ` -${loc[1]}` : ''}` : ''
      const c = n.kind === 'dir' ? t.counts[n.id] : undefined
      const dirCounts: Seg[] = c
        ? [
            ...(c[0] ? [{ t: ` ?:${c[0]}`, c: GIT_COLOR['?'] ?? ADD_COLOR }] : []),
            ...(c[1] ? [{ t: ` M:${c[1]}`, c: GIT_COLOR.M ?? '#e5c07b' }] : []),
            ...(c[2] ? [{ t: ` D:${c[2]}`, c: theme.urgent }] : []),
          ]
        : []
      const countsText = dirCounts.map(x => x.t).join('')
      const badge = app || dirCounts.length ? '' : status ? ` ${status}` : isIgnored ? (tier === 'plain' ? ' ⊘' : ' \u{f05e}') : '  '
      const cols = Math.max(4, width - r.depth * 2 - 6 - (meta ? meta.length + 1 : 0) - locText.length - badge.length - countsText.length)
      const name = n.name.length > cols ? n.name.slice(0, cols - 1) + '…' : n.name
      const caret = n.kind === 'dir' ? (tier === 'plain' ? (r.open ? '▾' : '▸') : r.open ? CHEVRON_OPEN : CHEVRON_CLOSED) + ' ' : '  '
      const left: Seg[] = [
        { t: '  '.repeat(r.depth) },
        { t: caret, c: theme.muted },
        isBright || isDim ? { t: glyph + ' ', sh: toneOf(n.id), dim: isDim, one: true } : { t: glyph + ' ', c: iconColor },
      ]
      if (isBright || isDim) left.push({ t: name, sh: toneOf(n.id), dim: isDim, b: isBright })
      else left.push({ t: name, c: nameColor, b: Boolean(app) || n.id === t.selected, s: status === 'D' && n.kind !== 'dir' })
      const right: Seg[] = []
      if (meta) right.push({ t: ` ${meta}`, c: app?.item ? '#98c379' : theme.muted })
      if (loc && loc[0] > 0) right.push({ t: ` +${loc[0]}`, c: ADD_COLOR })
      if (loc && loc[1] > 0) right.push({ t: ` -${loc[1]}`, c: DEL_COLOR })
      right.push(...dirCounts)
      if (badge) right.push({ t: badge, c: status ? gitColor : theme.muted, b: true })
      return { id: n.id, left: clean(left), right: clean(right) }
    }

    const note = (text: string): RowSpec => ({ id: '', left: [{ t: text, c: theme.muted }], right: [] })
    const specs: RowSpec[] = [...pinned.map(rowSpec), ...(pinned.length > 0 ? [note('  ⋮')] : []), ...shown.map(rowSpec)]
    const barSize = Math.max(1, Math.round((specs.length * shown.length) / Math.max(1, rows.length)))
    const bar =
      rows.length > shown.length + pinned.length
        ? { pos: max ? Math.round((from / max) * (specs.length - barSize)) : 0, size: barSize, thumb: theme.accent, track: theme.muted }
        : undefined
    const icon = (nerd: string, fallback: string) => (tier === 'plain' ? fallback : nerd)
    const topNode = t.nodes.find(n => n.id === topOf(t))

    return (
      <Box flexDirection="column" minHeight={Math.max(1, e.props.scroll?.bodyRows ?? 1)}>
        <Box flexDirection="row">
          <Text bold color={theme.accent} wrap="truncate-start">
            {topNode ? topNode.name : t.root.split('/').pop() || t.root}
            {`  ${apps.length} app${apps.length === 1 ? '' : 's'}`}
          </Text>
          <Box flexGrow={1} />
          <Box flexDirection="row" gap={2}>
            {topNode && <Button key="up" plain dimColor label={icon('\u{f005d}', '↑')} onPress={() => quiet(goUp($))} />}
            {topNode && <Button key="home" plain dimColor label={icon('\u{f02dc}', '⌂')} onPress={() => quiet(goHome($))} />}
            <Button
              key="rescan"
              plain
              dimColor
              label={icon('\u{f0450}', '↻')}
              onPress={() =>
                quiet(
                  (async () => {
                    await syncApps($)
                    const cur = await get($)
                    await loadDirs($, cur.nodes.filter(n => n.kind === 'dir' && n.loaded).map(n => n.id))
                    await refreshGit($)
                  })(),
                )
              }
            />
            <Button
              key="hidden"
              plain
              dimColor={!t.showHidden}
              label={tier === 'plain' ? (t.showHidden ? '◉' : '○') : t.showHidden ? '\u{f0208}' : '\u{f0209}'}
              onPress={() => quiet(patch($, cur => ({ showHidden: !cur.showHidden })))}
            />
            <Button key="collapse" plain dimColor label={icon('\u{eac5}', '⊟')} onPress={() => quiet(patch($, () => ({ expanded: [] })))} />
            {t.selected && <Button key="unselect" plain label={icon('\u{f0156}', '✕')} onPress={() => quiet(patch($, () => ({ selected: '' })))} />}
            <Text> </Text>
          </Box>
        </Box>
        <Box flexDirection="row">
          <Box flexGrow={1}>
            {work && !t.query ? (
              <Client key="working" module="./rows.tsx" props={{ rows: [{ id: '', left: [{ t: WORKING, sh: work.tone }], right: [] }], active: '', activeBg: '', hoverBg: '', tones: TONES } satisfies RowsProps} />
            ) : (
              <Input
                key="q"
                label="/ "
                placeholder="search"
                submitLabel="jump"
                autoFocus
                value={t.query}
                onInput={(v: string) => quiet(patch($, () => ({ query: v })))}
                onSubmit={(v: string) => quiet(patch($, cur => jumpTo(cur, v)))}
              />
            )}
          </Box>
          {t.query ? <Button key="clearq" plain dimColor label={icon('\u{f0156}', '×')} onPress={() => quiet(patch($, () => ({ query: '' })))} /> : null}
        </Box>
        {t.status ? (
          <Text color={theme.urgent} wrap="truncate-end">
            {t.status}
          </Text>
        ) : null}
        {apps.length === 0 && (
          <Text color={theme.muted}>
            no {CLIS.map(c => c.name).join(' or ')} app here yet; {CLIS.map(c => c.start).join(' or ')} adds one
          </Text>
        )}
        <Client
          key="rows"
          module="./rows.tsx"
          props={{ rows: specs, active: t.cursor, activeBg: theme.selection, hoverBg: faint(theme.selection), tones: TONES, ...(bar ? { bar } : {}) } satisfies RowsProps}
        />
        <Box flexGrow={1} />
        {t.selected && (
          <Text dimColor wrap="truncate-start">
            selected: {t.selected.startsWith(t.root + '/') ? t.selected.slice(t.root.length + 1) : shortPath(t.selected)}
          </Text>
        )}
      </Box>
    )
  })
}
