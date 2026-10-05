import { expect, mock, test } from 'claude-code/testing'

import { tokenize } from '../hooks/parse'

type Ran = string[][]
const envs: (Record<string, string> | undefined)[] = []
const opens: unknown[] = []
const closes: unknown[] = []
const toasts: string[] = []
let copyResult: unknown = { isCopied: true }
let failing: Record<string, { exitCode: number; stderr: string }> = {}
let files: Record<string, string> = {}
let found = ''
let cwd = '/elsewhere'
let foundBy: Record<string, string> = {}
let holdFinds = 0
let newer = ''
let repos: Record<string, string> = {}
let dirs: string[] = []
let surfaces: string[] = ['terminal']
let refuseApps = 0
let listing: Record<string, string[] | string> = {}
const statuses: string[] = []
let toolResult: any = { result: { stdout: '', stderr: '', interrupted: false } }
let onTool: (() => Promise<void>) | null = null
let fonts: Record<string, string> = {}
let refuseTree = false
const inits: unknown[] = []
const PLUGIN = 'fabric-data-app'
const PANE = 'fabric-app-pane'
const mem = new Map<string, { value: unknown; version: number }>()
const tree = (root: string) => ({
  root,
  nodes: Array.from({ length: 60 }, (_, i) => ({ id: `${root}/f${String(i).padStart(2, '0')}.ts`, parent: root, name: `f${String(i).padStart(2, '0')}.ts`, kind: 'file', hidden: false, mtime: 1_700_000_000_000, loaded: false })),
  expanded: [], cursor: '', selected: '', query: '', showHidden: true, git: {}, ignored: [], untrackedDirs: [], diff: {}, counts: {}, status: '',
  flash: [], flashDim: [], flashOn: false, flashTones: {}, scroll: null,
})

const local = (path: string) => path.replace(/\\/g, '/').replace(/^\/\/\?\//, '').replace(/^[A-Za-z]:(?=\/)/, '')

function world(on: any, env: Record<string, string>, ran: Ran, copied: string[]) {
  mem.clear()
  copyResult = { isCopied: true }
  failing = {}
  envs.length = 0
  files = {}
  found = ''
  cwd = '/elsewhere'
  foundBy = {}
  holdFinds = 0
  newer = ''
  repos = {}
  dirs = []
  surfaces = ['terminal']
  toolResult = { result: { stdout: '', stderr: '', interrupted: false } }
  refuseApps = 0
  listing = {}
  statuses.length = 0
  onTool = null
  fonts = {}
  refuseTree = false
  inits.length = 0
  on('state.get', (_$: any, e: any) => {
    const cur = mem.get(`${e.plugin}/${e.key}`)
    return { value: { value: cur?.value, version: cur?.version ?? 0 } }
  })
  on('state.set', (_$: any, e: any) => {
    if (e.key === 'apps' && refuseApps > 0) {
      refuseApps -= 1
      return { deny: 'apps write refused' }
    }
    if (e.key === 'tree' && refuseTree) return { deny: 'tree write refused' }
    const k = `${e.plugin}/${e.key}`
    if (e.key === 'tree' && e.value?.status && statuses[statuses.length - 1] !== e.value.status) statuses.push(e.value.status)
    const v = mem.get(k)?.version ?? 0
    if (e.ifVersion !== undefined && e.ifVersion !== v) return { value: { isSet: false, version: v, value: mem.get(k)?.value } }
    mem.set(k, { value: e.value, version: v + 1 })
    return { value: { isSet: true, version: v + 1 } }
  })
  mock.env(on, env)
  const clock = mock.clock(on, { now: 1_800_000_000_000 })
  mock.store(on)
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: cwd }))
  on('session.id', () => ({ value: 'test' }))
  on('session.surfaces', () => ({ value: surfaces }))
  on('tool.call', async () => {
    if (onTool) await onTool()
    return toolResult
  })
  on('prompt.submit', (_$: any, e: any) => ({ text: e.text, ...(e.context?.length ? { context: e.context } : {}) }))
  on('classic.SessionStart', () => ({}))
  on('command.register', () => ({ value: undefined }))
  on('ui.open', (_$: any, e: any) => {
    opens.push(e)
    return { value: { isPlaced: true } }
  })
  on('ui.close', (_$: any, e: any) => {
    closes.push(e)
    return {}
  })
  on('ui.toast', (_$: any, e: any) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.copy', (_$: any, e: any) => {
    copied.push(e.text)
    return { value: copyResult }
  })
  on('fs.read', (_$: any, e: any) => {
    const path = local(e.path)
    if (path in files) return { value: files[path] }
    throw new Error(`none: ${e.path}`)
  })
  on('fs.list', (_$: any, e: any) => {
    const got = listing[local(e.path)] ?? []
    if (typeof got === 'string') return { deny: got }
    return { value: got.map(name => ({ name: name.replace(/\/$/, ''), kind: name.endsWith('/') ? 'dir' : 'file', mtimeMs: 0, isLink: false })) }
  })
  on('fs.stat', (_$: any, e: any) => {
    const path = local(e.path)
    if (dirs.includes(path)) return { value: { kind: 'dir', size: 0, mtimeMs: 0, isLink: false } }
    if (path in files) return { value: { kind: 'file', size: 0, mtimeMs: 0, isLink: false } }
    throw new Error(`ENOENT: ${e.path}`)
  })
  on('process.run', async (_$: any, e: any) => {
    ran.push([...e.argv])
    inits.push(e.init)
    if (e.argv[0] === 'find' && e.argv.includes('-maxdepth') && holdFinds > 0) {
      holdFinds -= 1
      await clock.sleep(1_000)
    }
    envs.push(e.init?.env)
    if (e.argv[0] === 'git') {
      const dir = e.argv[e.argv.indexOf('-C') + 1]
      const sub = ['rev-parse', 'status', 'diff', 'ls-files'].find(x => e.argv.includes(x)) ?? ''
      const key = `${dir} ${sub}`
      const exitCode = sub === 'rev-parse' && !(key in repos) ? 128 : 0
      return { value: { exitCode, stdout: repos[key] ?? '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    const fail = failing[e.argv[0]]
    if (fail) return { value: { exitCode: fail.exitCode, stdout: '', stderr: fail.stderr, isStdoutTruncated: false, isStderrTruncated: false } }
    const out =
      e.argv[0] === 'uname' ? (env.HOME?.startsWith('/Users') ? 'Darwin\n' : 'Linux\n') : e.argv[0] === 'sh' ? `${fonts[e.argv[4]] ?? 'missing'}\n` : e.argv[0] === 'find' && e.argv.includes('-maxdepth')
          ? (foundBy[e.argv[2]] ?? found)
          : e.argv[0] === 'find' && e.argv.includes('-newermt')
            ? newer
            : ''
    return { value: { exitCode: 0, stdout: out, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  return clock
}

function put(store: typeof mem, fn: (t: any) => any) {
  const cur = store.get(`${PLUGIN}/tree`)
  store.set(`${PLUGIN}/tree`, { value: fn(cur?.value), version: (cur?.version ?? 0) + 1 })
}

const shine = (t: any): Record<string, string> => ({ ...t.flashTones, ...(t.work ? Object.fromEntries([...t.work.lit, ...t.work.dim].map((id: string) => [id, t.work.tone])) : {}) })

const app = (dir: string, extra: Record<string, unknown> = {}) => ({ dir, name: dir.split('/').pop(), title: dir.split('/').pop(), cli: 'rayfin', workspace: '', item: '', portal: '', hosting: '', sources: [], error: '', ...extra })

async function seeded($: any, clock: any, root: string, dirs: string[]) {
  await $.session.start({ cwd: root, surface: 'terminal', isInteractive: true })
  await clock.settle()
  mem.set(`${PLUGIN}/tree`, { value: { ...tree(root), nodes: dirs.map(d => ({ id: d, parent: root, name: d.split('/').pop(), kind: 'dir', hidden: false, mtime: 0, loaded: false })) }, version: 1 })
  mem.set(`${PLUGIN}/apps`, { value: dirs.map(d => app(d)), version: 1 })
}

const paneProps = { title: 'Apps', isFocused: false, bodyColumns: 70, placement: 'dock', scroll: { offset: 0, bodyRows: 24 }, view: {} } as any
const rowsOf = async (ui: any) => {
  await ui.redraw()
  const find = (n: any): any => (n?.type === 'Client' && n.props?.key === 'rows' ? n : (n?.children ?? []).map(find).find(Boolean))
  return find(await ui.drawn())?.props.props
}

async function mount($: any, clock: any, surface: 'terminal' | 'desktop', root: string) {
  await $.session.start({ cwd: '/elsewhere', surface, isInteractive: true })
  await clock.settle()
  mem.set(`${PLUGIN}/tree`, { value: tree(root), version: (mem.get(`${PLUGIN}/tree`)?.version ?? 0) + 1 })
  const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: PANE, props: paneProps })
  await clock.settle()
  return ui
}

test('macOS app: long app trees scroll, copy relative paths, and open files with open', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const copied: string[] = []
  const clock = world(on, { HOME: '/Users/k' }, ran, copied)
  const root = '/Users/k/My App'
  const ui = await mount($, clock, 'desktop', root)
  let p = await rowsOf(ui)
  expect(p.bar).toBeDefined()
  expect(JSON.stringify(p.rows)).not.toContain('below')
  await $.ui.scroll({ component: 'Pane', requestId: PANE, by: 1 } as any)
  await clock.settle()
  await ui.redraw()
  p = await rowsOf(ui)
  expect(p.rows[0].id).toBe(`${root}/f03.ts`)
  await ui.post({ copy: `${root}/f05.ts` }, { in: 'rows' })
  await clock.settle()
  expect(copied).toEqual(['f05.ts'])
  expect(toasts[toasts.length - 1]).toBe('Copied f05.ts')
  copyResult = { isCopied: false, reason: 'no-clipboard' }
  await ui.post({ copy: `${root}/f06.ts` }, { in: 'rows' })
  await clock.settle()
  expect(toasts[toasts.length - 1]).toBe('Could not copy: no-clipboard')
  await ui.post({ press: `${root}/f05.ts`, ctrl: true }, { in: 'rows' })
  await clock.settle()
  expect(ran).toContainEqual(['open', '--', `${root}/f05.ts`])
  failing.open = { exitCode: 1, stderr: `The file ${root}/f07.ts does not exist.\n` }
  await ui.post({ press: `${root}/f07.ts`, ctrl: true }, { in: 'rows' })
  await clock.settle()
  expect(toasts[toasts.length - 1]).toBe(`could not open ${root}/f07.ts with open: The file ${root}/f07.ts does not exist.`)
  await ui.unmount()
})

test('Windows: files and links open through ShellExecute with the target as a literal, never through cmd', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { OS: 'Windows_NT', USERPROFILE: 'C:\\Users\\k' }, ran, [])
  const root = 'C:/Apps/R&D App'
  const portal = 'https://app.fabric.microsoft.com/groups/w/appbackends/i?experience=fabric-developer&a=1|b'
  const ui = await mount($, clock, 'terminal', root)
  mem.set(`${PLUGIN}/apps`, { value: [{ dir: `${root}/f10.ts`, name: 'f10', title: 'f10', cli: 'rayfin', workspace: '', item: '', portal, hosting: '', sources: [] }], version: 1 })
  await ui.post({ press: `${root}/f05.ts`, ctrl: true }, { in: 'rows' })
  await clock.settle()
  await ui.post({ press: `${root}/f10.ts`, ctrl: true }, { in: 'rows' })
  await clock.settle()
  const opened = ran.map((argv, i) => [argv, envs[i]] as const).filter(([argv]) => argv[0] === 'powershell')
  expect(opened.map(([argv]) => argv.slice(0, 4))).toEqual([['powershell', '-NoProfile', '-NonInteractive', '-Command'], ['powershell', '-NoProfile', '-NonInteractive', '-Command']])
  expect(opened.every(([argv]) => argv.length === 5 && !argv.some(a => a.includes('R&D') || a.includes('fabric-developer')))).toBe(true)
  expect(opened.map(([, env]) => env?.PANE_OPEN_TARGET)).toEqual(['C:\\Apps\\R&D App\\f05.ts', portal])
  expect(ran.some(a => a[0] === 'cmd')).toBe(false)
  expect(ran.some(a => ['setsid', 'osascript', 'uname', 'find', 'touch'].includes(a[0] ?? ''))).toBe(false)
  await ui.unmount()
})

test('sidebar only: no pane in the default layout or a narrow terminal, and an inline pane closes itself', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const copied: string[] = []
  const clock = world(on, { HOME: '/Users/k' }, ran, copied)
  const before = opens.length
  const main = await $.command.run({ command: 'fabric-app-pane', args: '', origin: { kind: 'person' }, presentation: { isFullscreen: false, columns: 200 } } as any)
  expect(JSON.stringify(main)).toContain('/tui fullscreen')
  const narrow = await $.command.run({ command: 'fabric-app-pane', args: '', origin: { kind: 'person' }, presentation: { isFullscreen: true, columns: 90 } } as any)
  expect(JSON.stringify(narrow)).toContain('110 columns')
  expect(opens.length).toBe(before)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: { ...paneProps, placement: 'inline' } })
  await clock.settle()
  expect(closes.length).toBeGreaterThan(0)
  await ui.unmount()
  void copied
})

test('discovery: NUL-separated paths survive newlines in names, and an app with malformed deployment metadata still loads beside the others and shows why', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  cwd = '/work'
  found = '/work/a/rayfin/rayfin.yml\0/work/team\nblue/rayfin/rayfin.yml\0'
  files = {
    '/work/a/rayfin/rayfin.yml': 'name: alpha\n',
    '/work/a/rayfin/.deployments.json': '{"deployments":{"x":{"fabricItemId":"id","fabricDeepLink":123}}}',
    '/work/team\nblue/rayfin/rayfin.yml': 'name: beta\n',
  }
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const apps = mem.get(`${PLUGIN}/apps`)?.value as any[]
  expect(apps.map(a => a.name)).toEqual(['alpha', 'beta'])
  expect(apps[1].dir).toBe('/work/team\nblue')
  expect(ran.find(a => a[0] === 'find')?.at(-1)).toBe('-print0')
  expect(apps[0].item).toBe('id')
  expect(apps[0].error).toContain('x.fabricDeepLink')
  expect(apps[1].error).toBe('')
  put(mem, t => ({ ...t, expanded: ['/work/a'] }))
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: paneProps })
  await clock.settle()
  expect(JSON.stringify((await rowsOf(ui)).rows)).toContain('x.fabricDeepLink')
  await ui.unmount()
})

test('the command resolves . and .. to a canonical folder, keeps the filesystem root, and refuses what is not a folder', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  cwd = '/work/app'
  dirs = ['/', '/work/app', '/work']
  files = { '/work/app/notes.txt': 'x\n' }
  const run = (args: string) => $.command.run({ command: 'fabric-app-pane', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } } as any)
  const rootOf = () => (mem.get(`${PLUGIN}/tree`)?.value as any)?.root
  await run('.')
  expect(rootOf()).toBe('/work/app')
  await run('./../app/../')
  expect(rootOf()).toBe('/work')
  await run('/')
  expect(rootOf()).toBe('/')
  expect(ran.filter(a => a[0] === 'find').map(a => a[2])).toEqual(['/work/app', '/work', '/'])
  expect(JSON.stringify(await run('nope'))).toContain('No folder at /work/app/nope')
  expect(JSON.stringify(await run('notes.txt'))).toContain('/work/app/notes.txt is not a folder')
  expect(rootOf()).toBe('/')
  void clock
})

test('Desktop: the command opens the pane whatever the terminal presentation says', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/Users/k' }, ran, [])
  surfaces = ['desktop']
  const before = opens.length
  const out = await $.command.run({ command: 'fabric-app-pane', args: '', origin: { kind: 'sdk' }, presentation: { isFullscreen: false, columns: 80 } } as any)
  await clock.settle()
  expect(JSON.stringify(out)).not.toContain('/tui fullscreen')
  expect(JSON.stringify(out)).toContain('Fabric apps under /elsewhere')
  expect(opens.length).toBe(before + 1)
})

test('Bash: a command that exits nonzero still refreshes what it changed', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  await seeded($, clock, '/work', ['/work/app'])
  ran.length = 0
  toolResult = { isError: true, result: 'Exit code 1', text: 'Exit code 1' }
  await $.tool.call({ tool: 'Bash', command: 'printf updated >> /work/app/keep.txt; false' } as any)
  await clock.settle()
  expect(ran.some(a => a[0] === 'find' && a.includes('/work/app') && a.includes('-newermt'))).toBe(true)
})

test('Bash: a background deploy refreshes when its task-notification arrives, not when it starts', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  await seeded($, clock, '/work', ['/work/app'])
  found = '/work/app/rayfin/rayfin.yml\0'
  files = { '/work/app/rayfin/rayfin.yml': 'name: app\n' }
  ran.length = 0
  toolResult = { result: { stdout: '', stderr: '', interrupted: false, backgroundTaskId: 'bq7x2k' } }
  await $.tool.call({ tool: 'Bash', command: 'cd /work/app && rayfin up', run_in_background: true } as any)
  await clock.settle()
  await clock.advance(5_000)
  expect(ran.some(a => a[0] === 'find')).toBe(false)
  await $.prompt.submit({ text: '<task-notification><task-id>other</task-id><status>completed</status></task-notification>', wait: false, origin: { kind: 'task-notification' } } as any)
  await clock.settle()
  expect(ran.some(a => a[0] === 'find')).toBe(false)
  files['/work/app/rayfin/.deployments.json'] = JSON.stringify({ deployments: { prod: { fabricWorkspaceId: '11111111-1111-1111-1111-111111111111', fabricItemId: '22222222-2222-2222-2222-222222222222' } } })
  await $.prompt.submit({ text: '<task-notification><task-id>bq7x2k</task-id><status>completed</status></task-notification>', wait: false, origin: { kind: 'task-notification' } } as any)
  await clock.settle()
  expect(ran.some(a => a[0] === 'find' && a.includes('-maxdepth'))).toBe(true)
  expect((mem.get(`${PLUGIN}/apps`)?.value as any[])[0].item).toBe('22222222-2222-2222-2222-222222222222')
  expect(shine(mem.get(`${PLUGIN}/tree`)?.value)['/work/app']).toBe('teal')
})

test('Bash: a refresh that fails reports it and the scans queued behind it still run', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  await seeded($, clock, '/work', ['/work/app'])
  found = '/work/app/rayfin/rayfin.yml\0/work/next/rayfin/rayfin.yml\0'
  files = { '/work/app/rayfin/rayfin.yml': 'name: app\n', '/work/next/rayfin/rayfin.yml': 'name: next\n' }
  ran.length = 0
  refuseApps = 1
  await Promise.all([$.tool.call({ tool: 'Bash', command: 'rayfin init one' } as any), $.tool.call({ tool: 'Bash', command: 'rayfin init two' } as any)])
  await clock.settle()
  expect(ran.filter(a => a[0] === 'find' && a.includes('-maxdepth')).length).toBe(2)
  expect((mem.get(`${PLUGIN}/apps`)?.value as any[]).map(a => a.dir)).toEqual(['/work/app', '/work/next'])
  expect(statuses.some(x => /^refresh failed: .*apps write refused$/.test(x))).toBe(true)
})

test('a listing that fails keeps the cached children, stays retryable, and says why', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  await seeded($, clock, '/work', ['/work/app'])
  found = '/work/app/rayfin/rayfin.yml\0'
  files = { '/work/app/rayfin/rayfin.yml': 'name: app\n' }
  listing = { '/work/app': ['src/', 'package.json'] }
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: paneProps })
  await clock.settle()
  await ui.post({ press: '/work/app' }, { in: 'rows' })
  await clock.settle()
  const nodes = () => (mem.get(`${PLUGIN}/tree`)?.value as any).nodes as any[]
  expect(nodes().map(n => n.id)).toEqual(['/work/app', '/work/app/src', '/work/app/package.json'])
  listing = { '/work/app': 'EACCES: permission denied', '/work/app/src': 'EACCES: permission denied' }
  await ui.press({ key: 'rescan' })
  await clock.settle()
  expect(nodes().map(n => n.id)).toEqual(['/work/app', '/work/app/src', '/work/app/package.json'])
  expect(nodes()[0].loaded).toBe(true)
  await ui.redraw()
  expect(await ui.find({ type: 'Text', text: /^could not list \/work\/app \(.*EACCES: permission denied\)$/ })).toBeDefined()
  await ui.post({ press: '/work/app/src' }, { in: 'rows' })
  await clock.settle()
  expect(nodes().find(n => n.id === '/work/app/src').loaded).toBe(false)
  listing = { '/work/app': ['src/', 'package.json'], '/work/app/src': ['main.ts'] }
  await clock.advance(1_000)
  await ui.post({ press: '/work/app/src' }, { in: 'rows' })
  await clock.settle()
  expect(nodes().find(n => n.id === '/work/app/src').loaded).toBe(true)
  expect(nodes().map(n => n.id)).toContain('/work/app/src/main.ts')
  await ui.redraw()
  expect(await ui.find({ type: 'Text', text: /could not list/ })).toBeUndefined()
  await ui.unmount()
})

test('nested apps: the inner app is one node at the top, never a second copy inside the outer app', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  cwd = '/work'
  found = '/work/outer/rayfin/rayfin.yml\0'
  files = { '/work/outer/rayfin/rayfin.yml': 'name: outer\n', '/work/outer/inner/rayfin/rayfin.yml': 'name: inner\n' }
  listing = { '/work/outer': ['inner/', 'rayfin/'], '/work/outer/inner': ['rayfin/'] }
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: paneProps })
  await ui.post({ press: '/work/outer' }, { in: 'rows' })
  await clock.settle()
  const ids = () => ((mem.get(`${PLUGIN}/tree`)?.value as any).nodes as any[]).map(n => n.id)
  expect(ids()).toContain('/work/outer/inner')
  found = '/work/outer/rayfin/rayfin.yml\0/work/outer/inner/rayfin/rayfin.yml\0'
  await ui.press({ key: 'rescan' })
  await clock.settle()
  expect(ids().filter(id => id === '/work/outer/inner')).toHaveLength(1)
  await clock.advance(1_000)
  await ui.post({ press: '/work/outer/inner' }, { in: 'rows' })
  await clock.settle()
  await clock.advance(1_000)
  await ui.post({ press: '/work/outer' }, { in: 'rows' })
  await clock.settle()
  await clock.advance(1_000)
  await ui.post({ press: '/work/outer' }, { in: 'rows' })
  await clock.settle()
  expect(ids().filter(id => id === '/work/outer/inner')).toHaveLength(1)
  expect(ids().filter(id => id === '/work/outer/inner/rayfin')).toHaveLength(1)
  expect(((mem.get(`${PLUGIN}/tree`)?.value as any).nodes as any[]).find(n => n.id === '/work/outer/inner').parent).toBe('/work')
  await ui.unmount()
})

test('a rescan that finishes after the root moved publishes nothing over the new root', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  dirs = ['/A', '/B']
  foundBy = { '/A': '/A/app/rayfin/rayfin.yml\0', '/B': '/B/app/rayfin/rayfin.yml\0' }
  files = { '/A/app/rayfin/rayfin.yml': 'name: a\n', '/B/app/rayfin/rayfin.yml': 'name: b\n' }
  await seeded($, clock, '/A', ['/A/app'])
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: paneProps })
  holdFinds = 1
  const rescan = ui.press({ key: 'rescan' })
  await clock.settle()
  await $.command.run({ command: 'fabric-app-pane', args: '/B', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } } as any)
  await clock.settle()
  await clock.advance(2_000)
  await rescan
  await clock.settle()
  const t = mem.get(`${PLUGIN}/tree`)?.value as any
  expect(t.root).toBe('/B')
  expect((mem.get(`${PLUGIN}/apps`)?.value as any[]).map(a => a.dir)).toEqual(['/B/app'])
  expect(t.nodes.map((n: any) => n.id)).toEqual(['/B/app'])
  await ui.unmount()
})

test('edits to an app\'s data source files refresh its sources, by Write and by Bash', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  found = '/work/app/rayfin/rayfin.yml\0'
  files = { '/work/app/rayfin/rayfin.yml': 'name: app\n' }
  await seeded($, clock, '/work', ['/work/app'])
  const sources = () => ((mem.get(`${PLUGIN}/apps`)?.value as any[])[0].sources as any[]).map(x => x.name)
  ran.length = 0
  files['/work/app/fabric.yaml'] = 'semanticModels:\n  sales:\n    itemId: 33333333-3333-3333-3333-333333333333\n'
  await $.tool.call({ tool: 'Write', file_path: '/work/app/fabric.yaml', content: files['/work/app/fabric.yaml'] } as any)
  await clock.settle()
  expect(sources()).toEqual(['sales'])
  expect(ran.some(a => a[0] === 'find' && a.includes('-maxdepth'))).toBe(false)
  files['/work/app/fabric.yaml'] += '  finance:\n    itemId: 44444444-4444-4444-4444-444444444444\n'
  newer = '/work/app/fabric.yaml\0'
  await clock.advance(1_000)
  await $.tool.call({ tool: 'Bash', command: 'cat more.yaml >> /work/app/fabric.yaml' } as any)
  await clock.settle()
  expect(sources()).toEqual(['sales', 'finance'])
})

test('after /clear, /resume or /branch resets the pane state, the pane rebuilds it; compaction leaves it alone', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  cwd = '/work'
  found = '/work/app/rayfin/rayfin.yml\0'
  files = { '/work/app/rayfin/rayfin.yml': 'name: app\n' }
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const wipe = () => ['tree', 'apps', 'theme'].forEach(k => mem.delete(`${PLUGIN}/${k}`))
  for (const source of ['clear', 'resume', 'fork'] as const) {
    wipe()
    await $.classic.SessionStart({ source } as any)
    await clock.settle()
    expect((mem.get(`${PLUGIN}/tree`)?.value as any)?.root).toBe('/work')
    expect((mem.get(`${PLUGIN}/apps`)?.value as any[])?.map(a => a.dir)).toEqual(['/work/app'])
    expect(mem.get(`${PLUGIN}/theme`)?.value).toBeDefined()
  }
  wipe()
  ran.length = 0
  await $.classic.SessionStart({ source: 'compact' } as any)
  await clock.settle()
  expect(ran.some(a => a[0] === 'find')).toBe(false)
  expect(mem.get(`${PLUGIN}/tree`)).toBeUndefined()
})

test('git status comes from each app\'s own repository when the shown root is not one', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  cwd = '/work/app'
  found = '/work/app/rayfin/rayfin.yml\0/work/app/nested/rayfin/rayfin.yml\0'
  files = { '/work/app/rayfin/rayfin.yml': 'name: app\n', '/work/app/nested/rayfin/rayfin.yml': 'name: nested\n' }
  repos = {
    '/work/app rev-parse': '\n/work/app\n',
    '/work/app/nested rev-parse': 'nested/\n/work/app\n',
    '/work/app status': ' M src/main.ts\0?? new.ts\0!! dist/\0',
    '/work/app diff': '3\t1\tsrc/main.ts\0',
  }
  await $.session.start({ cwd: '/work/app', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const t = mem.get(`${PLUGIN}/tree`)?.value as any
  expect(t.root).toBe('/work')
  expect(t.git['/work/app/src/main.ts']).toBe('M')
  expect(t.git['/work/app']).toBe('M')
  expect(t.diff['/work/app/src/main.ts']).toEqual([3, 1])
  expect(t.counts['/work/app']).toEqual([1, 1, 0])
  expect(t.ignored).toEqual(['/work/app/dist'])
  expect(ran.filter(a => a[0] === 'git' && a.includes('status')).map(a => a[a.indexOf('-C') + 1])).toEqual(['/work/app'])
})

test('an app that is its own repository inside the root repository reads its status from its own repository', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  cwd = '/work'
  found = '/work/a/rayfin/rayfin.yml\0/work/b/rayfin/rayfin.yml\0'
  files = { '/work/a/rayfin/rayfin.yml': 'name: a\n', '/work/b/rayfin/rayfin.yml': 'name: b\n' }
  repos = {
    '/work rev-parse': '\n/work\n',
    '/work status': ' M a/x.ts\0?? b/\0',
    '/work/b rev-parse': '\n/work/b\n',
    '/work/b status': 'A  y.ts\0',
  }
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const t = mem.get(`${PLUGIN}/tree`)?.value as any
  expect(t.git['/work/a/x.ts']).toBe('M')
  expect(t.git['/work/b/y.ts']).toBe('A')
  expect(t.git['/work/b']).toBe('A')
  expect(t.untrackedDirs).toEqual([])
  expect(ran.filter(a => a[0] === 'git' && a.includes('rev-parse')).map(a => a[2])).toEqual(['/work', '/work/b'])
})

const FILES = Array.from({ length: 60 }, (_, i) => `f${String(i).padStart(2, '0')}.ts`)
const NERD = /[\u{e000}-\u{f8ff}\u{f0000}-\u{10ffff}]/u
const node = (id: string, kind: string, loaded = false) => ({ id, parent: id.slice(0, id.lastIndexOf('/')) || '/', name: id.split('/').pop(), kind, hidden: false, mtime: 0, loaded })

async function deepApp($: any, clock: any, extra: string[] = []) {
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  listing = { '/work/app': ['src/'], '/work/app/src': [...extra, ...FILES] }
  const nodes = [node('/work/app', 'dir', true), node('/work/app/src', 'dir', true), ...FILES.map(f => node(`/work/app/src/${f}`, 'file'))]
  mem.set(`${PLUGIN}/tree`, { value: { ...tree('/work'), nodes, expanded: ['/work/app', '/work/app/src'] }, version: (mem.get(`${PLUGIN}/tree`)?.version ?? 0) + 1 })
  mem.set(`${PLUGIN}/apps`, { value: [app('/work/app')], version: (mem.get(`${PLUGIN}/apps`)?.version ?? 0) + 1 })
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: paneProps })
  await clock.settle()
  return ui
}

const ids = async (ui: any) => ((await rowsOf(ui)).rows as any[]).map(r => r.id)

test('the pane is fabric-app-pane: /fabric-app-pane opens it under that id and title, and its state lives under that plugin name', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  cwd = '/work'
  found = '/work/app/rayfin/rayfin.yml\0'
  files = { '/work/app/rayfin/rayfin.yml': 'name: app\n' }
  const before = opens.length
  const out = await $.command.run({ command: 'fabric-app-pane', args: '', origin: { kind: 'person' }, presentation: { isFullscreen: true, columns: 200 } } as any)
  await clock.settle()
  expect(JSON.stringify(out)).toContain('1 Fabric app under /work')
  expect(opens.slice(before)).toContainEqual(expect.objectContaining({ id: 'fabric-app-pane', title: 'Fabric apps: work' }))
  expect((mem.get('fabric-data-app/apps')?.value as any[]).map(a => a.dir)).toEqual(['/work/app'])
})

test('the selection uses the theme default #3e4451 and the hover bar is clearly fainter', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  const ui = await mount($, clock, 'terminal', '/work')
  const p = await rowsOf(ui)
  const sum = (hex: string) => [1, 3, 5].reduce((n, i) => n + parseInt(hex.slice(i, i + 2), 16), 0)
  expect(p.activeBg).toBe('#3e4451')
  expect(sum(p.hoverBg)).toBeLessThan(sum(p.activeBg) - 30)
  await ui.unmount()
})

test('double-clicking an app or folder goes into it; up and home come back, and a double-clicked file still opens', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  await seeded($, clock, '/work', ['/work/app', '/work/other'])
  listing = { '/work/app': ['src/', 'package.json'], '/work/app/src': ['main.ts'] }
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: paneProps })
  await clock.settle()
  const twice = async (id: string) => {
    await clock.advance(1_000)
    await ui.post({ press: id }, { in: 'rows' })
    await clock.advance(100)
    await ui.post({ press: id }, { in: 'rows' })
    await clock.settle()
  }
  expect(await ui.find({ type: 'Button', key: 'up' })).toBeUndefined()
  await twice('/work/app')
  await ui.redraw()
  let shown = await ids(ui)
  expect(shown).toContain('/work/app/src')
  expect(shown).not.toContain('/work/app')
  expect(shown).not.toContain('/work/other')
  expect(JSON.stringify((await rowsOf(ui)).rows[0])).toContain('no data sources configured')
  expect(await ui.find({ type: 'Text', text: /^app {2}2 apps$/ })).toBeDefined()
  await twice('/work/app/src')
  expect(await ids(ui)).toEqual(['/work/app/src/main.ts'])
  await ui.press({ key: 'up' })
  await clock.settle()
  expect(await ids(ui)).toContain('/work/app/package.json')
  await ui.press({ key: 'home' })
  await clock.settle()
  shown = await ids(ui)
  expect(shown).toContain('/work/other')
  await ui.redraw()
  expect(await ui.find({ type: 'Button', key: 'home' })).toBeUndefined()
  await twice('/work/app/package.json')
  expect(ran.some(a => a[0] === 'sh' && a[2]?.includes('setsid -f -w') && a.includes('/work/app/package.json'))).toBe(true)
  await ui.unmount()
})

test('Claude\'s commands and edits never move your cursor or selection, even when they pull the view out of a folder you went into', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  cwd = '/work/other'
  found = '/work/app/rayfin/rayfin.yml\0/work/other/rayfin/rayfin.yml\0'
  files = { '/work/app/rayfin/rayfin.yml': 'name: app\n', '/work/other/rayfin/rayfin.yml': 'name: other\n' }
  await seeded($, clock, '/work', ['/work/app', '/work/other'])
  listing = { '/work/app': ['src/', 'package.json'], '/work/other': ['x.ts'] }
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: paneProps })
  await clock.settle()
  await ui.post({ press: '/work/app' }, { in: 'rows' })
  await clock.advance(100)
  await ui.post({ press: '/work/app' }, { in: 'rows' })
  await clock.settle()
  await clock.advance(1_000)
  await ui.post({ press: '/work/app/package.json' }, { in: 'rows' })
  await clock.settle()
  const t = () => mem.get(`${PLUGIN}/tree`)?.value as any
  expect(t().cursor).toBe('/work/app/package.json')
  await $.tool.call({ tool: 'Write', file_path: '/work/other/x.ts', content: '' } as any)
  await clock.settle()
  await $.tool.call({ tool: 'Bash', command: 'rayfin up' } as any)
  await clock.settle()
  expect(t().top).toBe('')
  expect((await rowsOf(ui)).active).toBe('/work/app/package.json')
  expect(t().selected).toBe('/work/app/package.json')
  await clock.advance(3_000)
  await clock.settle()
  expect((await rowsOf(ui)).active).toBe('/work/app/package.json')
  await ui.unmount()
})

test('follow: a highlight on rows already in view does not scroll, whether or not you scrolled first', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  const ui = await deepApp($, clock)
  expect((await ids(ui))[0]).toBe('/work/app')
  await $.tool.call({ tool: 'Write', file_path: '/work/app/src/f05.ts', content: '' } as any)
  await clock.settle()
  expect(JSON.stringify((await rowsOf(ui)).rows)).toContain('"sh":"orange"')
  expect((await ids(ui))[0]).toBe('/work/app')
  await clock.advance(3_000)
  await $.ui.scroll({ component: 'Pane', requestId: PANE, by: 3 } as any)
  await clock.settle()
  expect((await ids(ui))[0]).toBe('/work/app/src/f00.ts')
  await $.tool.call({ tool: 'Write', file_path: '/work/app/src/f10.ts', content: '' } as any)
  await clock.settle()
  expect((await ids(ui))[0]).toBe('/work/app/src/f00.ts')
  await ui.unmount()
})

test('follow: Claude far down the tree keeps the target\'s whole ancestor chain pinned and scrolls only until the target shows near the bottom', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  const ui = await deepApp($, clock)
  await $.tool.call({ tool: 'Write', file_path: '/work/app/src/f50.ts', content: '' } as any)
  await clock.settle()
  const shown = await ids(ui)
  expect(shown.slice(0, 2)).toEqual(['/work/app', '/work/app/src'])
  const at = shown.indexOf('/work/app/src/f50.ts')
  expect(at).toBeGreaterThan(shown.length - 5)
  expect(at).toBeLessThan(shown.length)
  await ui.unmount()
})

test('follow off: rows Claude adds above the view never push it down; the wheel still moves it', { timeoutMs: 20_000, options: { follow: 'off' } } as any, async ($: any, on: any) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  const ui = await deepApp($, clock, ['a-new.ts'])
  await $.ui.scroll({ component: 'Pane', requestId: PANE, by: 20 })
  await clock.settle()
  const top = (await ids(ui))[0]
  expect(top).toBe('/work/app/src/f17.ts')
  await $.tool.call({ tool: 'Write', file_path: '/work/app/src/a-new.ts', content: '' } as any)
  await clock.settle()
  expect(((mem.get(`${PLUGIN}/tree`)?.value as any).nodes as any[]).some(n => n.id === '/work/app/src/a-new.ts')).toBe(true)
  expect((await ids(ui))[0]).toBe(top)
  await $.ui.scroll({ component: 'Pane', requestId: PANE, by: 5 })
  await clock.settle()
  expect((await ids(ui))[0]).not.toBe(top)
  await ui.unmount()
})

test('while Claude\'s app command runs, the search row shows marching text in its tone; a typed query keeps the search box', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  cwd = '/work/app'
  await seeded($, clock, '/work', ['/work/app'])
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: paneProps })
  await clock.settle()
  let during: any = null
  let input: any = null
  let marching = ''
  const working = async () => {
    await ui.redraw()
    const find = (n: any): any => (n?.type === 'Client' && n.props?.key === 'working' ? n : (n?.children ?? []).map(find).find(Boolean))
    return find(await ui.drawn())?.props.props
  }
  onTool = async () => {
    during = await working()
    input = await ui.find({ type: 'Input', key: 'q' })
    marching = JSON.stringify(await ui.drawn({ in: 'working' }))
  }
  await $.tool.call({ tool: 'Bash', command: 'rayfin env list' } as any)
  expect(input).toBeUndefined()
  expect(marching).toContain('"C"')
  expect(marching).toContain('#f97316')
  onTool = async () => {
    during = await working()
  }
  await $.tool.call({ tool: 'Bash', command: 'rayfin env list' } as any)
  expect(during.rows[0].left[0]).toEqual({ t: 'Claude is working in Fabric...', sh: 'orange' })
  await $.tool.call({ tool: 'Bash', command: 'rayfin up' } as any)
  expect(during.rows[0].left[0].sh).toBe('teal')
  await clock.settle()
  expect(await working()).toBeUndefined()
  expect(await ui.find({ type: 'Input', key: 'q' })).toBeDefined()
  put(mem, t => ({ ...t, query: 'app' }))
  await ui.redraw()
  onTool = async () => {
    during = await working()
    input = await ui.find({ type: 'Input', key: 'q' })
  }
  await $.tool.call({ tool: 'Bash', command: 'rayfin up' } as any)
  expect(during).toBeUndefined()
  expect(input).toBeDefined()
  await ui.unmount()
})

test('working text and row shimmer share one clock: both start with Claude\'s command, both stop when the flash after it ends, in one tone, and a new command restarts them', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  cwd = '/work/app'
  found = '/work/app/rayfin/rayfin.yml\0'
  files = { '/work/app/rayfin/rayfin.yml': 'name: app\n' }
  await seeded($, clock, '/work', ['/work/app'])
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: paneProps })
  await clock.settle()
  const sample = async () => {
    await ui.redraw()
    const drawn = await ui.drawn()
    const find = (key: string) => (n: any): any => (n?.type === 'Client' && n.props?.key === key ? n : (n?.children ?? []).map(find(key)).find(Boolean))
    const text = find('working')(drawn)?.props.props.rows[0]?.left[0]
    const segs = ((find('rows')(drawn)?.props.props.rows ?? []) as any[]).flatMap(r => [...r.left, ...r.right])
    return { text: text ? [text.sh] : [], rows: [...new Set(segs.map(x => x.sh).filter(Boolean))] }
  }
  const samples: { at: string; text: string[]; rows: string[] }[] = []
  const take = async (at: string) => {
    const s = await sample()
    samples.push({ at, ...s })
    return s
  }
  onTool = async () => {
    await take('during deploy')
  }
  await $.tool.call({ tool: 'Bash', command: 'rayfin up' } as any)
  await take('deploy returned')
  await clock.settle()
  await take('flash start')
  await clock.advance(1_500)
  await take('mid flash')
  await clock.advance(1_500)
  await clock.settle()
  await take('after flash')
  for (const s of samples) expect({ at: s.at, rows: s.rows }).toEqual({ at: s.at, rows: s.text })
  expect(samples.map(s => s.text.join())).toEqual(['teal', 'teal', 'teal', 'teal', ''])
  samples.length = 0
  onTool = null
  await $.tool.call({ tool: 'Bash', command: 'rayfin up' } as any)
  await clock.settle()
  await clock.advance(2_000)
  await take('old flash')
  onTool = async () => {
    await take('during list')
  }
  await $.tool.call({ tool: 'Bash', command: 'rayfin env list' } as any)
  onTool = null
  await clock.settle()
  await take('list returned, nothing lit')
  await clock.advance(1_000)
  await clock.settle()
  await take('past the old flash')
  for (const s of samples) expect({ at: s.at, rows: s.rows }).toEqual({ at: s.at, rows: s.text })
  expect(samples.map(s => s.text.join())).toEqual(['teal', 'orange', '', ''])
  await ui.unmount()
})

test('auto glyphs use FabricSymbols only when a Nerd Font is installed too', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  fonts = { f2002: 'ok' }
  await seeded($, clock, '/work', ['/work/app'])
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: paneProps })
  await clock.settle()
  const appRow = async () => JSON.stringify(((await rowsOf(ui)).rows as any[]).find(r => r.id === '/work/app'))
  expect(await appRow()).not.toContain(String.fromCodePoint(991302))
  expect(await appRow()).toContain('▣')
  await ui.unmount()
  fonts = { f2002: 'ok', f04eb: 'ok' }
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const again = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: paneProps })
  await clock.settle()
  expect(JSON.stringify(((await rowsOf(again)).rows as any[]).find(r => r.id === '/work/app'))).toContain(String.fromCodePoint(991302))
  await again.unmount()
})

test('plain glyphs: every kind of row the pane draws gets its own Unicode symbol and no private-use characters', { timeoutMs: 20_000, options: { glyphs: 'plain' } } as any, async ($: any, on: any) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  await seeded($, clock, '/work', ['/work/app'])
  const sources = [
    { kind: 'SemanticModel', name: 'sales', note: 'semantic model' },
    { kind: 'Lakehouse', name: 'gold', note: 'lakehouse' },
    { kind: 'Warehouse', name: 'wh', note: 'warehouse' },
    { kind: 'KQLDatabase', name: 'events', note: 'KQL database' },
    { kind: 'SQLDatabase', name: 'SQL database', note: 'mssql', children: ['Orders'] },
    { kind: 'UserDataFunction', name: 'User data functions', note: '1 function', children: ['refresh'] },
    { kind: 'table', name: 'other', note: 'custom' },
  ]
  mem.set(`${PLUGIN}/apps`, { value: [app('/work/app', { sources })], version: 9 })
  listing = { '/work/app': ['src/', 'main.ts'] }
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: paneProps })
  await clock.settle()
  await ui.post({ press: '/work/app' }, { in: 'rows' })
  await clock.settle()
  const rows = (await rowsOf(ui)).rows as any[]
  const glyphOf = (match: (r: any) => boolean) => {
    const r = rows.find(match)
    return (r?.left as any[]).find((s, i) => i > 0 && s.t.trim())?.t.trim()
  }
  const named = (name: string) => (r: any) => JSON.stringify(r).includes(`"t":"${name}"`)
  expect(glyphOf(r => r.id === '/work/app')).toBe('▾')
  expect(rows.find(r => r.id === '/work/app').left[2].t.trim()).toBe('▣')
  expect(rows.find(r => r.id === '/work/app/src').left[2].t.trim()).toBe('■')
  expect(rows.find(r => r.id === '/work/app/main.ts').left[2].t.trim()).toBe('▫')
  expect(glyphOf(named('sales'))).toBe('◆')
  expect(glyphOf(named('gold'))).toBe('◇')
  expect(glyphOf(named('wh'))).toBe('▤')
  expect(glyphOf(named('events'))).toBe('▦')
  expect(glyphOf(named('Orders'))).toBe('⊞')
  expect(glyphOf(named('refresh'))).toBe('ƒ')
  expect(glyphOf(named('other'))).toBe('⊞')
  const drawn = JSON.stringify(rows) + JSON.stringify(await ui.drawn())
  expect(drawn).not.toMatch(NERD)
  expect(drawn).not.toContain('•')
  await ui.unmount()
})

test('auto glyphs that fall back to plain Unicode on the terminal give Claude a one-line font hint once per session', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  const ui = await mount($, clock, 'terminal', '/work')
  ran.length = 0
  const first = await $.prompt.submit({ text: 'hi', context: [], origin: { kind: 'person' } } as any)
  expect(JSON.stringify(first)).toContain('Tell user once: Fabric app pane icons need github.com/data-goblin/fabric-nf plus a Nerd Font. Plugin option fontHint=off disables this.')
  expect(JSON.stringify(await $.prompt.submit({ text: 'hi', context: [], origin: { kind: 'person' } } as any))).not.toContain('fabric-nf')
  expect(ran).toEqual([])
  await ui.unmount()
})

test('fontHint off keeps the font hint out of prompts', { timeoutMs: 20_000, options: { fontHint: 'off' } } as any, async ($: any, on: any) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  const ui = await mount($, clock, 'terminal', '/work')
  expect(JSON.stringify(await $.prompt.submit({ text: 'hi', context: [], origin: { kind: 'person' } } as any))).not.toContain('fabric-nf')
  await ui.unmount()
})

test('a plain glyphs setting or the desktop app is a choice, not a fallback, so no font hint', { timeoutMs: 20_000, options: { glyphs: 'plain' } } as any, async ($: any, on: any) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  const ui = await mount($, clock, 'terminal', '/work')
  expect(JSON.stringify(await $.prompt.submit({ text: 'hi', context: [], origin: { kind: 'person' } } as any))).not.toContain('fabric-nf')
  await ui.unmount()
})

test('a button whose state write fails is swallowed instead of leaving an unhandled rejection', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  const ui = await mount($, clock, 'terminal', '/work')
  refuseTree = true
  await ui.press({ key: 'collapse' })
  await ui.press({ key: 'hidden' })
  await clock.settle()
  refuseTree = false
  await ui.unmount()
})

test('every row the rows module draws carries a key, unique within the list', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  const ui = await deepApp($, clock)
  const drawn: any = await ui.drawn({ in: 'rows' })
  const keys = (drawn.children as any[]).map(c => c?.props?.key)
  expect(keys.length).toBeGreaterThan(5)
  expect(keys.every(k => typeof k === 'string' && k.length > 0)).toBe(true)
  expect(new Set(keys).size).toBe(keys.length)
  await ui.unmount()
})

test('parsing: &> stays one operator, and text that only mentions the CLI is no command', { timeoutMs: 20_000 }, async ($, on) => {
  const tokens = tokenize('rayfin up &> deploy.log')
  expect(tokens).toContain('&>')
  expect(tokens).not.toContain('&')
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  cwd = '/work/app'
  await seeded($, clock, '/work', ['/work/app'])
  ran.length = 0
  await $.tool.call({ tool: 'Bash', command: 'grep -n rayfin up.txt; git log -1 -m "rayfin up"' } as any)
  await clock.settle()
  expect(ran.some(a => a[0] === 'find' && a.includes('-maxdepth'))).toBe(false)
  expect(shine(mem.get(`${PLUGIN}/tree`)?.value)['/work/app']).toBeUndefined()
})

test('parsing: cd ~ resolves against home for the deploy target, cd "$VAR" resolves to nothing, and the pane never runs its own processes in Claude\'s cwd', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  cwd = '/home/k/apps'
  found = '/home/k/apps/b/rayfin/rayfin.yml\0/home/k/apps/c/rayfin/rayfin.yml\0'
  files = { '/home/k/apps/b/rayfin/rayfin.yml': 'name: b\n', '/home/k/apps/c/rayfin/rayfin.yml': 'name: c\n' }
  await seeded($, clock, '/home/k/apps', ['/home/k/apps/b', '/home/k/apps/c'])
  const tones = () => shine(mem.get(`${PLUGIN}/tree`)?.value)
  await $.tool.call({ tool: 'Bash', command: 'cd "$APP" && rayfin up' } as any)
  await clock.settle()
  expect(tones()).toEqual({})
  await clock.advance(3_000)
  await $.tool.call({ tool: 'Bash', command: 'cd ~/apps/b && ~/.local/bin/rayfin up &> /tmp/up.log' } as any)
  await clock.settle()
  expect(tones()).toEqual({ '/home/k/apps/b': 'teal' })
  expect(inits.every(i => !i || !Object.keys(i as object).includes('cwd'))).toBe(true)
})

test('/fabric-app-pane takes a folder with spaces, quoted or not', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  dirs = ['/A', '/My Apps', '/Other Apps']
  foundBy = { '/A': '', '/My Apps': '/My Apps/app/rayfin/rayfin.yml\0', '/Other Apps': '/Other Apps/app/rayfin/rayfin.yml\0' }
  files = { '/My Apps/app/rayfin/rayfin.yml': 'name: a\n', '/Other Apps/app/rayfin/rayfin.yml': 'name: b\n' }
  await seeded($, clock, '/A', [])
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: paneProps })
  await $.command.run({ command: 'fabric-app-pane', args: '/My Apps', origin: { kind: 'person' }, presentation: { isFullscreen: true, columns: 200 } } as any)
  await clock.settle()
  await clock.advance(2_000)
  await clock.settle()
  expect((mem.get(`${PLUGIN}/tree`)?.value as any).root).toBe('/My Apps')
  await $.command.run({ command: 'fabric-app-pane', args: '"/Other Apps"', origin: { kind: 'person' }, presentation: { isFullscreen: true, columns: 200 } } as any)
  await clock.settle()
  await clock.advance(2_000)
  await clock.settle()
  expect((mem.get(`${PLUGIN}/tree`)?.value as any).root).toBe('/Other Apps')
  await ui.unmount()
})

test('command -v rayfin only looks the CLI up, so the pane does not say Claude is working', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  cwd = '/work/app'
  await seeded($, clock, '/work', ['/work/app'])
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: paneProps })
  await clock.settle()
  let drawn = ''
  onTool = async () => {
    await ui.redraw()
    drawn = JSON.stringify(await ui.drawn())
  }
  await $.tool.call({ tool: 'Bash', command: 'command -v rayfin' } as any)
  onTool = null
  expect(drawn).not.toContain('Claude is working')
  await ui.unmount()
})
