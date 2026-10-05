import { expect, mock, test } from 'claude-code/testing'

import { binOf, invocations, pbirReport, tokenize, useDrives } from '../hooks/parse'
import { glyph, type Tier, visualLabel } from '../hooks/icons'
import { type Io, loadReport } from '../hooks/report'
import Rows from '../hooks/rows'
import { diff } from '../hooks/tree'

type Ran = string[][]
const opens: unknown[] = []
const closes: unknown[] = []
const PLUGIN = 'reports'
const PANE = 'report-pane'
const STATE = { plugin: PLUGIN, key: 'explorer' } as const
const TREE = { plugin: PLUGIN, key: 'tree' } as const
const nodes = Array.from({ length: 60 }, (_, i) => ({ id: `T:${i}`, parent: '', kind: 'page', name: `Page${String(i).padStart(2, '0')}`, path: `tables/Table${i}`, hidden: false, sig: '', note: '' }))
const explorer = (target: any) => ({ target, changed: [], expanded: [], query: '', cursor: '', selected: '', detail: [], status: '', flash: [], flashDim: [], work: null, targetUrl: '', scroll: {}, root: '' })
const leaf = (id: string, parent: string, kind: string, name: string, path: string, note = '') => ({ id, parent, kind, name, path, hidden: false, sig: '', note })
const deep = [
  leaf('R', '', 'report', 'Sales.Report', 'Sales.Report'),
  leaf('R/pages', 'R', 'group', 'Pages (60)', ''),
  ...Array.from({ length: 60 }, (_, i) => leaf(`R/pages/p${i}`, 'R/pages', 'page', `Page${i}`, `Sales.Report/Page${i}.Page`)),
  ...Array.from({ length: 3 }, (_, j) => leaf(`R/pages/p50/v${j}`, 'R/pages/p50', 'visual', `Card${j}`, `Sales.Report/Page50.Page/v${j}.Visual`, 'card')),
]
const NERD = /[\u{e000}-\u{f8ff}\u{f0000}-\u{fffff}]/u
const HINT = 'Tell user once: Report pane icons need github.com/data-goblin/fabric-nf plus a Nerd Font. Plugin option fontHint=off disables this.'

type Files = Record<string, string>
const DIR = '/work/Sales.Report'
const DEF = `${DIR}/definition`

function pbirFiles(opts: { visuals?: number; report?: object; bookmarks?: boolean } = {}): Files {
  const files: Files = {
    [`${DIR}/definition.pbir`]: JSON.stringify({ datasetReference: { byPath: { path: '../Sales.SemanticModel' } } }),
    [`${DEF}/report.json`]: JSON.stringify(opts.report ?? { themeCollection: { customTheme: { name: 'Corporate' } }, objects: { section: [{ properties: { verticalAlignment: 'Top' } }] } }),
    [`${DEF}/pages/pages.json`]: JSON.stringify({ pageOrder: ['p1'], activePageName: 'p1' }),
    [`${DEF}/pages/p1/page.json`]: JSON.stringify({ name: 'p1', displayName: 'Overview' }),
  }
  for (let i = 0; i < (opts.visuals ?? 1); i++) files[`${DEF}/pages/p1/visuals/v${i}/visual.json`] = JSON.stringify({ name: `v${i}`, position: { z: i }, visual: { visualType: 'card' } })
  if (opts.bookmarks !== false) files[`${DEF}/bookmarks/Bm1.bookmark.json`] = JSON.stringify({ name: 'Bm1', displayName: 'Q1' })
  return files
}

function fsOf(files: Files) {
  const under = (path: string) => Object.keys(files).filter(f => f.startsWith(path.replace(/\/$/, '') + '/'))
  const list = (path: string) => {
    const names = new Map<string, 'file' | 'dir'>()
    for (const f of under(path)) {
      const [name, ...rest] = f.slice(path.replace(/\/$/, '').length + 1).split('/')
      if (name) names.set(name, rest.length ? 'dir' : 'file')
    }
    if (names.size === 0) throw new Error(`ENOENT: ${path}`)
    return [...names].map(([name, kind]) => ({ name, kind, size: 0, mtimeMs: 0, isLink: false }))
  }
  const text = (path: string) => {
    const t = files[path]
    if (t === undefined) throw new Error(`ENOENT: ${path}`)
    return t
  }
  const exists = (path: string) => files[path] !== undefined || under(path).length > 0
  return { list, text, exists }
}

function ioOf(files: Files): Io {
  const fs = fsOf(files)
  return { text: async p => fs.text(p), list: async p => fs.list(p), exists: async p => fs.exists(p) }
}

const mem = new Map<string, { value: unknown; version: number }>()
const toasts: string[] = []
const registered: string[] = []
const cwds: unknown[] = []
const asks = { fs: 0, surfaces: 0 }
type World = { fail?: boolean; copy?: unknown; surfaces?: string[]; files?: Files; run?: (argv: string[]) => { exitCode?: number; stdout?: string } | undefined; onSet?: (e: any) => void; tool?: (e: any) => Promise<unknown> }

function world(on: any, env: Record<string, string>, ran: Ran, opts: World = {}) {
  mem.clear()
  on('state.get', (_$: any, e: any) => {
    const cur = mem.get(`${e.plugin}/${e.key}`)
    return { value: { value: cur?.value, version: cur?.version ?? 0 } }
  })
  on('state.set', (_$: any, e: any) => {
    opts.onSet?.(e)
    const k = `${e.plugin}/${e.key}`
    const v = mem.get(k)?.version ?? 0
    if (e.ifVersion !== undefined && e.ifVersion !== v) return { value: { isSet: false, version: v, value: mem.get(k)?.value } }
    mem.set(k, { value: e.value, version: v + 1 })
    return { value: { isSet: true, version: v + 1 } }
  })
  mock.env(on, env)
  const clock = mock.clock(on, { now: 1_800_000_000_000 })
  mock.store(on)
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/work' }))
  on('session.id', () => ({ value: 'test' }))
  on('session.surfaces', () => {
    asks.surfaces++
    return { value: opts.surfaces ?? ['terminal'] }
  })
  on('command.register', (_$: any, e: any) => {
    registered.push(e.name)
    return { value: undefined }
  })
  on('prompt.submit', (_$: any, e: any) => ({ text: e.text, context: e.context }))
  on('ui.open', (_$: any, e: any) => {
    if (opts.fail) throw new Error('open failed')
    opens.push(e)
    return { value: { isPlaced: true } }
  })
  on('ui.close', (_$: any, e: any) => {
    closes.push(e)
    return {}
  })
  on('ui.toast', (_$: any, e: any) => {
    toasts.push(JSON.stringify(e))
    return { value: undefined }
  })
  on('ui.copy', () => ({ value: opts.copy ?? { isCopied: true } }))
  on('tool.call', async (_$: any, e: any) => ({ result: (await opts.tool?.(e)) ?? { stdout: '', stderr: '', interrupted: false } }))
  const local = (path: string) => path.replace(/\\/g, '/').replace(/^[A-Za-z]:\//, '/')
  on('fs.read', (_$: any, e: any) => {
    asks.fs++
    return { value: fsOf(opts.files ?? {}).text(local(e.path)) }
  })
  on('fs.list', (_$: any, e: any) => {
    asks.fs++
    return { value: fsOf(opts.files ?? {}).list(local(e.path)) }
  })
  on('fs.exists', (_$: any, e: any) => {
    asks.fs++
    return { value: fsOf(opts.files ?? {}).exists(local(e.path)) }
  })
  on('fs.stat', () => {
    throw new Error('ENOENT')
  })
  on('process.run', (_$: any, e: any) => {
    ran.push([...e.argv])
    cwds.push(e.cwd)
    const own = opts.run?.([...e.argv])
    if (own) return { value: { exitCode: own.exitCode ?? 0, stdout: own.stdout ?? '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    const out = e.argv[0] === 'uname' ? (env.HOME?.startsWith('/Users') ? 'Darwin\n' : 'Linux\n') : e.argv[0] === 'sh' ? 'missing\n' : ''
    return { value: { exitCode: 0, stdout: out, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  return clock
}

const paneProps = { title: 'Model', isFocused: false, bodyColumns: 70, placement: 'dock', scroll: { offset: 0, bodyRows: 24 }, view: {} } as any
const drawn = async (ui: any) => {
  await ui.redraw()
  return ui.drawn()
}
const rowsOf = async (ui: any) => {
  const find = (n: any): any => (n?.type === 'Client' && n.props?.key === 'rows' ? n : (n?.children ?? []).map(find).find(Boolean))
  return find(await drawn(ui))?.props.props
}

const findKey = (n: any, key: string): any => (n?.props?.key === key ? n : (n?.children ?? []).map((c: any) => findKey(c, key)).find(Boolean))
const state = () => mem.get(`${STATE.plugin}/${STATE.key}`)?.value as any

async function mount($: any, clock: any, surface: 'terminal' | 'desktop', target: any, extra: { nodes?: any[]; state?: object; bodyRows?: number } = {}) {
  await $.session.start({ cwd: '/work', surface, isInteractive: true })
  await clock.settle()
  mem.set(`${STATE.plugin}/${STATE.key}`, { value: { ...explorer(target), ...extra.state }, version: (mem.get(`${STATE.plugin}/${STATE.key}`)?.version ?? 0) + 1 })
  mem.set(`${TREE.plugin}/${TREE.key}`, { value: { target, nodes: extra.nodes ?? nodes }, version: (mem.get(`${TREE.plugin}/${TREE.key}`)?.version ?? 0) + 1 })
  const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: PANE, props: extra.bodyRows ? { ...paneProps, scroll: { offset: 0, bodyRows: extra.bodyRows } } : paneProps })
  await clock.settle()
  return ui
}

test('macOS app: long reports scroll and Shift-click opens pbir -i in Terminal', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/Users/k' }, ran)
  const ui = await mount($, clock, 'desktop', { kind: 'local', path: '/Users/k/My Reports/Sales.Report' })
  let p = await rowsOf(ui)
  expect(p.bar).toBeDefined()
  expect(JSON.stringify(p.rows)).not.toContain('below')
  await $.ui.scroll({ component: 'Pane', requestId: PANE, by: 1 } as any)
  await clock.settle()
  await ui.redraw()
  p = await rowsOf(ui)
  expect(p.rows[0].id).toBe('T:3')
  await ui.post({ press: 'T:5', shift: true }, { in: 'rows' })
  await clock.settle()
  expect(ran.find(a => a[0] === 'osascript')?.join(' ')).toContain("cd '/Users/k/My Reports' && 'pbir' '-i'")
  await ui.unmount()
})

test('Windows: pbir -i starts in the report folder with cmd quoting', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { OS: 'Windows_NT', USERPROFILE: 'C:\\Users\\k' }, ran)
  const ui = await mount($, clock, 'terminal', { kind: 'local', path: 'C:/My Reports/Sales.Report' })
  await ui.post({ press: 'T:5', shift: true }, { in: 'rows' })
  await clock.settle()
  const start = ran.find(a => a[0] === 'cmd')
  expect(start?.at(-1)).toBe('cd /d "C:\\My Reports" && pbir -i')
  expect(ran.some(a => ['setsid', 'osascript', 'uname', 'find', 'touch', 'bash'].includes(a[0] ?? ''))).toBe(false)
  await ui.unmount()
})

test('sidebar only: no pane in the default layout or a narrow terminal, and an inline pane closes itself', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/Users/k' }, ran)
  const before = opens.length
  const main = await $.command.run({ command: PANE, args: '', origin: { kind: 'person' }, presentation: { isFullscreen: false, columns: 200 } } as any)
  expect(JSON.stringify(main)).toContain('/tui fullscreen')
  const narrow = await $.command.run({ command: PANE, args: '', origin: { kind: 'person' }, presentation: { isFullscreen: true, columns: 90 } } as any)
  expect(JSON.stringify(narrow)).toContain('110 columns')
  expect(opens.length).toBe(before)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: { ...paneProps, placement: 'inline' } })
  await clock.settle()
  expect(closes.length).toBeGreaterThan(0)
  await ui.unmount()
})

test('copying a row reports whether the clipboard took it', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const opts: World = { copy: { isCopied: false, reason: 'no-clipboard' } }
  const clock = world(on, { HOME: '/home/k' }, ran, opts)
  const ui = await mount($, clock, 'terminal', { kind: 'local', path: '/work/Sales.Report' })
  const before = toasts.length
  await ui.post({ copy: 'T:5' }, { in: 'rows' })
  await clock.settle()
  expect(toasts.slice(before).join('\n')).toContain('Could not copy')
  expect(toasts.slice(before).join('\n')).not.toContain('Copied')
  opts.copy = { isCopied: true }
  const mid = toasts.length
  await ui.post({ copy: 'T:5' }, { in: 'rows' })
  await clock.settle()
  expect(toasts.slice(mid).join('\n')).toContain('Copied tables/Table5')
  await ui.unmount()
})

test('Desktop app: the command opens the pane whatever the backing terminal layout', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/Users/k' }, ran, { surfaces: ['desktop'] })
  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await clock.settle()
  const before = opens.length
  const out = await $.command.run({ command: PANE, args: 'Sales.Report', origin: { kind: 'person' }, presentation: { isFullscreen: false, columns: 80 } } as any)
  await clock.settle()
  expect(JSON.stringify(out)).toContain('Report pane on')
  expect(opens.length).toBeGreaterThan(before)
})

test('double-quoted backslashes stay literal unless the shell escapes the next character', () => {
  expect(tokenize('pbir connect "Sales\\2026.Report"')).toEqual(['pbir', 'connect', 'Sales\\2026.Report'])
  expect(tokenize('echo "a\\"b" "c\\\\d" "\\$x"')).toEqual(['echo', 'a"b', 'c\\d', '$x'])
  const [posixCall] = invocations('pbir connect "Sales\\2026.Report"', '/work')
  expect(posixCall && pbirReport(posixCall)).toBe('/work/Sales\\2026.Report')
  useDrives(true)
  try {
    const [winCall] = invocations('pbir connect "C:\\My Reports\\Sales.Report"', 'C:/work')
    expect(winCall && pbirReport(winCall)).toBe('C:/My Reports/Sales.Report')
  } finally {
    useDrives(false)
  }
})

test('a home-relative report path opens under the home directory', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  await $.command.run({ command: PANE, args: '~/Reports/Sales.Report', origin: { kind: 'person' }, presentation: { isFullscreen: true, columns: 200 } } as any)
  await clock.settle()
  expect((mem.get(`${STATE.plugin}/${STATE.key}`)?.value as any)?.target).toEqual({ kind: 'local', path: '/home/k/Reports/Sales.Report' })
})

test('a pbir command on a shell branch that did not have to run does not move the pane', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran)
  await mount($, clock, 'terminal', { kind: 'local', path: '/work/A.Report' })
  const target = () => (mem.get(`${STATE.plugin}/${STATE.key}`)?.value as any)?.target
  await $.tool.call({ tool: 'Bash', command: 'true || pbir connect B.Report' } as any)
  await clock.settle()
  expect(target()).toEqual({ kind: 'local', path: '/work/A.Report' })
  await $.tool.call({ tool: 'Bash', command: 'false && pbir connect B.Report || echo missing' } as any)
  await clock.settle()
  expect(target()).toEqual({ kind: 'local', path: '/work/A.Report' })
  expect(invocations('pbir connect A.Report || echo no; x && pbir connect B.Report', '/work').map(c => c.maybe)).toEqual([false, false])
  await $.tool.call({ tool: 'Bash', command: 'true && pbir connect B.Report' } as any)
  await clock.settle()
  expect(target()).toEqual({ kind: 'local', path: '/work/B.Report' })
})

test('bookmark and theme nodes carry their own pbir paths', async () => {
  const nodes = await loadReport(ioOf(pbirFiles()), DIR)
  expect(nodes.find(n => n.kind === 'bookmark')?.path).toBe('Sales.Report/bookmark:Bm1')
  expect(nodes.find(n => n.kind === 'theme')?.path).toBe('Sales.Report/Corporate.Theme')
})

test('report settings, theme and model connection changes count as changes', async () => {
  const before = await loadReport(ioOf(pbirFiles()), DIR)
  const settings = await loadReport(ioOf(pbirFiles({ report: { themeCollection: { customTheme: { name: 'Corporate' } }, objects: { section: [{ properties: { verticalAlignment: 'Middle' } }] } } })), DIR)
  expect(diff(before, settings)).toContain('R')
  const theme = await loadReport(ioOf(pbirFiles({ report: { themeCollection: { customTheme: { name: 'Corporate', reportVersionAtImport: '5.61' } }, objects: { section: [{ properties: { verticalAlignment: 'Top' } }] } } })), DIR)
  expect(diff(before, theme)).toContain('R/theme')
  const files = pbirFiles()
  files[`${DIR}/definition.pbir`] = JSON.stringify({ datasetReference: { byPath: { path: '../Sales.SemanticModel' }, byConnection: null } })
  expect(diff(before, await loadReport(ioOf(files), DIR))).toContain('R/model')
})

test('a removed visual marks its page as changed', async () => {
  const before = await loadReport(ioOf(pbirFiles({ visuals: 2 })), DIR)
  const after = await loadReport(ioOf(pbirFiles({ visuals: 1 })), DIR)
  expect(diff(before, after)).toEqual(['R/pages/p1'])
})

test('a malformed report file is an error and the last good tree stays', { timeoutMs: 20_000 }, async ($, on) => {
  const missing = pbirFiles({ visuals: 2 })
  delete missing[`${DEF}/pages/p1/visuals/v1/visual.json`]
  missing[`${DEF}/pages/p1/visuals/v1/notes.txt`] = ''
  expect((await loadReport(ioOf(missing), DIR)).filter(n => n.kind === 'visual')).toHaveLength(1)
  const broken = pbirFiles({ visuals: 2 })
  broken[`${DEF}/pages/p1/visuals/v1/visual.json`] = '{'
  await expect(loadReport(ioOf(broken), DIR)).rejects.toThrow('v1/visual.json')
  const ran: Ran = []
  const opts: World = { files: pbirFiles({ visuals: 2 }) }
  const clock = world(on, { HOME: '/home/k' }, ran, opts)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  await $.command.run({ command: PANE, args: 'Sales.Report', origin: { kind: 'person' }, presentation: { isFullscreen: true, columns: 200 } } as any)
  await clock.settle()
  const tree = () => mem.get(`${TREE.plugin}/${TREE.key}`)?.value as any
  expect(tree().nodes.filter((n: any) => n.kind === 'visual')).toHaveLength(2)
  opts.files = broken
  await $.tool.call({ tool: 'Write', file_path: `${DEF}/pages/p1/visuals/v1/visual.json`, content: '{' } as any)
  await clock.settle()
  expect(state().status).toContain('invalid JSON')
  expect(tree().nodes.filter((n: any) => n.kind === 'visual')).toHaveLength(2)
})

test('a page with hundreds of visuals reads them a few at a time', async () => {
  const io = ioOf(pbirFiles({ visuals: 512 }))
  let open = 0
  let peak = 0
  const counted: Io = {
    ...io,
    text: async p => {
      peak = Math.max(peak, ++open)
      await Promise.resolve()
      try {
        return await io.text(p)
      } finally {
        open--
      }
    },
  }
  const nodes = await loadReport(counted, DIR)
  expect(nodes.filter(n => n.kind === 'visual')).toHaveLength(512)
  expect(peak).toBeLessThan(17)
})

test('deleting a visual folder through Bash refreshes the tree', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const opts: World = { files: pbirFiles({ visuals: 2 }) }
  opts.run = argv => (argv[0] === 'find' ? { stdout: argv.join(' ').includes('-type d') ? `${DEF}/pages/p1/visuals\n` : '' } : undefined)
  const clock = world(on, { HOME: '/home/k' }, ran, opts)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  await $.command.run({ command: PANE, args: 'Sales.Report', origin: { kind: 'person' }, presentation: { isFullscreen: true, columns: 200 } } as any)
  await clock.settle()
  const visuals = () => ((mem.get(`${TREE.plugin}/${TREE.key}`)?.value as any).nodes as any[]).filter(n => n.kind === 'visual')
  expect(visuals()).toHaveLength(2)
  opts.files = pbirFiles({ visuals: 1 })
  await $.tool.call({ tool: 'Bash', command: `rm -rf '${DEF}/pages/p1/visuals/v1'` } as any)
  await clock.settle()
  expect(visuals()).toHaveLength(1)
})

test('Linux terminal: Shift-click opens pbir -i through xdg-terminal-exec and reports a failed start', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const opts: World = {}
  const clock = world(on, { HOME: '/home/k' }, ran, opts)
  const ui = await mount($, clock, 'terminal', { kind: 'local', path: '/home/k/My Reports/Sales.Report' })
  await ui.post({ press: 'T:5', shift: true }, { in: 'rows' })
  await clock.settle()
  const start = ran.find(a => a.includes('xdg-terminal-exec'))
  expect(start?.slice(0, 2)).toEqual(['sh', '-c'])
  expect(start?.slice(4)).toEqual(['xdg-terminal-exec', 'bash', '-lc', 'cd "$1" && "$2" -i; exec bash', '_', '/home/k/My Reports', 'pbir'])
  expect(ran.some(a => a[0] === 'osascript' || a[0] === 'cmd')).toBe(false)
  opts.run = argv => (argv.includes('xdg-terminal-exec') ? { exitCode: 1 } : undefined)
  const before = toasts.length
  await ui.post({ press: 'T:6', shift: true }, { in: 'rows' })
  await clock.settle()
  expect(toasts.slice(before).join('\n')).toContain('could not start xdg-terminal-exec')
  await ui.unmount()
})

test('macOS: a refused Terminal automation shows an error', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/Users/k' }, ran, { run: argv => (argv[0] === 'osascript' ? { exitCode: 1 } : undefined) })
  const ui = await mount($, clock, 'terminal', { kind: 'local', path: '/Users/k/Sales.Report' })
  const before = toasts.length
  await ui.post({ press: 'T:5', shift: true }, { in: 'rows' })
  await clock.settle()
  expect(toasts.slice(before).join('\n')).toContain('could not start osascript')
  await ui.unmount()
})

test('typing in the search writes only the small view state, never the tree', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const writes: { key: string; size: number }[] = []
  const clock = world(on, { HOME: '/home/k' }, ran, { onSet: e => writes.push({ key: e.key, size: JSON.stringify(e.value).length }) })
  const ui = await mount($, clock, 'terminal', { kind: 'local', path: '/work/Sales.Report' })
  const before = writes.length
  for (const text of ['P', 'Pa', 'Pag']) await $.ui.input({ plugin: PLUGIN, key: 'q', text, kind: 'change' })
  await clock.settle()
  const typed = writes.slice(before)
  expect(typed.length).toBeGreaterThan(2)
  expect(typed.every(w => w.key === 'explorer')).toBe(true)
  expect(Math.max(...typed.map(w => w.size))).toBeLessThan(1000)
  expect((mem.get(`${STATE.plugin}/${STATE.key}`)?.value as any).query).toBe('Pag')
  await ui.unmount()
})

test('selecting a row writes the selection and its detail together, for the report it was pressed in', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const writes: any[] = []
  const clock = world(on, { HOME: '/home/k' }, ran, { onSet: e => e.key === 'explorer' && writes.push(e.value) })
  const ui = await mount($, clock, 'terminal', { kind: 'local', path: '/work/A.Report' })
  writes.length = 0
  await ui.post({ press: 'T:5' }, { in: 'rows' })
  await clock.settle()
  const picked = writes.filter(w => w.selected === 'T:5')
  expect(picked.length).toBeGreaterThan(0)
  expect(picked.every(w => w.detail[0] === 'page Page05')).toBe(true)
  const ex = mem.get(`${STATE.plugin}/${STATE.key}`)
  mem.set(`${STATE.plugin}/${STATE.key}`, { value: { ...(ex?.value as any), target: { kind: 'local', path: '/work/B.Report' }, selected: '', detail: [] }, version: (ex?.version ?? 0) + 1 })
  await clock.advance(1000)
  await ui.post({ press: 'T:7' }, { in: 'rows' })
  await clock.settle()
  expect((mem.get(`${STATE.plugin}/${STATE.key}`)?.value as any).detail).toEqual([])
  await ui.unmount()
})

test('a refresh updates the selected object detail and drops a selection that disappeared', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const opts: World = { files: pbirFiles() }
  const clock = world(on, { HOME: '/home/k' }, ran, opts)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  await $.command.run({ command: PANE, args: 'Sales.Report', origin: { kind: 'person' }, presentation: { isFullscreen: true, columns: 200 } } as any)
  await clock.settle()
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: paneProps })
  await clock.settle()
  await ui.post({ press: 'R/pages/p1' }, { in: 'rows' })
  await clock.settle()
  expect(state().detail).toContain('pbir path: Sales.Report/Overview.Page')
  const renamed = pbirFiles()
  renamed[`${DEF}/pages/p1/page.json`] = JSON.stringify({ name: 'p1', displayName: 'Summary' })
  opts.files = renamed
  await $.tool.call({ tool: 'Write', file_path: `${DEF}/pages/p1/page.json`, content: '' } as any)
  await clock.settle()
  expect(state().selected).toBe('R/pages/p1')
  expect(state().detail[0]).toBe('page Summary')
  expect(state().detail).toContain('pbir path: Sales.Report/Summary.Page')
  expect(state().detail.join('\n')).not.toContain('Overview')
  const gone = pbirFiles()
  gone[`${DEF}/pages/pages.json`] = JSON.stringify({ pageOrder: [] })
  delete gone[`${DEF}/pages/p1/page.json`]
  opts.files = gone
  await $.tool.call({ tool: 'Write', file_path: `${DEF}/pages/pages.json`, content: '' } as any)
  await clock.settle()
  expect(state().selected).toBe('')
  expect(state().detail).toEqual([])
  await ui.unmount()
})

test('a pbir call that finishes after the report changed leaves the new report working interval alone', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const pending = new Map<string, () => void>()
  const opts: World = { tool: e => new Promise(done => pending.set(e.command, () => done(undefined))) }
  const clock = world(on, { HOME: '/home/k' }, ran, opts)
  await mount($, clock, 'terminal', { kind: 'local', path: '/work/A.Report' })
  const work = () => (mem.get(`${STATE.plugin}/${STATE.key}`)?.value as any).work
  const a = $.tool.call({ tool: 'Bash', command: 'pbir ls' } as any)
  await clock.settle()
  expect(work()?.running).toBe(true)
  await $.command.run({ command: PANE, args: 'B.Report', origin: { kind: 'person' }, presentation: { isFullscreen: true, columns: 200 } } as any)
  await clock.settle()
  expect(work()).toBeNull()
  const b = $.tool.call({ tool: 'Bash', command: 'pbir get B.Report' } as any)
  await clock.settle()
  const mine = work()?.run
  expect(work()?.running).toBe(true)
  pending.get('pbir ls')?.()
  await a
  await clock.settle()
  expect(work()?.run).toBe(mine)
  expect(work()?.running).toBe(true)
  pending.get('pbir get B.Report')?.()
  await b
  await clock.settle()
  expect(work()).toBeNull()
})

test('each surface scrolls within its own pane height', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, { surfaces: ['terminal', 'desktop'] })
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const target = { kind: 'local', path: '/work/Sales.Report' }
  mem.set(`${STATE.plugin}/${STATE.key}`, { value: explorer(target), version: (mem.get(`${STATE.plugin}/${STATE.key}`)?.version ?? 0) + 1 })
  mem.set(`${TREE.plugin}/${TREE.key}`, { value: { target, nodes }, version: (mem.get(`${TREE.plugin}/${TREE.key}`)?.version ?? 0) + 1 })
  const term = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: { ...paneProps, scroll: { offset: 0, bodyRows: 14 } } })
  const desk = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: { ...paneProps, scroll: { offset: 0, bodyRows: 44 } } })
  await clock.settle()
  await term.post({ scrollTo: 1 }, { in: 'rows' })
  await clock.settle()
  await term.redraw()
  await desk.redraw()
  const t = await rowsOf(term)
  const d = await rowsOf(desk)
  expect(t.rows[0].id).toBe('T:50')
  expect(t.rows.at(-1).id).toBe('T:59')
  expect(d.rows[0].id).toBe('T:0')
  await term.unmount()
  await desk.unmount()
})

test('a backgrounded command refreshes when its task ends, not when it launches', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const opts: World = { files: pbirFiles({ visuals: 3 }) }
  opts.run = argv => (argv[0] === 'find' ? { stdout: `${DEF}/pages/p1/visuals\n` } : undefined)
  const clock = world(on, { HOME: '/home/k' }, ran, opts)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  await $.command.run({ command: PANE, args: 'Sales.Report', origin: { kind: 'person' }, presentation: { isFullscreen: true, columns: 200 } } as any)
  await clock.settle()
  const visuals = () => ((mem.get(`${TREE.plugin}/${TREE.key}`)?.value as any).nodes as any[]).filter(n => n.kind === 'visual')
  const work = () => (mem.get(`${STATE.plugin}/${STATE.key}`)?.value as any).work
  const ended = (id: string, status: string) =>
    $.session.append({ message: { type: 'user', role: 'user', content: [{ type: 'text', text: `<task-notification>\n<task-id>${id}</task-id>\n<tool-use-id>toolu_x</tool-use-id>\n<status>${status}</status>\n<summary>Background command completed</summary>\n</task-notification>` }] }, door: 'prompt', origin: { kind: 'task-notification' }, uuid: `u-${id}` } as any).catch(() => undefined)
  opts.tool = async e => ({ stdout: '', stderr: '', interrupted: false, backgroundTaskId: e.command.includes('pbir') ? 'b1' : 'b2' })
  await $.tool.call({ tool: 'Bash', command: 'sleep 1 && pbir rm Sales.Report/Overview.Page/v2.Visual -f', run_in_background: true } as any)
  await clock.settle()
  expect(work()?.running).toBe(true)
  opts.files = pbirFiles({ visuals: 2 })
  await clock.settle()
  expect(visuals()).toHaveLength(3)
  await ended('b1', 'completed')
  await clock.settle()
  expect(work()?.running).toBe(false)
  expect(visuals()).toHaveLength(2)
  await clock.advance(3000)
  await clock.settle()
  expect(work()).toBeNull()
  const scans = () => ran.filter(a => a[0] === 'find').length
  const before = scans()
  await $.tool.call({ tool: 'Bash', command: `sleep 1; rm -rf '${DEF}/pages/p1/visuals/v1'`, run_in_background: true } as any)
  await clock.settle()
  expect(scans()).toBe(before)
  opts.files = pbirFiles({ visuals: 1 })
  await ended('b2', 'completed')
  await clock.settle()
  expect(scans()).toBe(before + 1)
  expect(visuals()).toHaveLength(1)
})

function richFiles(): Files {
  const col = (entity: string, prop: string) => ({ Column: { Expression: { SourceRef: { Entity: entity } }, Property: prop } })
  const filter = (name: string) => ({ name, field: col('Sales', 'Region'), type: 'Categorical' })
  return {
    [`${DIR}/definition.pbir`]: JSON.stringify({ datasetReference: { byPath: { path: '../Sales.SemanticModel' } } }),
    [`${DEF}/report.json`]: JSON.stringify({ themeCollection: { customTheme: { name: 'Corporate' } }, filterConfig: { filters: [filter('rf')] } }),
    [`${DEF}/pages/pages.json`]: JSON.stringify({ pageOrder: ['p1'] }),
    [`${DEF}/pages/p1/page.json`]: JSON.stringify({ name: 'p1', displayName: 'Overview', filterConfig: { filters: [filter('pf')] } }),
    [`${DEF}/pages/p1/visuals/v0/visual.json`]: JSON.stringify({
      name: 'v0',
      visual: { visualType: 'card', query: { queryState: { Values: { projections: [{ field: col('Sales', 'Amount'), queryRef: 'Sales.Amount' }] } } } },
      filterConfig: { filters: [filter('vf')] },
    }),
    [`${DEF}/bookmarks/Bm1.bookmark.json`]: JSON.stringify({ name: 'Bm1', displayName: 'Q1' }),
    [`${DEF}/reportExtensions.json`]: JSON.stringify({ entities: [{ name: 'Sales', measures: [{ name: 'Margin', expression: '1' }] }] }),
  }
}

async function openReport($: any, clock: any, surface: 'terminal' | 'desktop', bodyRows = 24, expandAll = true) {
  await $.session.start({ cwd: '/work', surface, isInteractive: true })
  await clock.settle()
  await $.command.run({ command: PANE, args: 'Sales.Report', origin: { kind: 'person' }, presentation: { isFullscreen: true, columns: 200 } } as any)
  await clock.settle()
  if (expandAll) {
    const cur = mem.get(`${STATE.plugin}/${STATE.key}`)
    const ids = ((mem.get(`${TREE.plugin}/${TREE.key}`)?.value as any).nodes as any[]).map(n => n.id)
    mem.set(`${STATE.plugin}/${STATE.key}`, { value: { ...(cur?.value as any), expanded: ids }, version: (cur?.version ?? 0) + 1 })
  }
  const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: PANE, props: { ...paneProps, scroll: { offset: 0, bodyRows } } })
  await clock.settle()
  return ui
}

test('the plugin, its command, pane and state all go by report-pane, and nothing it says names another mod', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, { files: pbirFiles() })
  const ui = await openReport($, clock, 'terminal')
  expect(registered.at(-1)).toBe('report-pane')
  expect((opens.at(-1) as any)?.id).toBe('report-pane')
  expect(mem.has('reports/explorer')).toBe(true)
  expect(mem.has('reports/tree')).toBe(true)
  const text = JSON.stringify(await $.command.run({ command: PANE, args: '', origin: { kind: 'person' }, presentation: { isFullscreen: true, columns: 200 } } as any))
  expect(text).toContain('Report pane on')
  await ui.post({ press: 'R/pages/p1' }, { in: 'rows' })
  await clock.settle()
  const context = JSON.stringify(await $.prompt.submit({ text: 'hi', context: [] } as any))
  expect(context).toContain('selected in the Report pane')
  for (const said of [text, context, JSON.stringify(await drawn(ui))]) {
    expect(said).not.toContain('explorer')
  }
  await ui.unmount()
})

test('the selection bar is dim and the hover bar fainter still', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran)
  const ui = await mount($, clock, 'terminal', { kind: 'local', path: '/work/Sales.Report' })
  const p = await rowsOf(ui)
  expect(p.activeBg).toBe('#3e4451')
  expect(p.hoverBg).toBe('#2d2f33')
  await ui.unmount()
})

test('double-clicking a group navigates into it; up and home come back; a double-clicked object without children still opens pbir -i', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran)
  const ui = await mount($, clock, 'terminal', { kind: 'local', path: '/work/Sales.Report' }, { nodes: deep, state: { expanded: ['R', 'R/pages'] } })
  const twice = async (id: string) => {
    await clock.advance(600)
    await ui.post({ press: id }, { in: 'rows' })
    await clock.advance(100)
    await ui.post({ press: id }, { in: 'rows' })
    await clock.settle()
  }
  expect(findKey(await drawn(ui), 'up')).toBeUndefined()
  await twice('R/pages')
  let ids = (await rowsOf(ui)).rows.map((r: any) => r.id)
  expect(ids[0]).toBe('R/pages/p0')
  expect(ids).not.toContain('R')
  expect(ids).not.toContain('R/pages')
  expect(JSON.stringify(findKey(await drawn(ui), 'head'))).toContain('Pages (60)')
  await ui.press({ key: 'up' })
  await clock.settle()
  ids = (await rowsOf(ui)).rows.map((r: any) => r.id)
  expect(ids[0]).toBe('R/pages')
  expect(ids).not.toContain('R')
  await ui.press({ key: 'home' })
  await clock.settle()
  expect((await rowsOf(ui)).rows[0].id).toBe('R')
  expect(findKey(await drawn(ui), 'home')).toBeUndefined()
  await twice('R/pages/p3')
  expect(ran.some(a => a.includes('xdg-terminal-exec'))).toBe(true)
  await ui.unmount()
})

test('a pbir command or edit Claude makes in the same report, however it spells the path, leaves your cursor and selection where you put them', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const opts: World = { files: pbirFiles() }
  const clock = world(on, { HOME: '/home/k' }, ran, opts)
  const ui = await openReport($, clock, 'terminal')
  await ui.post({ press: 'R/pages/p1' }, { in: 'rows' })
  await clock.settle()
  expect(state().cursor).toBe('R/pages/p1')
  expect(state().selected).toBe('R/pages/p1')
  await $.tool.call({ tool: 'Bash', command: 'pbir get /work/./Sales.Report/Overview.Page' } as any)
  await clock.settle()
  await $.tool.call({ tool: 'Bash', command: 'pbir set /work//Sales.Report/Overview.Page --display-name Overview' } as any)
  await clock.settle()
  await $.tool.call({ tool: 'Write', file_path: '/work/./Sales.Report/definition/report.json', content: '' } as any)
  await clock.advance(3000)
  await clock.settle()
  expect(state().target).toEqual({ kind: 'local', path: '/work/Sales.Report' })
  expect(state().cursor).toBe('R/pages/p1')
  expect(state().selected).toBe('R/pages/p1')
  expect((await rowsOf(ui)).active).toBe('R/pages/p1')
  await ui.unmount()
})

test('a highlight on rows already in view does not scroll, whether or not you scrolled yourself', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran)
  const ui = await mount($, clock, 'terminal', { kind: 'local', path: '/work/Sales.Report' })
  await $.tool.call({ tool: 'Bash', command: 'pbir get Sales.Report/Page03.Page' } as any)
  await clock.advance(50)
  let p = await rowsOf(ui)
  expect(JSON.stringify(p.rows.find((r: any) => r.id === 'T:3'))).toContain('"sh":"purple"')
  expect(p.rows[0].id).toBe('T:0')
  await clock.advance(3000)
  await $.ui.scroll({ component: 'Pane', requestId: PANE, by: 10 } as any)
  await clock.settle()
  expect((await rowsOf(ui)).rows[0].id).toBe('T:10')
  await $.tool.call({ tool: 'Bash', command: 'pbir get Sales.Report/Page15.Page' } as any)
  await clock.advance(50)
  p = await rowsOf(ui)
  expect(JSON.stringify(p.rows.find((r: any) => r.id === 'T:15'))).toContain('"sh":"purple"')
  expect(p.rows[0].id).toBe('T:10')
  await ui.unmount()
})

test('while Claude reads far down the tree, the report and group it sits in stay pinned and the view scrolls only far enough', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran)
  const ui = await mount($, clock, 'terminal', { kind: 'local', path: '/work/Sales.Report' }, { nodes: deep, state: { expanded: ['R', 'R/pages', 'R/pages/p50'] } })
  expect((await rowsOf(ui)).rows.map((r: any) => r.id)).not.toContain('R/pages/p50/v1')
  await $.tool.call({ tool: 'Bash', command: 'pbir get Sales.Report/Page50.Page/v1.Visual' } as any)
  await clock.advance(100)
  const ids = (await rowsOf(ui)).rows.map((r: any) => r.id)
  expect(ids.slice(0, 2)).toEqual(['R', 'R/pages'])
  expect(ids).toContain('R/pages/p50')
  expect(ids).toContain('R/pages/p50/v1')
  expect(ids.indexOf('R/pages/p50/v1')).toBeGreaterThan(ids.length - 5)
  await ui.unmount()
})

test('while a pbir command runs the search row says Claude is working in its tone, unless you typed a search', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const opts: World = {}
  const clock = world(on, { HOME: '/home/k' }, ran, opts)
  const ui = await mount($, clock, 'terminal', { kind: 'local', path: '/work/Sales.Report' })
  let during: any = null
  opts.tool = async () => {
    during = await drawn(ui)
    return undefined
  }
  const working = () => findKey(during, 'working')?.props.props.rows[0].left[0]
  await $.tool.call({ tool: 'Bash', command: 'pbir get Sales.Report/Page03.Page' } as any)
  expect(working()).toEqual({ t: 'Claude is working in Power BI...', sh: 'purple' })
  expect(findKey(during, 'q')).toBeUndefined()
  await $.tool.call({ tool: 'Bash', command: 'pbir set Sales.Report/Page03.Page --display-name X' } as any)
  expect(working()?.sh).toBe('orange')
  await clock.advance(3000)
  await clock.settle()
  const after = await drawn(ui)
  expect(findKey(after, 'working')).toBeUndefined()
  expect(findKey(after, 'q')).toBeDefined()
  await $.ui.input({ plugin: PLUGIN, key: 'q', text: 'Pa', kind: 'change' })
  await clock.settle()
  await $.tool.call({ tool: 'Bash', command: 'pbir get Sales.Report/Page03.Page' } as any)
  expect(findKey(during, 'working')).toBeUndefined()
  expect(findKey(during, 'q')?.props.value).toBe('Pa')
  await ui.unmount()
})

test('plain glyphs: every report object kind draws its own Unicode symbol and nothing from a private-use area', { timeoutMs: 20_000, options: { glyphs: 'plain' } } as any, async ($: any, on: any) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, { files: richFiles() })
  const ui = await openReport($, clock, 'terminal', 40)
  const rows = (await rowsOf(ui)).rows
  const kinds = new Map(((mem.get(`${TREE.plugin}/${TREE.key}`)?.value as any).nodes as any[]).map(n => [n.id, n.kind]))
  const symbol: Record<string, string> = {
    report: '▣', 'semantic model': '◆', theme: '◐', group: '■', reportfilter: '▿', page: '□', pagefilter: '▿',
    visual: '#', 'data role': '◫', field: '│', visualfilter: '▿', bookmark: '⚑', 'ext measure': 'Σ',
  }
  expect(new Set(kinds.values())).toEqual(new Set(Object.keys(symbol)))
  for (const r of rows) {
    const kind = kinds.get(r.id) ?? ''
    expect(r.left.map((s: any) => s.t).join('')).toContain(`${symbol[kind]} `)
  }
  expect(rows.length).toBe(kinds.size)
  expect(JSON.stringify(await drawn(ui))).not.toMatch(NERD)
  await ui.post({ press: 'R/pages/p1' }, { in: 'rows' })
  await clock.settle()
  expect(JSON.stringify(await drawn(ui))).not.toMatch(NERD)
  await ui.unmount()
})

test('auto glyphs use FabricSymbols only when a Nerd Font is installed as well', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const fonts = new Set(['f2621'])
  const opts: World = { run: argv => (argv[0] === 'sh' && argv[2]?.includes('fc-list') ? { stdout: fonts.has(argv[4] ?? '') ? 'ok\n' : 'missing\n' } : undefined) }
  const clock = world(on, { HOME: '/home/k' }, ran, opts)
  const ui = await mount($, clock, 'terminal', { kind: 'local', path: '/work/Sales.Report' }, { nodes: deep, state: { expanded: ['R', 'R/pages'] } })
  expect(JSON.stringify(await drawn(ui))).not.toMatch(NERD)
  fonts.add('f04eb')
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  await ui.redraw()
  const brand = JSON.stringify((await rowsOf(ui)).rows.find((r: any) => r.id === 'R'))
  expect(brand).toContain(String.fromCodePoint(0xf202a))
  await ui.unmount()
})

test('after an actual plain-Unicode fallback in the terminal Claude gets a one-line font hint once per session, and the hint itself runs and reads nothing', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  expect(JSON.stringify(await $.prompt.submit({ text: 'hi', context: [] } as any))).not.toContain('fabric-nf')
  const ui = await mount($, clock, 'terminal', { kind: 'local', path: '/work/Sales.Report' })
  const before = { ran: ran.length, fs: asks.fs, surfaces: asks.surfaces }
  const first = (await $.prompt.submit({ text: 'hi', context: [] } as any)) as any
  expect(first.context).toEqual([HINT])
  expect({ ran: ran.length, fs: asks.fs, surfaces: asks.surfaces }).toEqual(before)
  expect(JSON.stringify(await $.prompt.submit({ text: 'hi', context: [] } as any))).not.toContain('fabric-nf')
  await ui.unmount()
})

test('fontHint off keeps the font hint out of prompts', { timeoutMs: 20_000, options: { fontHint: 'off' } } as any, async ($: any, on: any) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran)
  const ui = await mount($, clock, 'terminal', { kind: 'local', path: '/work/Sales.Report' })
  expect(JSON.stringify(await $.prompt.submit({ text: 'hi', context: [] } as any))).not.toContain('fabric-nf')
  await ui.unmount()
})

test('a plain glyphs setting is a choice, not a fallback, so no font hint', { timeoutMs: 20_000, options: { glyphs: 'plain' } } as any, async ($: any, on: any) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran)
  const ui = await mount($, clock, 'terminal', { kind: 'local', path: '/work/Sales.Report' })
  expect(JSON.stringify(await $.prompt.submit({ text: 'hi', context: [] } as any))).not.toContain('fabric-nf')
  await ui.unmount()
})

test('plain Unicode in the desktop app is by design, so no font hint', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/Users/k' }, ran, { surfaces: ['desktop'] })
  const ui = await mount($, clock, 'desktop', { kind: 'local', path: '/Users/k/Sales.Report' })
  expect(JSON.stringify(await $.prompt.submit({ text: 'hi', context: [] } as any))).not.toContain('fabric-nf')
  await ui.unmount()
})

test('every row the rows module draws carries a key, including rows without an id', () => {
  const surface: any = { elements: { Box: 'Box', Text: 'Text' }, state: { hover: -1, phase: 0, drag: false, ref: {} }, setState() {}, every: () => () => undefined, onPointer: () => () => undefined, onKey() {}, post() {}, columns: 40 }
  const tones = { orange: { bright: ['#1', '#2', '#3', '#4'], dim: ['#1', '#2', '#3', '#4'] } }
  const out = (Rows as any)({ rows: [{ id: 'a', left: [{ t: 'x' }, { t: 'yz', sh: 'orange' }], right: [] }, { id: '', left: [{ t: '⋮' }], right: [] }, { id: '', left: [{ t: '⋮' }], right: [] }], active: '', activeBg: '', hoverBg: '', tones }, surface)
  const keys = (out.children as any[]).map(c => c.props?.key)
  expect(keys.every(k => typeof k === 'string' && k.length > 0)).toBe(true)
  expect(new Set(keys).size).toBe(keys.length)
})

test('redirections parse safely: &> stays one operator and the file after it is no argument', () => {
  const tokens = tokenize('pbir ls Sales.Report &> /dev/null')
  expect(tokens).toContain('&>')
  expect(tokens).not.toContain('&')
  const calls = invocations('pbir ls Sales.Report &> out.txt && pbir get Sales.Report', '/work')
  expect(calls.map(c => c.args)).toEqual([['ls', 'Sales.Report'], ['get', 'Sales.Report']])
})

test('a pbir binary written with ~, $VAR or backticks falls back to pbir, an absolute one is kept, a relative one resolves only against an absolute cwd, and the pane passes no cwd to its own processes', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran)
  const ui = await mount($, clock, 'terminal', { kind: 'local', path: '/work/Sales.Report' })
  cwds.length = 0
  const opened = async (command: string) => {
    await $.tool.call({ tool: 'Bash', command } as any)
    await clock.settle()
    await clock.advance(600)
    await ui.post({ press: 'T:5', shift: true }, { in: 'rows' })
    await clock.settle()
    return ran.filter(a => a.includes('xdg-terminal-exec')).at(-1)?.at(-1)
  }
  expect(await opened('~/.local/bin/pbir ls Sales.Report')).toBe('pbir')
  expect(await opened('/opt/pbir/bin/pbir ls Sales.Report')).toBe('/opt/pbir/bin/pbir')
  expect(await opened('$HOME/bin/pbir ls Sales.Report')).toBe('pbir')
  expect(await opened('`echo ./x`/pbir ls Sales.Report')).toBe('pbir')
  expect(await opened('./tools/pbir ls Sales.Report')).toBe('/work/tools/pbir')
  expect(await opened('cd "$PROJ" && ./tools/pbir ls /work/Sales.Report')).toBe('pbir')
  expect(binOf('./tools/pbir', 'proj', 'pbir')).toBe('pbir')
  expect(binOf('/opt/./pbir/../pbir/bin/pbir', '/work', 'pbir')).toBe('/opt/pbir/bin/pbir')
  expect(cwds.length).toBeGreaterThan(0)
  expect(cwds.every(c => c === undefined)).toBe(true)
  await ui.unmount()
})

test('follow off: a refresh that adds rows above the view keeps the view where you put it', { timeoutMs: 20_000, options: { follow: 'off' } } as any, async ($: any, on: any) => {
  const ran: Ran = []
  const opts: World = { files: pbirFiles({ visuals: 40 }) }
  const clock = world(on, { HOME: '/home/k' }, ran, opts)
  const ui = await openReport($, clock, 'terminal')
  await $.ui.scroll({ component: 'Pane', requestId: PANE, by: 10 } as any)
  await clock.settle()
  const top = (await rowsOf(ui)).rows[0].id
  expect(top).not.toBe('R')
  const more = pbirFiles({ visuals: 40 })
  more[`${DEF}/pages/p1/visuals/v99/visual.json`] = JSON.stringify({ name: 'v99', position: { z: 99 }, visual: { visualType: 'card' } })
  opts.files = more
  await $.tool.call({ tool: 'Write', file_path: `${DEF}/pages/p1/visuals/v99/visual.json`, content: '' } as any)
  await clock.settle()
  expect(((mem.get(`${TREE.plugin}/${TREE.key}`)?.value as any).nodes as any[]).some(n => n.id === 'R/pages/p1/v99')).toBe(true)
  expect((await rowsOf(ui)).rows[0].id).toBe(top)
  await ui.unmount()
})

test('a pane that cannot open while Claude works or a session starts leaves no rejection unhandled, and the pane keeps working', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const opts: World = { files: pbirFiles() }
  const clock = world(on, { HOME: '/home/k' }, ran, opts)
  const ui = await openReport($, clock, 'terminal')
  opts.fail = true
  await $.tool.call({ tool: 'Bash', command: 'pbir get Sales.Report/Overview.Page' } as any)
  await clock.settle()
  const renamed = pbirFiles()
  renamed[`${DEF}/pages/p1/page.json`] = JSON.stringify({ name: 'p1', displayName: 'Summary' })
  opts.files = renamed
  await $.tool.call({ tool: 'Write', file_path: `${DEF}/pages/p1/page.json`, content: '' } as any)
  await clock.settle()
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.advance(3000)
  await clock.settle()
  opts.fail = false
  expect(state().changed).toContain('R/pages/p1')
  expect(state().work).toBeNull()
  await ui.post({ press: 'R/pages/p1' }, { in: 'rows' })
  await clock.settle()
  expect(state().selected).toBe('R/pages/p1')
  await ui.unmount()
})

test('/report-pane takes a report path with spaces, quoted or not', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const plain = JSON.stringify(await $.command.run({ command: PANE, args: 'KPI Cards.Report', origin: { kind: 'person' }, presentation: { isFullscreen: true, columns: 200 } } as any))
  expect(plain).toContain('KPI Cards')
  const quoted = JSON.stringify(await $.command.run({ command: PANE, args: '"My Sales.Report"', origin: { kind: 'person' }, presentation: { isFullscreen: true, columns: 200 } } as any))
  expect(quoted).toContain('My Sales')
})

test('a theme draws a paint palette in the brand and Nerd Font tiers', async () => {
  const nodes = await loadReport(ioOf(pbirFiles()), DIR)
  const theme = nodes.find(n => n.kind === 'theme')
  expect(theme).toBeDefined()
  expect(glyph(theme!, 'fabric').char).toBe('\u{f03d8}')
  expect(glyph(theme!, 'nerd').char).toBe('\u{f03d8}')
})

const segsOf = (client: any): any[] => (client?.props.props.rows ?? []).flatMap((r: any) => [...r.left, ...r.right])

function clockOf(tree: any): { working: string; shimmer: string[]; lit: string[] } {
  const working = findKey(tree, 'working')?.props.props.rows[0].left[0]?.sh ?? ''
  const shimmer = [...new Set([...segsOf(findKey(tree, 'head')), ...segsOf(findKey(tree, 'rows'))].map(seg => seg.sh).filter(Boolean))]
  const lit = (findKey(tree, 'rows')?.props.props.rows ?? []).filter((r: any) => r.left.some((seg: any) => seg.sh)).map((r: any) => r.id)
  return { working, shimmer, lit }
}

test('the working text and the row shimmer start with the command, stop when the flash after it ends, share one tone, and a new command restarts them', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const opts: World = {}
  const clock = world(on, { HOME: '/home/k' }, ran, opts)
  const ui = await mount($, clock, 'terminal', { kind: 'local', path: '/work/Sales.Report' })
  const samples: { at: string; working: string; shimmer: string[]; lit: string[] }[] = []
  const sample = async (at: string) => samples.push({ at, ...clockOf(await drawn(ui)) })
  opts.tool = async e => {
    await sample(`during ${e.command}`)
    return undefined
  }
  await $.tool.call({ tool: 'Bash', command: 'pbir set Sales.Report/Page03.Page --display-name X' } as any)
  await clock.advance(50)
  await sample('flash after set')
  await clock.advance(1000)
  await $.tool.call({ tool: 'Bash', command: 'pbir get Sales.Report/Page05.Page' } as any)
  await clock.advance(50)
  await sample('flash after get')
  await clock.advance(3000)
  await clock.settle()
  await sample('after the flash')
  await $.tool.call({ tool: 'Bash', command: 'pbir ls Sales.Report' } as any)
  await clock.settle()
  await sample('after a command that lit no rows')
  for (const s of samples) {
    expect({ at: s.at, both: Boolean(s.working) === s.shimmer.length > 0 }).toEqual({ at: s.at, both: true })
    expect({ at: s.at, tones: s.shimmer }).toEqual({ at: s.at, tones: s.working ? [s.working] : [] })
  }
  expect(samples.map(s => s.working)).toEqual(['orange', 'orange', 'purple', 'purple', '', 'purple', ''])
  expect(samples.map(s => s.lit)).toEqual([['T:3'], ['T:3'], ['T:5'], ['T:5'], [], [], []])
  await ui.unmount()
})

const VISUAL_TYPES = [
  'barChart', 'clusteredBarChart', 'hundredPercentStackedBarChart', 'columnChart', 'clusteredColumnChart', 'hundredPercentStackedColumnChart',
  'lineChart', 'areaChart', 'stackedAreaChart', 'hundredPercentStackedAreaChart', 'lineStackedColumnComboChart', 'lineClusteredColumnComboChart',
  'ribbonChart', 'waterfallChart', 'funnel', 'scatterChart', 'pieChart', 'donutChart', 'treemap', 'map', 'filledMap', 'azureMap', 'shapeMap',
  'gauge', 'card', 'cardVisual', 'multiRowCard', 'animatedNumber', 'kpi', 'scorecard', 'slicer', 'listSlicer', 'textSlicer', 'advancedSlicerVisual',
  'filterSlicer', 'table', 'tableEx', 'accessibleTable', 'matrix', 'pivotTable', 'heatMap', 'textbox', 'image', 'shape', 'basicShape',
  'actionButton', 'pageNavigator', 'bookmarkNavigator', 'decompositionTreeVisual', 'keyDriversVisual', 'qnaVisual', 'aiNarratives', 'rdlVisual',
  'scriptVisual', 'pythonVisual', 'dataQueryVisual', 'debugVisual', 'group',
]
const SAME_VISUAL: Record<string, string> = { stackedBarChart: 'barChart', stackedColumnChart: 'columnChart', keyInfluencers: 'keyDriversVisual', groupVisual: 'group' }
const PUA = /[\u{e000}-\u{f8ff}\u{f0000}-\u{fffff}]/u

test('every Power BI visual type draws its own glyph in the brand, Nerd Font and plain tiers, and plain draws nothing private-use', () => {
  const visual = (type: string, title = '') => ({ id: type, parent: '', kind: 'visual', name: title || type, path: '', hidden: false, sig: '', note: title ? type : '' })
  const unknown = { fabric: glyph(visual('someCustomVisual1234'), 'fabric').char, nerd: glyph(visual('someCustomVisual1234'), 'nerd').char, plain: glyph(visual('someCustomVisual1234'), 'plain').char }
  for (const tier of ['fabric', 'nerd', 'plain'] as Tier[]) {
    const chars = VISUAL_TYPES.map(type => glyph(visual(type), tier).char)
    expect({ tier, distinct: new Set(chars).size }).toEqual({ tier, distinct: VISUAL_TYPES.length })
    for (const [i, type] of VISUAL_TYPES.entries()) {
      const char = chars[i] ?? ''
      expect({ type, tier, fallback: char === unknown[tier as keyof typeof unknown] }).toEqual({ type, tier, fallback: false })
      expect({ type, tier, single: [...char].length }).toEqual({ type, tier, single: 1 })
      expect(glyph(visual(type, 'Sales by region'), tier).char).toBe(char)
      const cp = char.codePointAt(0) ?? 0
      if (tier === 'fabric') expect({ type, brand: cp >= 0xf2000 && cp <= 0xf28ff }).toEqual({ type, brand: true })
      if (tier === 'nerd') expect({ type, md: cp >= 0xf0001 && cp <= 0xf1af0 }).toEqual({ type, md: true })
      if (tier === 'plain') expect({ type, pua: PUA.test(char) }).toEqual({ type, pua: false })
    }
    for (const [alias, type] of Object.entries(SAME_VISUAL)) expect(glyph(visual(alias), tier).char).toBe(glyph(visual(type), tier).char)
  }
  expect(glyph(visual('clusteredColumnChart'), 'fabric').char).toBe(String.fromCodePoint(0xf2804))
  expect(glyph(visual('clusteredColumnChart'), 'nerd').char).toBe('\u{f0128}')
})

test('a custom visual shows its name as the label and a puzzle piece as its glyph', () => {
  const deneb = 'deneb7E15AEF80B9E4D4F8E12924291ECE89A'
  expect(visualLabel(deneb)).toBe('Deneb, custom visual')
  expect(visualLabel('areaChart')).toBe('areaChart')
  const n = { id: 'v', parent: 'p', kind: 'visual', name: 'Box plot', note: deneb, path: '', sig: '' } as any
  expect(glyph(n, 'nerd').char).toBe('\u{f0431}')
  expect(glyph(n, 'fabric').char).toBe('\u{f0431}')
  expect(glyph(n, 'plain').char).toBe('⧈')
})
