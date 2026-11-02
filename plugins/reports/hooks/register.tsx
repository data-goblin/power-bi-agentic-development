import { type EngineInterface, type Register, type Timer, update } from 'claude-code'
import { LINUX_LAUNCH as LAUNCH, openCommand } from './open'

import type { Explorer, Target, TreeNode } from '../types'
import { glyph, type Tier, visualLabel } from './icons'
import type { RowSpec, RowsProps, Seg } from './rows'
import { FABRIC_SVG } from './svg-data'
import type { ZoneProps } from './zone'
import { ancestors, diff, empty, type Row, visible } from './tree'
import { idOf, reportUrl, workspaceUrl } from './fabric'
import { binOf, type Invocation, invocations, join, pbirReport, posix, targetLabel, tokenize, useDrives, useHome } from './parse'
import { loadReport, modelRef, reportDetail } from './report'
import { pbirTouched } from './touch'

const STATE = { plugin: 'reports', key: 'explorer' } as const
const TREE = { plugin: 'reports', key: 'tree' } as const
const PANE = 'report-pane'
const TITLE = 'Report'
const TITLE_GLYPH = { fabric: 0xf202a, nerd: '\u{f0127}', plain: '▣' }
const TITLE_COLOR = '#fbbf24'
const HINT = 'waiting for a pbir command, or /report-pane <path.Report>'
const WINDOW = 400
const DETAIL_ROWS = 12
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
const MUTED = '#6e6e7a'
const PROPS = 'props:toggle'
const ROW_PX = 24
const SVG_NS = 'http://www.w3.org/2000/svg'
const SVG_KIND: Record<string, string> = { report: 'Report', 'semantic model': 'SemanticModel' }
const FONT_SCRIPT =
  'f=; if command -v fc-list >/dev/null 2>&1; then f=$(fc-list ":charset=$1" file 2>/dev/null | grep -vi lastresort | head -n1 | cut -d: -f1); fi; ' +
  '[ -n "$f" ] || for g in "$HOME"/Library/Fonts/*"$2"* /Library/Fonts/*"$2"* "$HOME"/.local/share/fonts/*"$2"*; do [ -f "$g" ] && { [ "$2" != Nerd ] || LC_ALL=C grep -aqE "Nerd Fonts (3\\.([2-9]|[1-9][0-9])|[4-9]|[1-9][0-9]+)\\." "$g"; } && { f=$g; break; }; done; ' +
  '[ -n "$f" ] || { echo missing; exit 0; }; m=$(stat -c %Z "$f" 2>/dev/null || stat -f %c "$f"); p=$PPID; ' +
  'while [ -n "$p" ] && [ "$p" -gt 1 ]; do c=$(ps -o comm= -p "$p" 2>/dev/null); c=$(basename "$c" 2>/dev/null | tr -d " "); case "$c" in ' +
  'ghostty|kitty|alacritty|Alacritty|foot|footclient|wezterm-gui|konsole|gnome-terminal-|xterm|urxvt|st|Terminal|iTerm2) ' +
  'e=$(ps -o etime= -p "$p" 2>/dev/null | awk -F\'[-:]\' \'{n=NF; s=$n+60*$(n-1); if (n>2) s+=3600*$(n-2); if (n>3) s+=86400*$(n-3); print s}\'); [ -n "$e" ] && [ $(( $(date +%s) - e )) -lt "$m" ] && echo stale || echo ok; exit 0;; esac; ' +
  'p=$(ps -o ppid= -p "$p" 2>/dev/null | tr -d " "); done; echo ok'
const NERD_PROBE = 'f04eb eac5 ebff ebf6 ec01'

let lastPress = { key: '', at: 0 }
const views: Record<string, { from: number; max: number; rows: number; room: number }> = {}
let detected: Tier = 'nerd'
let glyphSetting = 'auto'
let fontHint = true
let hinted = false
let fellBack = false
let follow = true
let pbirBin = 'pbir'
let blink: Timer | null = null
let runs = 0
let closed = false
let noDock = false
let inflight: Promise<void> | null = null
let queued: Promise<void> | null = null
let platform: Promise<'linux' | 'darwin' | 'win32'> | null = null
let reportLinks = 'embed'
let tenantId = ''
let propsOpen = false
let nativeScroll = false
const modelLinks = new Map<string, { pbir: string; url: string; lines: string[] }>()
let urlLookup: Promise<void> | null = null
let optimistic: { target: Target; cursor: string; selected: string; expanded: string[]; detail: string[] } | null = null
let seen: { ex: Explorer; nodes: TreeNode[] } | null = null

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

function quiet(p: Promise<unknown>): void {
  void p.catch(() => undefined)
}

function jumpTo(ex: Explorer, nodes: TreeNode[], query: string): Partial<Explorer> {
  const q = query.trim().toLowerCase()
  const hits = q ? nodes.filter(n => n.name.toLowerCase().includes(q) || n.note.toLowerCase().includes(q)).slice(0, 10) : []
  const open = new Set(ex.expanded)
  for (const n of hits) for (const a of ancestors(nodes, n.id)) open.add(a)
  return { query: '', expanded: [...open], cursor: hits[0]?.id ?? ex.cursor, scroll: {} }
}

async function copyOf($: EngineInterface, text: string, surface?: string): Promise<void> {
  const done = await $.ui.copy({ text, ...(surface ? { surface: surface as 'terminal' } : {}) })
  $.ui.toast(done.isCopied ? `Copied ${text}` : 'Could not copy')
}

function clean(segs: Seg[]): Seg[] {
  for (const seg of segs) for (const k of Object.keys(seg) as (keyof Seg)[]) if (seg[k] === undefined) delete seg[k]
  return segs
}

async function launch($: EngineInterface, argv: string[]): Promise<void> {
  try {
    const run = await $.process.run(['sh', '-c', LAUNCH, 'sh', ...argv], { timeoutMs: 10_000 })
    if (run.exitCode !== 0) $.ui.toast(`could not start ${argv[0] ?? ''} (exit ${run.exitCode})`)
  } catch {
    $.ui.toast(`could not start ${argv[0] ?? ''}`)
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

function cmdq(arg: string): string {
  return /^[\w@%+=:,./\\-]+$/.test(arg) ? arg : `"${arg.replace(/"/g, '""')}"`
}

function shq(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`
}

async function terminal($: EngineInterface, linux: string[], cmd: string[], cwd = ''): Promise<void> {
  const line = cmd.map(shq).join(' ')
  const os = await osName($)
  if (os === 'linux') return launch($, ['xdg-terminal-exec', ...linux])
  const argv =
    os === 'darwin'
      ? ['osascript', '-e', `tell application "Terminal" to do script "${(cwd ? `cd ${shq(cwd)} && ${line}` : line).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`, '-e', 'tell application "Terminal" to activate']
      : ['cmd', '/c', 'start', '', 'cmd', '/k', cwd ? `cd /d "${cwd.replace(/\//g, '\\')}" && ${cmd.map(cmdq).join(' ')}` : cmd.map(cmdq).join(' ')]
  try {
    const run = await $.process.run(argv, { timeoutMs: 10_000 })
    if (run.exitCode !== 0) $.ui.toast(`could not start ${argv[0] ?? ''} (exit ${run.exitCode})`)
  } catch {
    $.ui.toast(`could not start ${argv[0] ?? ''}`)
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

async function detectGlyphs($: EngineInterface): Promise<void> {
  if ((await $.env.get('SSH_CONNECTION')) || (await $.env.get('SSH_TTY'))) {
    detected = 'nerd'
    return
  }
  const [nerd, fabric] = (await Promise.all([fontState($, NERD_PROBE, 'Nerd'), fontState($, 'f2621', 'FabricSymbols')])).map(s => s === 'ok')
  detected = nerd && fabric ? 'fabric' : nerd ? 'nerd' : 'plain'
}

function fontNote(): string {
  if (!fontHint || hinted || !fellBack) return ''
  hinted = true
  return 'Tell user once: Report pane icons need github.com/data-goblin/fabric-nf plus a Nerd Font. Plugin option fontHint=off disables this.'
}

function tierFor(surface: string): Tier {
  if (glyphSetting === 'fabric' || glyphSetting === 'nerd' || glyphSetting === 'plain') return glyphSetting
  return surface === 'desktop' ? 'plain' : detected
}

function titleGlyph(tier: Tier): string {
  return tier === 'fabric' ? String.fromCodePoint(TITLE_GLYPH.fabric) : tier === 'nerd' ? TITLE_GLYPH.nerd : TITLE_GLYPH.plain
}

function titleFor(target: Target | null): string {
  return target ? targetLabel(target) : TITLE
}

async function get($: EngineInterface): Promise<Explorer> {
  return { ...empty(), ...(await $.state.get(STATE)).value }
}

async function nodesOf($: EngineInterface, target: Target | null): Promise<TreeNode[]> {
  const tree = (await $.state.get(TREE)).value
  return tree && sameTarget(tree.target, target) ? tree.nodes : []
}

async function setTree($: EngineInterface, target: Target, nodes: TreeNode[]): Promise<TreeNode[] | null> {
  for (let i = 0; i < 20; i++) {
    if (!sameTarget((await get($)).target, target)) return null
    const cur = await $.state.get(TREE)
    const before = cur.value && sameTarget(cur.value.target, target) ? cur.value.nodes : []
    const done = await $.state.set(TREE, { target, nodes }, { ifVersion: cur.version })
    if (done.isSet) return before
  }
  return null
}

async function put($: EngineInterface, fn: (ex: Explorer) => Explorer): Promise<void> {
  await update($, STATE, cur => fn({ ...empty(), ...cur }))
}

function patch($: EngineInterface, fn: (ex: Explorer) => Partial<Explorer>) {
  return put($, ex => ({ ...ex, ...fn(ex) }))
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

async function light($: EngineInterface, ids: string[], tone: string, running: boolean, run = ''): Promise<string> {
  const unique = [...new Set(ids)]
  const ex = await get($)
  if (run && ex.work && ex.work.run !== run) return ''
  if (!running && unique.length === 0) {
    if (run) await settle($, run)
    return ''
  }
  const mine = run || `${++runs}`
  blink?.cancel()
  blink = null
  const at = await $.clock.now()
  const nodes = await nodesOf($, ex.target)
  let kept = false
  await patch($, cur => {
    if (run && cur.work && cur.work.run !== run) return {}
    kept = true
    const byId = new Map(nodes.map(n => [n.id, n]))
    const open = new Set(cur.expanded)
    const dim = new Set<string>()
    for (const id of unique) {
      const chain = ancestors(nodes, id, byId)
      if (!chain.some(a => !open.has(a))) continue
      for (const a of chain) {
        if (!open.has(a)) dim.add(a)
        if (follow) open.add(a)
      }
    }
    for (const id of unique) dim.delete(id)
    const root = rootOf(cur, nodes)
    const away = follow && root !== '' && unique.some(id => id !== root && !ancestors(nodes, id, byId).includes(root))
    const next: Explorer = { ...cur, expanded: [...open], root: away ? '' : cur.root }
    const scroll = follow ? heldInView(next, nodes, [...unique, ...dim], unique[unique.length - 1] ?? '') : cur.scroll
    return { work: { run: mine, tone, running, at }, flash: unique, flashDim: [...dim], expanded: next.expanded, scroll, ...(away ? { root: '' } : {}) }
  })
  if (!kept) return ''
  if (!running) {
    blink = $.clock.after(FLASH_MS, () => {
      blink = null
      quiet(settle($, mine))
    })
    if (ex.target && !closed) await openPane($, { id: PANE, title: titleFor(ex.target) })
  }
  return mine
}

async function settle($: EngineInterface, run: string): Promise<void> {
  await patch($, cur => (cur.work?.run === run ? { work: null, flash: [], flashDim: [] } : {}))
}

function rootOf(ex: Explorer, nodes: TreeNode[]): string {
  return ex.root && nodes.some(n => n.id === ex.root) ? ex.root : ''
}

function heldInView(ex: Explorer, nodes: TreeNode[], lit: string[], focus: string): Record<string, number> {
  const rows = visible(ex, nodes, rootOf(ex, nodes))
  const where = (id: string) => rows.findIndex(r => r.node.id === id)
  const first = Math.min(...lit.map(where).filter(i => i >= 0))
  const at = where(focus)
  const out: Record<string, number> = {}
  for (const [surface, from] of Object.entries(ex.scroll)) if (at >= 0 && first >= from && at < from + (views[surface]?.room ?? 0)) out[surface] = from
  return out
}

function anchored(ex: Explorer, before: TreeNode[], after: TreeNode[], expanded: string[]): Record<string, number> {
  const was = visible(ex, before, rootOf(ex, before))
  const now = visible({ ...ex, expanded }, after, rootOf(ex, after))
  const out: Record<string, number> = {}
  for (const [surface, from] of Object.entries(ex.scroll)) {
    const top = was[from]?.node.id
    const at = top ? now.findIndex(r => r.node.id === top) : -1
    out[surface] = at < 0 ? from : at
  }
  return out
}

async function point($: EngineInterface, target: Target | null, opened: 'asked' | 'unasked', fresh = false): Promise<boolean> {
  const moved = !sameTarget((await get($)).target, target)
  if (moved) {
    await put($, cur => ({ ...empty(), target, ...(follow || opened === 'asked' ? {} : { scroll: cur.scroll }) }))
    await $.state.set(TREE, { target, nodes: [] })
  } else if (fresh) await patch($, () => ({ expanded: [], query: '', selected: '', detail: [], cursor: '', changed: [] }))
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
  const nodes = await nodesOf($, (await get($)).target)
  await patch($, cur => {
    const n = nodes.find(x => x.id === cur.root)
    return { root: n?.parent ?? '', cursor: n?.id ?? cur.cursor, scroll: {} }
  })
}

async function goHome($: EngineInterface): Promise<void> {
  await patch($, () => ({ root: '', scroll: {} }))
}

function pressNow($: EngineInterface, id: string): boolean {
  const now = Date.now()
  const isDouble = lastPress.key === id && now - lastPress.at < DOUBLE_MS
  lastPress = { key: isDouble ? '' : id, at: now }
  const n = !isDouble && seen ? seen.nodes.find(x => x.id === id) : undefined
  const t = seen?.ex.target
  if (n && seen && t?.kind === 'local') {
    optimistic = { target: t, ...toggled(seen.ex, seen.nodes, n), detail: reportDetail(n, t.path) }
    $.ui.invalidate('ui.render')
  }
  return isDouble
}

function settlePress($: EngineInterface): void {
  if (!optimistic) return
  optimistic = null
  $.ui.invalidate('ui.render')
}

async function press($: EngineInterface, ex: Explorer, n: TreeNode, isDouble: boolean): Promise<void> {
  try {
    if (isDouble) await openNode($, await get($), n)
    else await select($, ex.target, n)
  } finally {
    settlePress($)
  }
}

async function copyNode($: EngineInterface, id: string, surface: string): Promise<void> {
  const n = (await nodesOf($, (await get($)).target)).find(x => x.id === id)
  if (n) await copyOf($, n.path || n.name, surface)
}

async function keyed($: EngineInterface, key: string, surface: string): Promise<void> {
  const ex = await get($)
  const nodes = await nodesOf($, ex.target)
  const rows = visible(ex, nodes, rootOf(ex, nodes))
  const at = rows.findIndex(r => r.node.id === ex.cursor)
  const cur = rows[at]
  const move = (d: number) => {
    const target = rows[Math.max(0, Math.min(rows.length - 1, (at < 0 ? 0 : at) + d))]
    return target ? patch($, () => ({ cursor: target.node.id, scroll: {} })) : Promise.resolve()
  }
  if (key === 'up' || key === 'k') await move(-1)
  else if (key === 'down' || key === 'j') await move(1)
  else if (key === 'pageup') await move(-10)
  else if (key === 'pagedown') await move(10)
  else if (key === 'home') await move(-rows.length)
  else if (key === 'end') await move(rows.length)
  else if (cur && (key === 'y' || key === 'Y')) await copyOf($, cur.node.path || cur.node.name, surface)
  else if (cur && (key === 'right' || key === 'l') && !cur.leaf && !cur.open) await select($, ex.target, cur.node)
  else if (cur && (key === 'left' || key === 'h')) {
    if (!cur.leaf && cur.open) await patch($, x => ({ expanded: x.expanded.filter(id => id !== cur.node.id) }))
    else if (cur.node.parent) await patch($, () => ({ cursor: cur.node.parent }))
  } else if (cur && (key === ' ' || key === 'space' || key === 'return')) await (key === 'return' && cur.leaf ? openNode($, ex, cur.node) : select($, ex.target, cur.node))
}

async function openNode($: EngineInterface, ex: Explorer, n: TreeNode): Promise<void> {
  if (n.kind === 'semantic model') return openWeb($, ex, n)
  if (n.file) return openUrl($, n.file)
  $.ui.toast('no file for this object')
}

async function openWeb($: EngineInterface, ex: Explorer, n: TreeNode): Promise<void> {
  if (n.kind === 'semantic model') {
    const model = await withBusy($, 'Finding the deployed model…', () => resolveModel($, ex.target))
    if (model.url) await openUrl($, model.url)
    else $.ui.toast(model.why)
    return
  }
  const url = webUrl(ex, n)
  if (url) await openUrl($, url)
  else $.ui.toast('no Fabric link for this report; it opens in Fabric when its folder sits under <workspace>.Workspace')
}

let pending = ''

async function withBusy<T>($: EngineInterface, text: string, fn: () => Promise<T>): Promise<T> {
  pending = text
  $.ui.invalidate('ui.render')
  try {
    return await fn()
  } finally {
    pending = ''
    $.ui.invalidate('ui.render')
  }
}

async function loadTenant($: EngineInterface): Promise<void> {
  if (tenantId) return
  const saved = (await $.store.get('tenant').catch(() => undefined)) as { id?: string } | undefined
  if (saved?.id) {
    tenantId = saved.id
    return
  }
  try {
    const run = await $.process.run(['fab', 'auth', 'status'], { timeoutMs: 30_000 })
    const id = `${run.stdout}\n${run.stderr}`.match(/Tenant ID:\s*([0-9a-f-]{36})/i)?.[1]?.toLowerCase() ?? ''
    if (!id) return
    tenantId = id
    await $.store.set('tenant', { id }).catch(() => undefined)
  } catch {
    return
  }
}

function pageOf(n: TreeNode): string {
  return n.id.match(/^R\/pages\/([^/]+)/)?.[1] ?? ''
}

function reportLink(portal: string, page: string): string {
  const id = portal.match(/\/reports\/([0-9a-f-]{36})/i)?.[1] ?? ''
  if (!id) return portal
  if (reportLinks !== 'embed') return page ? `${portal}/${encodeURIComponent(page)}` : portal
  return `https://app.powerbi.com/reportEmbed?reportId=${encodeURIComponent(id)}&autoAuth=true${tenantId ? `&ctid=${encodeURIComponent(tenantId)}` : ''}${page ? `&pageName=${encodeURIComponent(page)}` : ''}`
}

async function pbirText($: EngineInterface, path: string): Promise<string> {
  try {
    return String(await $.fs.read(`${path}/definition.pbir`))
  } catch {
    return ''
  }
}

async function resolveModel($: EngineInterface, target: Target | null): Promise<{ url: string; lines: string[]; why: string }> {
  if (target?.kind !== 'local') return { url: '', lines: [], why: 'no report is open' }
  const text = await pbirText($, target.path)
  const hit = modelLinks.get(target.path)
  if (hit && hit.pbir === text) return { url: hit.url, lines: hit.lines, why: '' }
  modelLinks.delete(target.path)
  let pbir: Record<string, unknown> | null = null
  try {
    pbir = JSON.parse(text) as Record<string, unknown>
  } catch {
    pbir = null
  }
  const ref = modelRef(pbir)
  const home = target.path.match(/([^/]+)\.Workspace\/[^/]+\.Report$/)?.[1] ?? ''
  const ws = ref.workspace || (ref.local ? home : '')
  if (!ws) return { url: '', lines: [], why: ref.local ? `${ref.name || 'this model'} is a local model with no deployed copy to open` : 'the report connection names no workspace' }
  const wsGuid = await fabId($, `${ws}.Workspace`)
  if (!wsGuid) return { url: '', lines: [], why: `fab could not find workspace ${ws}` }
  const id = /^[0-9a-f-]{36}$/i.test(ref.id) ? ref.id.toLowerCase() : ref.name ? await fabId($, `${ws}.Workspace/${ref.name}.SemanticModel`) : ''
  if (!id) return { url: '', lines: [`Workspace: ${ws}`], why: `fab could not find ${ref.name || 'the model'} in ${ws}` }
  const out = { url: `${workspaceUrl(wsGuid)}/datasets/${id}/details`, lines: [`Workspace: ${ws}`, `Model ID: ${id}`] }
  modelLinks.set(target.path, { pbir: text, ...out })
  return { ...out, why: '' }
}

async function fabId($: EngineInterface, path: string): Promise<string> {
  try {
    const run = await $.process.run(['fab', 'get', path, '-q', 'id'], { timeoutMs: 30_000 })
    return run.exitCode === 0 ? idOf(run.stdout) : ''
  } catch {
    return ''
  }
}

async function targetUrl($: EngineInterface, ws: string, report: string): Promise<string> {
  const wsId = await fabId($, `${ws}.Workspace`)
  if (!wsId) return ''
  const reportId = await fabId($, `${ws}.Workspace/${report}.Report`)
  return reportId ? reportUrl(wsId, reportId) : ''
}

function webUrl(ex: Explorer, n: TreeNode): string {
  if (n.kind === 'semantic model') return ex.target?.kind === 'local' ? (modelLinks.get(ex.target.path)?.url ?? '') : ''
  return ex.targetUrl ? reportLink(ex.targetUrl, pageOf(n)) : ''
}

type Since = { ms: number; mark: string; os: 'linux' | 'darwin' | 'win32' }

let markId = 0

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

async function dropMark($: EngineInterface, since: Since): Promise<void> {
  if (since.mark) await $.process.run(['rm', '-f', since.mark], { timeoutMs: 3_000 }).catch(() => undefined)
}

async function changedUnder($: EngineInterface, dirs: string[], since: Since): Promise<string[]> {
  if (since.os === 'win32') return []
  const test = since.mark ? ['-newer', since.mark] : ['-newermt', `@${(since.ms / 1000).toFixed(3)}`]
  try {
    const run = await $.process.run(['find', '-H', ...dirs, '-name', '.git', '-prune', '-o', '(', '-type', 'f', '-o', '-type', 'd', ')', ...test, '-print'], {
      timeoutMs: 8_000,
    })
    return run.stdout.split('\n').filter(Boolean).slice(0, 500)
  } catch {
    return []
  }
}

async function directEdit($: EngineInterface, files: string[], run = ''): Promise<void> {
  const t = (await get($)).target
  const root = t?.kind === 'local' ? t.path.replace(/\/$/, '') : ''
  if (!root || !files.some(f => f === root || f.startsWith(root + '/'))) {
    if (run) await settle($, run)
    return
  }
  await refresh($)
  await light($, (await get($)).changed, 'orange', false, run)
}

function toggled(ex: Explorer, nodes: TreeNode[], n: TreeNode): { expanded: string[]; cursor: string; selected: string } {
  const open = new Set(ex.expanded)
  if (nodes.some(c => c.parent === n.id)) open.has(n.id) ? open.delete(n.id) : open.add(n.id)
  return { expanded: [...open], cursor: n.id, selected: n.id }
}

const tasks = new Map<string, ((ok: boolean) => Promise<void>)[]>()

function backgroundOf(result: unknown): string {
  const id = (result as { backgroundTaskId?: unknown } | undefined)?.backgroundTaskId
  return typeof id === 'string' ? id : ''
}

function afterTask(id: string, done: (ok: boolean) => Promise<void>): void {
  tasks.set(id, [...(tasks.get(id) ?? []), done])
}

async function taskEnded(text: string): Promise<void> {
  for (const block of text.split('<task-notification>').slice(1)) {
    const id = block.match(/<task-id>([^<]+)<\/task-id>/)?.[1]
    const status = block.match(/<status>([^<]+)<\/status>/)?.[1]
    const waiting = id && status ? tasks.get(id) : undefined
    if (!id || !waiting) continue
    tasks.delete(id)
    for (const done of waiting) await done(status === 'completed')
  }
}

const PBIR_READONLY = new Set(['ls', 'list', 'get', 'schema', 'auth', 'validate', 'diff', 'help', 'tree', 'find', 'search', 'info', 'show', 'dump', 'cat', '--help', '-h'])

function readOnlyPbir(inv: Invocation): boolean {
  return inv.args.filter(a => !a.startsWith('-')).slice(0, 2).some(a => PBIR_READONLY.has(a))
}

async function doRefresh($: EngineInterface): Promise<void> {
  const target = (await get($)).target
  if (!target || target.kind !== 'local') return
  await patch($, () => ({ status: 'loading' }))
  try {
    const nodes = await loadReport(
      {
        text: async path => String(await $.fs.read(path)),
        list: async path => (await $.fs.list(path)).map(e => ({ name: e.name, kind: e.kind })),
        exists: path => $.fs.exists(path),
      },
      target.path,
    )
    const before = await setTree($, target, nodes)
    if (!before) return
    const linked = modelLinks.get(target.path)
    const current = Boolean(linked) && linked?.pbir === (await pbirText($, target.path))
    if (!current) modelLinks.delete(target.path)
    let recheck = null as TreeNode | null
    await patch($, cur => {
      if (!sameTarget(cur.target, target)) return {}
      const sel = cur.selected ? nodes.find(n => n.id === cur.selected) : undefined
      const model = sel?.kind === 'semantic model'
      recheck = model && !current && sel ? sel : null
      const picked = !cur.selected ? {} : sel ? { detail: [...reportDetail(sel, target.path), ...(model && current ? cur.detail.filter(l => /^(Workspace|Model ID|Fabric): /.test(l)) : [])] } : { selected: '', detail: [] }
      const expanded = before.length ? cur.expanded : nodes.filter(n => !n.parent).map(n => n.id)
      return { changed: diff(before, nodes), expanded, status: '', ...picked, ...(follow ? {} : { scroll: anchored(cur, before, nodes, expanded) }) }
    })
    if (recheck) quiet(modelDetail($, target, recheck))
    const m = target.path.match(/([^/]+)\.Workspace\/([^/]+)\.Report$/)
    if (m?.[1] && m[2] && !urlLookup && !(await get($)).targetUrl) {
      const [ws, report] = [m[1], m[2]]
      urlLookup = (async () => {
        const [url] = await Promise.all([targetUrl($, ws, report), loadTenant($)])
        if (url) await patch($, c => (sameTarget(c.target, target) ? { targetUrl: url } : {}))
      })().finally(() => {
        urlLookup = null
      })
      quiet(urlLookup)
    }
  } catch (err) {
    await patch($, cur => (sameTarget(cur.target, target) ? { status: `error: ${err instanceof Error ? err.message : String(err)}` } : {}))
  }
}

function toneOf(calls: Invocation[]): string {
  return calls.some(inv => !readOnlyPbir(inv)) ? 'orange' : 'purple'
}

async function followPbir($: EngineInterface, calls: Invocation[], run: string): Promise<void> {
  const ran = calls.filter(inv => !inv.maybe)
  for (const inv of ran) pbirBin = binOf(inv.bin, inv.cwd, 'pbir')
  let dirty = false
  for (const inv of calls) {
    const path = inv.maybe ? null : pbirReport(inv)
    if (path && (await point($, { kind: 'local', path }, 'unasked'))) dirty = true
    if (!readOnlyPbir(inv) && !inv.args.includes('--dry-run')) dirty = true
  }
  quiet(
    (async () => {
      if (dirty) await refresh($)
      const cur = await get($)
      const nodes = await nodesOf($, cur.target)
      await light($, [...(dirty ? cur.changed : []), ...ran.flatMap(inv => pbirTouched(inv, nodes))], toneOf(calls), false, run)
    })(),
  )
}

async function openShell($: EngineInterface, ex: Explorer): Promise<void> {
  const t = ex.target
  if (t?.kind !== 'local') return
  const parent = t.path.replace(/\/[^/]+$/, '') || '/'
  await terminal($, ['bash', '-lc', 'cd "$1" && "$2" -i; exec bash', '_', parent, pbirBin], [pbirBin, '-i'], parent)
}

async function select($: EngineInterface, target: Target | null, n: TreeNode): Promise<void> {
  const nodes = await nodesOf($, target)
  const node = nodes.find(x => x.id === n.id)
  if (!node || target?.kind !== 'local') return
  const detail = reportDetail(node, target.path)
  await patch($, cur => (sameTarget(cur.target, target) ? { ...toggled(cur, nodes, node), detail } : {}))
  if (node.kind === 'semantic model') quiet(withBusy($, 'Finding the deployed model…', () => modelDetail($, target, node)))
}

async function modelDetail($: EngineInterface, target: Target, node: TreeNode): Promise<void> {
  if (target.kind !== 'local') return
  const detail = reportDetail(node, target.path)
  const model = await resolveModel($, target).catch(() => null)
  const more = model ? (model.lines.length ? model.lines : [`Fabric: ${model.why}`]) : []
  if (more.length) await patch($, cur => (sameTarget(cur.target, target) && cur.cursor === node.id ? { detail: [...detail, ...more] } : {}))
}

function contextFor(ex: Explorer, n: TreeNode): string {
  const t = ex.target
  return [
    'The user has this report object selected in the Report pane; "this", "it" or "the selected" in the prompt likely refers to it.',
    `${n.kind}: ${n.name}`,
    `pbir report folder: ${t?.kind === 'local' ? t.path : ''}`,
    ...ex.detail.slice(1),
  ].join('\n')
}

function guides(depth: number): string {
  const lines = Array.from({ length: depth }, (_, i) => `<rect x="${i * 16 + 7.5}" y="0" width="1" height="${ROW_PX}" fill="#34343c"/>`).join('')
  return `<svg xmlns="${SVG_NS}" width="${depth * 16}" height="${ROW_PX}" viewBox="0 0 ${depth * 16} ${ROW_PX}">${lines}</svg>`
}

function wholeArg(args: string | undefined): string {
  const raw = (args ?? '').trim()
  return /^["']/.test(raw) ? (tokenize(raw)[0] ?? '') : raw
}

export const register: Register = (on, options) => {
  glyphSetting = typeof options?.glyphs === 'string' ? options.glyphs : 'auto'
  follow = options?.follow !== 'off'
  fontHint = options?.fontHint !== 'off'
  reportLinks = options?.reportLinks === 'portal' ? 'portal' : 'embed'

  on('session.start', async ($, e, next) => {
    const windows = (await $.env.get('OS')) === 'Windows_NT'
    useDrives(windows)
    useHome(posix((await $.env.get('HOME')) || (windows ? await $.env.get('USERPROFILE') : '') || ''))
    hinted = false
    fellBack = false
    pbirBin = 'pbir'
    lastPress = { key: '', at: 0 }
    modelLinks.clear()
    optimistic = null
    seen = null
    quiet(detectGlyphs($).then(() => $.ui.invalidate('ui.render')))
    await patch($, () => ({ flash: [], flashDim: [], work: null }))
    await $.command.register({ name: PANE, description: 'Open the Report pane; args: <path to .Report>', immediate: true })
    const ex = await get($)
    if (ex.target) quiet(openPane($, { id: PANE, title: titleFor(ex.target) }))
    return next(e)
  })

  on('command.run', { command: PANE }, async ($, e) => {
    const terminalOnly = !(await $.session.surfaces()).includes('desktop')
    if (terminalOnly && e.presentation && !e.presentation.isFullscreen) return { text: 'The Report pane shows in the sidebar, which needs the fullscreen layout. Run /tui fullscreen, then /report-pane.' }
    if (terminalOnly && e.presentation && e.presentation.columns < 110) return { text: 'The Report pane shows in the sidebar, which needs a terminal at least 110 columns wide. Widen it, then run /report-pane.' }
    noDock = false
    fellBack = false
    quiet(detectGlyphs($).then(() => $.ui.invalidate('ui.render')))
    const cwd = await cwdOf($)
    let target = (await get($)).target
    const first = wholeArg(e.args)
    if (first) target = { kind: 'local', path: join(cwd, first.replace(/\/$/, '')) }
    await point($, target, 'asked', Boolean(first))
    quiet(refresh($))
    return { text: target ? `Report pane on ${targetLabel(target)}.` : 'Report pane open; no report yet.' }
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const command = e.tool === 'Bash' ? e.command : ''
    if (!/\bpbir\b/.test(command)) return next(e)
    const calls = invocations(command, await cwdOf($))
    if (calls.length === 0) return next(e)
    const ex = await get($)
    const here = calls.filter(inv => {
      const p = pbirReport(inv)
      return ex.target && (!p || (ex.target.kind === 'local' && ex.target.path === p))
    })
    const nodes = here.length ? await nodesOf($, ex.target) : []
    const run = here.length ? await light($, here.flatMap(inv => (inv.maybe ? [] : pbirTouched(inv, nodes))), toneOf(calls), true) : ''
    let result: Awaited<ReturnType<typeof next>>
    try {
      result = await next(e)
    } catch (err) {
      if (run) await settle($, run)
      throw err
    }
    const task = result.deny || result.isError ? '' : backgroundOf(result.result)
    if (task) {
      afterTask(task, async ok => {
        if (ok) await followPbir($, calls, run)
        else if (run) await settle($, run)
      })
      return result
    }
    if (result.deny || result.isError) {
      if (run) await settle($, run)
      return result
    }
    await followPbir($, calls, run)
    return result
  })

  on('tool.call', async ($, e, next) => {
    if (e.tool !== 'Edit' && e.tool !== 'Write' && e.tool !== 'Bash') return next(e)
    const command = e.tool === 'Bash' ? e.command : ''
    const viaCli = e.tool === 'Bash' && invocations(command, await cwdOf($)).length > 0
    const t = (await get($)).target
    const watched = e.tool === 'Bash' && !viaCli && t?.kind === 'local' ? [t.path] : []
    const file = e.tool === 'Bash' ? '' : join(await cwdOf($), e.file_path)
    const inside = file !== '' && t?.kind === 'local' && file.startsWith(t.path.replace(/\/$/, '') + '/')
    const run = inside ? await light($, [], 'orange', true) : ''
    const since = await sinceNow($, watched.length > 0)
    let result: Awaited<ReturnType<typeof next>>
    try {
      result = await next(e)
    } catch (err) {
      quiet(dropMark($, since))
      if (run) await settle($, run)
      throw err
    }
    if (result.deny || result.isError) {
      quiet(dropMark($, since))
      if (run) await settle($, run)
      return result
    }
    if (file) {
      const root = file.match(/^(.*?\.Report)\//)?.[1]
      if (root && !inside) await point($, { kind: 'local', path: root }, 'unasked')
      quiet(directEdit($, [file], run))
    } else if (watched.length) {
      const scan = async () => {
        try {
          await directEdit($, await changedUnder($, watched, since))
        } finally {
          await dropMark($, since)
        }
      }
      const task = backgroundOf(result.result)
      if (task) afterTask(task, ok => (ok ? scan() : dropMark($, since)))
      else quiet(scan())
    }
    return result
  })

  on('session.append', async ($, e, next) => {
    if (tasks.size && e.door !== 'tool-result' && e.message.type !== 'assistant') quiet(taskEnded(JSON.stringify(e.message.content)))
    return next(e)
  })

  on('ui.close', async ($, e, next) => {
    const result = await next(e)
    if (e.id === PANE && e.origin.kind === 'person') closed = true
    return result
  })

  on('ui.message', async ($, e, next) => {
    if (e.requestId === PANE && e.element.startsWith('z:') && e.data && typeof e.data === 'object') {
      const data = e.data as { zone?: unknown; ctrl?: unknown; shift?: unknown; key?: unknown; copy?: unknown }
      if (typeof data.key === 'string') {
        await keyed($, data.key, e.surface)
        return {}
      }
      if (typeof data.copy === 'string') {
        if (data.copy !== PROPS) await copyNode($, data.copy, e.surface)
        return {}
      }
      const id = typeof data.zone === 'string' ? data.zone : ''
      if (id === PROPS) {
        propsOpen = !propsOpen
        $.ui.invalidate('ui.render')
        return {}
      }
      const isDouble = !data.ctrl && !data.shift && id ? pressNow($, id) : false
      const ex = await get($)
      const n = (await nodesOf($, ex.target)).find(x => x.id === id)
      if (n && data.ctrl) quiet(openWeb($, ex, n))
      else if (n && data.shift) quiet(openShell($, ex))
      else if (n) quiet(press($, ex, n, isDouble))
      else settlePress($)
      return {}
    }
    if (e.requestId !== PANE || e.element !== 'rows' || !e.data || typeof e.data !== 'object') return next(e)
    const data = e.data as { press?: unknown; key?: unknown; ctrl?: unknown; shift?: unknown; scrollTo?: unknown; copy?: unknown }
    const isDouble = typeof data.press === 'string' && !data.ctrl && !data.shift ? pressNow($, data.press) : false
    const ex = await get($)
    if (typeof data.scrollTo === 'number') {
      const to = Math.round(Math.max(0, Math.min(1, data.scrollTo)) * (views[e.surface]?.max ?? 0))
      if (to !== ex.scroll[e.surface]) await patch($, cur => ({ scroll: { ...cur.scroll, [e.surface]: to } }))
      return {}
    }
    if (typeof data.copy === 'string') {
      await copyNode($, data.copy, e.surface)
      return {}
    }
    if (typeof data.press === 'string') {
      const n = (await nodesOf($, ex.target)).find(x => x.id === data.press)
      if (!n) {
        settlePress($)
        return {}
      }
      if (ex.scroll[e.surface] === undefined) await patch($, cur => ({ scroll: { ...cur.scroll, [e.surface]: views[e.surface]?.from ?? 0 } }))
      if (data.ctrl) await openWeb($, ex, n)
      else if (data.shift) await openShell($, ex)
      else await press($, ex, n, isDouble)
      return {}
    }
    if (typeof data.key === 'string') await keyed($, data.key, e.surface)
    return {}
  })

  on('ui.scroll', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    if (nativeScroll) return next(e)
    const ex = await get($)
    const known = Object.keys(views)
    const sized = known.filter(s => views[s]?.rows === e.bodyRows)
    const step = Math.sign(e.by) * Math.max(3, Math.abs(e.by))
    const moved: Record<string, number> = {}
    for (const s of sized.length ? sized : known) {
      const v = views[s]
      if (v) moved[s] = Math.max(0, Math.min(v.max, (ex.scroll[s] ?? v.from) + step))
    }
    if (Object.entries(moved).some(([s, to]) => to !== ex.scroll[s])) await patch($, cur => ({ scroll: { ...cur.scroll, ...moved } }))
    return {}
  })

  on('prompt.submit', async ($, e, next) => {
    const ex = await get($)
    const n = ex.selected && ex.target ? (await nodesOf($, ex.target)).find(x => x.id === ex.selected) : undefined
    const hint = fontNote()
    const context = [...(e.context ?? []), ...(n ? [contextFor(ex, n)] : []), ...(hint ? [hint] : [])]
    return context.length === (e.context ?? []).length ? next(e) : next({ ...e, context })
  })


  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    if (e.surface !== 'terminal' && e.surface !== 'desktop') return next(e)
    if (e.surface === 'terminal' && e.props.placement === 'inline') {
      noDock = true
      quiet($.ui.close({ id: PANE }))
      const { Box: Empty } = $.ui.resolve(e)
      return <Empty />
    }
    const tier = tierFor(e.surface)
    if (e.surface === 'terminal' && tier === 'plain' && glyphSetting === 'auto') fellBack = true
    const table = $.ui.resolve(e)
    const { Box, Text, Button, Input, Client } = table
    const Svg = 'Svg' in table ? table.Svg : undefined
    const native = e.surface === 'desktop' && Boolean(Svg)
    nativeScroll = native
    const raw = await get($)
    const nodes = await nodesOf($, raw.target)
    const ex = optimistic && sameTarget(optimistic.target, raw.target) ? { ...raw, cursor: optimistic.cursor, selected: optimistic.selected, expanded: optimistic.expanded, detail: optimistic.detail } : raw
    seen = { ex, nodes }
    const now = await $.clock.now()
    const work = ex.work && (!ex.work.running || now - ex.work.at < BUSY_MAX_MS) ? ex.work : null
    const tone = work?.tone ?? ''
    const brightSet = new Set(work ? ex.flash : [])
    const dimSet = new Set(work ? ex.flashDim : [])
    const width = Math.max(20, e.props.bodyColumns)
    const rootId = rootOf(ex, nodes)
    const rows = visible(ex, nodes, rootId)
    const changed = new Set(ex.changed)
    const detailRows = ex.detail.length ? Math.min(ex.detail.length, DETAIL_ROWS) + 4 : 0
    const room = Math.max(5, Math.min(WINDOW, (e.props.scroll?.bodyRows ?? 40) - 4 - detailRows - (pending ? 1 : 0) - (nodes.length === 0 ? 1 : 0)))
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
    const chain = new Set(flashing ? ancestors(nodes, focusId) : [])
    const keep = (id: string) => chain.has(id) || isLit(id)
    let pinned = flashing ? rows.slice(0, from).filter(r => keep(r.node.id)).slice(-cap) : []
    if (pinned.length) {
      from = nearBottom(Math.max(3, room - pinned.length - 1))
      pinned = rows.slice(0, from).filter(r => keep(r.node.id)).slice(-cap)
    }
    const max = Math.max(0, rows.length - room)
    const held = ex.scroll[e.surface]
    if (held !== undefined) {
      from = Math.max(0, Math.min(held, max))
      pinned = []
    }
    if (!native) views[e.surface] = { from, max, rows: e.props.scroll?.bodyRows ?? 40, room }
    const shown = rows.slice(from, from + room - pinned.length)
    const clip = (s: string, max = width) => (s.length > max ? s.slice(0, max - 1) + '…' : s)
    const noteOf = (n: TreeNode) => (n.note ? (n.kind === 'visual' ? visualLabel(n.note) : n.note) : '')
    const rowSpec = (r: Row): RowSpec => {
      const n = r.node
      const g = glyph(n, tier)
      const arrow = r.leaf ? '  ' : tier === 'plain' ? (r.open ? '▾ ' : '▸ ') : r.open ? '\u{f47c} ' : '\u{f460} '
      const note = noteOf(n) ? ` ${noteOf(n)}` : ''
      const cols = Math.max(4, width - r.depth * 2 - 6 - note.length)
      const isBright = brightSet.has(n.id)
      const isDim = !isBright && dimSet.has(n.id)
      const name = clip(n.name, cols)
      const faded = n.hidden
      const left: Seg[] = [
        { t: changed.has(n.id) ? '*' : ' ', c: '#e5c07b' },
        { t: '  '.repeat(r.depth) },
        { t: arrow, c: '#7a7a86' },
        isBright || isDim ? { t: g.char + ' ', sh: tone, dim: isDim, one: true } : { t: g.char + ' ', c: faded ? MUTED : g.color },
        isBright || isDim ? { t: name, sh: tone, dim: isDim, b: isBright } : { t: name, c: faded ? MUTED : g.label, b: n.id === ex.selected },
      ]
      return { id: n.id, left: clean(left), right: note ? [{ t: note, c: MUTED }] : [] }
    }
    const note = (text: string): RowSpec => ({ id: '', left: [{ t: text, c: MUTED }], right: [] })
    const specs: RowSpec[] = [...pinned.map(rowSpec), ...(pinned.length > 0 ? [note('  ⋮')] : []), ...shown.map(rowSpec)]
    const barSize = Math.max(1, Math.round((specs.length * shown.length) / Math.max(1, rows.length)))
    const bar =
      rows.length > shown.length + pinned.length
        ? { pos: max ? Math.round((from / max) * (specs.length - barSize)) : 0, size: barSize, thumb: '#5b9bd5', track: '#4a4a56' }
        : undefined
    const icon = (nerd: string, fallback: string) => (tier === 'plain' ? fallback : nerd)
    const rootNode = nodes.find(n => n.id === rootId)
    const headName = rootNode ? rootNode.name : ex.target ? targetLabel(ex.target) : TITLE
    const loadingNow = ex.status === 'loading'
    const statusSegs: Seg[] = loadingNow ? [{ t: '  ' }, { t: '', spin: true }, { t: ' loading', c: MUTED }] : ex.status ? [{ t: `  ${ex.status}`, c: MUTED }] : []
    const head: RowSpec = {
      id: '',
      left: clean([
        { t: `${titleGlyph(tier)} `, c: TITLE_COLOR },
        { t: headName, b: true },
        ...statusSegs,
        ...(ex.changed.length ? [{ t: `  ${ex.changed.length} changed`, c: '#e5c07b' }] : []),
      ]),
      right: [],
    }
    const busyRow = (key: string, text: string) => (
      <Client key={key} module="./rows.tsx" props={{ rows: [{ id: '', left: [{ t: '', spin: true }, { t: ` ${text}`, c: MUTED }], right: [] }], active: '', activeBg: '', hoverBg: '', tones: TONES } satisfies RowsProps} />
    )
    const icon16 = (source: string | undefined, alt: string, fallback: Seg, key: string) =>
      native && Svg && source ? <Svg key={key} source={source} alt={alt} width={16} height={16} /> : <Text key={key} color={fallback.c}>{fallback.t}</Text>
    const rule = (key: string) => <Text key={key} color="#2e2e34" wrap="truncate-end">{'─'.repeat(width)}</Text>
    const shownNode = nodes.find(n => n.id === ex.selected)
    const details = ex.detail.slice(1, DETAIL_ROWS).map(l => {
      const cut = l.indexOf(': ')
      const key = cut > 0 ? l.slice(0, cut) : ''
      return { key: key === 'pbir path' ? 'Path' : key, value: (cut > 0 ? l.slice(cut + 2) : l).replace(/\s+/g, ' ') }
    })
    type Action = { key: string; svg: string; nerd: string; plain: string; label: string; run: (surface: string) => void }
    const actions: Action[] = shownNode
      ? [
          ...(shownNode.file && shownNode.kind !== 'semantic model' ? [{ key: 'file', svg: 'ui:open', nerd: '\u{f0214}', plain: '↗', label: 'Open file', run: () => quiet(openUrl($, shownNode.file ?? '')) }] : []),
          ...(shownNode.kind === 'semantic model' || webUrl(ex, shownNode) ? [{ key: 'web', svg: 'ui:open', nerd: '\u{f0379}', plain: '↗', label: 'Open in Fabric', run: () => quiet(openWeb($, ex, shownNode)) }] : []),
          ...(shownNode.kind === 'report' ? [{ key: 'pbir', svg: 'ui:open', nerd: '\u{f018d}', plain: '›', label: 'pbir shell', run: () => quiet(openShell($, ex)) }] : []),
          ...(shownNode.path ? [{ key: 'copy', svg: 'ui:copy', nerd: '\u{f018f}', plain: '⧉', label: 'Copy path', run: (surface: string) => quiet(copyOf($, shownNode.path, surface)) }] : []),
        ]
      : []
    const actionRow = (
      <Box flexDirection="row" alignItems="center" gap={2}>
        {actions.map(a => (
          <Box key={`a:${a.key}`} flexDirection="row" alignItems="center" gap={1}>
            {native ? icon16(FABRIC_SVG[a.svg], a.label, { t: '', c: MUTED }, `ai:${a.key}`) : null}
            <Button key={a.key} plain label={native ? a.label : `${icon(a.nerd, a.plain)} ${a.label}`} onPress={p => a.run(p.surface)} />
          </Box>
        ))}
      </Box>
    )
    const toggles = (
      <Box flexDirection="row" alignItems="center" gap={native ? 1 : 2}>
        {rootNode && <Button key="up" plain dimColor label={icon('\u{f005d}', '↑')} onPress={() => quiet(goUp($))} />}
        {rootNode && <Button key="home" plain dimColor label={icon('\u{f02dc}', '⌂')} onPress={() => quiet(goHome($))} />}
        <Button key="refresh" plain dimColor label={icon('\u{f0450}', '↻')} onPress={() => {
          if (ex.target?.kind === 'local') modelLinks.delete(ex.target.path)
          quiet(refresh($))
        }} />
        <Button key="collapse" plain dimColor label={icon('\u{eac5}', '⊟')} onPress={() => quiet(patch($, () => ({ expanded: [] })))} />
        <Text> </Text>
      </Box>
    )
    const search = (focus: boolean) => (
      <Input
        key="q"
        placeholder="Filter, or Enter to jump"
        {...(focus ? { autoFocus: true as const } : {})}
        value={ex.query}
        onInput={(v: string) => quiet(patch($, () => ({ query: v })))}
        onSubmit={(v: string) => quiet(patch($, cur => jumpTo(cur, nodes, v)))}
      />
    )
    const empty = !ex.target ? HINT : nodes.length === 0 && !loadingNow ? 'nothing loaded yet' : ''
    if (native) {
      const body = Math.max(10, e.props.scroll?.bodyRows ?? 30)
      const lead = (d: number, key: string) => (Svg && d > 0 ? <Svg key={key} source={guides(d)} alt={`level ${d}`} width={d * 16} height={ROW_PX} /> : <Box key={key} width={d * 2} />)
      const nativeRow = (r: Row) => {
        const n = r.node
        const g = glyph(n, 'plain')
        const noteText = noteOf(n)
        const label = clip(n.name, Math.max(4, width - r.depth * 2 - 8 - noteText.length))
        const lit = brightSet.has(n.id) || dimSet.has(n.id)
        return (
          <Box key={`n:${n.id}`} position="relative" height={1} overflow="hidden" flexDirection="row" alignItems="center" backgroundColor={n.id === ex.cursor ? '#2a2d34' : undefined} hover={{ backgroundColor: '#232529' }}>
            {lead(r.depth, `g:${n.id}`)}
            <Box width={2} flexShrink={0} flexDirection="row" alignItems="center">
              {r.leaf ? null : icon16(FABRIC_SVG[r.open ? 'ui:chevron-down' : 'ui:chevron-right'], r.open ? 'collapse' : 'expand', { t: r.open ? '⌄' : '›', c: MUTED }, `c:${n.id}`)}
            </Box>
            <Box flexDirection="row" alignItems="center" gap={1} flexShrink={1}>
              {icon16(FABRIC_SVG[SVG_KIND[n.kind] ?? ''], n.kind, { t: g.char, c: g.color }, `i:${n.id}`)}
              <Text color={n.hidden ? MUTED : lit ? TONES[tone]?.bright[1] : undefined} bold={n.id === ex.selected} wrap="truncate-end">{label}</Text>
              {changed.has(n.id) ? <Text color="#e5c07b">*</Text> : null}
            </Box>
            <Box flexGrow={1} />
            {noteText ? <Text color={MUTED}>{noteText}</Text> : null}
            <Box position="absolute" top={0} left={0} right={0} bottom={0}>
              <Client key={`z:${n.id}`} module="./zone.tsx" props={{ id: n.id } satisfies ZoneProps} width="100%" height="100%" />
            </Box>
          </Box>
        )
      }
      const at = shownNode ? rows.findIndex(r => r.node.id === shownNode.id) : -1
      const depth = at >= 0 ? (rows[at]?.depth ?? 0) + 1 : 1
      const propRow = (key: string, d: number, child: unknown) => (
        <Box key={key} height={1} overflow="hidden" flexDirection="row" alignItems="center" gap={1}>
          {lead(d, `${key}:g`)}
          {child as never}
        </Box>
      )
      const propLines =
        shownNode && ex.detail.length > 0
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
                    ...(actions.length ? [propRow('pr:actions', depth + 1, actionRow)] : []),
                  ]
                : []),
            ]
          : []
      const headRows = 4 + (pending ? 1 : 0) + (empty ? 1 : 0)
      const lines = at >= 0 ? rows.flatMap((r, i) => (i === at ? [nativeRow(r), ...propLines] : [nativeRow(r)])) : rows.map(nativeRow)
      const offset = e.props.scroll?.offset ?? 0
      const first = Math.max(0, offset - headRows - body)
      const last = Math.min(lines.length, offset - headRows + body * 2)
      return (
        <Box flexDirection="column">
          <Box key="desk-head" height={1} flexDirection="row" alignItems="center">
            <Box flexGrow={1} flexShrink={1} flexDirection="row" alignItems="center" gap={1}>
              {icon16(FABRIC_SVG.Report, 'Power BI report', { t: titleGlyph(tier), c: TITLE_COLOR }, 'logo')}
              <Text bold wrap="truncate-end">{headName}</Text>
              {loadingNow ? <Box height={1}>{busyRow('loading', 'loading')}</Box> : ex.status ? <Text color={MUTED} wrap="truncate-end">{ex.status}</Text> : null}
              {ex.changed.length ? <Text color="#e5c07b">{`${ex.changed.length} changed`}</Text> : null}
            </Box>
            {toggles}
          </Box>
          <Box height={3} flexDirection="row" alignItems="center" gap={1} overflow="hidden">
            <Box flexGrow={1} flexShrink={1} width="100%">
              {search(false)}
            </Box>
            {ex.query ? <Button key="clearq" plain dimColor label="×" onPress={() => quiet(patch($, () => ({ query: '' })))} /> : null}
          </Box>
          {pending ? <Box height={1}>{busyRow('pending', pending)}</Box> : null}
          {empty ? (
            <Box height={1}>
              <Text color={MUTED}>{empty}</Text>
            </Box>
          ) : null}
          <Box key="tree" flexDirection="column">
            {first > 0 ? <Box key="above" height={first} /> : null}
            {lines.slice(first, Math.max(first, last))}
            {last < lines.length ? <Box key="below" height={lines.length - Math.max(first, last)} /> : null}
          </Box>
        </Box>
      )
    }
    return (
      <Box flexDirection="column" minHeight={Math.max(1, e.props.scroll?.bodyRows ?? 1)}>
        <Client key="head" module="./rows.tsx" props={{ rows: [head], active: '', activeBg: '', hoverBg: '', tones: TONES } satisfies RowsProps} />
        <Box flexDirection="row" alignItems="center" marginTop={1} marginBottom={1} gap={1}>
          <Box flexGrow={1} flexShrink={1} width="100%">
            {work && !ex.query ? (
              <Client key="working" module="./rows.tsx" props={{ rows: [{ id: '', left: [{ t: '', spin: true }, { t: ' ' }, { t: tier === 'plain' ? '*' : '\u{ec82}', claude: true }, { t: ' Claude is working in Power BI...', sh: 'orange' }], right: [] }], active: '', activeBg: '', hoverBg: '', tones: TONES } satisfies RowsProps} />
            ) : (
              search(true)
            )}
          </Box>
          {ex.query ? <Button key="clearq" plain dimColor label={icon('\u{f0156}', '×')} onPress={() => quiet(patch($, () => ({ query: '' })))} /> : null}
          {toggles}
        </Box>
        {pending ? busyRow('pending', pending) : null}
        {empty ? <Text color={MUTED}>{empty}</Text> : null}
        <Client key="rows" module="./rows.tsx" props={{ rows: specs, active: ex.cursor, activeBg: '#3e4451', hoverBg: '#2d2f33', tones: TONES, ...(bar ? { bar } : {}) } satisfies RowsProps} />
        <Box flexGrow={1} />
        {shownNode && ex.detail.length > 0 && (
          <Box key="details" flexDirection="column">
            {rule('rule-top')}
            <Box flexDirection="row" alignItems="center" gap={1} marginBottom={1}>
              <Text color={glyph(shownNode, tier).color}>{glyph(shownNode, tier).char}</Text>
              <Text bold wrap="truncate-end">{shownNode.name}</Text>
              <Box flexGrow={1} />
              <Button key="clear" plain dimColor label={icon('\u{f0156}', '✕')} onPress={() => quiet(patch($, () => ({ selected: '', detail: [] })))} />
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
            {actions.length > 0 && rule('rule-actions')}
            {actions.length > 0 && actionRow}
          </Box>
        )}
      </Box>
    )
  })
}
