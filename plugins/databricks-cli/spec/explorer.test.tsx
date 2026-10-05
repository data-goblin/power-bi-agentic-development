import { expect, mock, test } from 'claude-code/testing'
import { invocations, tokenize } from '../hooks/parse'

type Ran = string[][]
const opens: unknown[] = []
const closes: unknown[] = []
const PLUGIN = 'databricks-cli'
const PANE = 'databricks-pane'
const HOST = 'https://dbc-demo.cloud.databricks.com'
const DATA: Record<string, unknown> = {
  'workspace list /': [
    { object_type: 'DIRECTORY', path: '/Users' },
    { object_type: 'DIRECTORY', path: '/Shared' },
  ],
  'workspace list /Shared': [
    { object_type: 'NOTEBOOK', path: '/Shared/etl', language: 'PYTHON', object_id: 11 },
    { object_type: 'FILE', path: '/Shared/readme.md', object_id: 12 },
  ],
  'catalogs list': [{ name: 'main', catalog_type: 'MANAGED_CATALOG', created_at: 1_700_000_000_000 }],
  'schemas list main': [{ name: 'sales', full_name: 'main.sales', created_at: 1_700_000_000_000 }],
  'tables list main sales': [
    { name: 'orders', full_name: 'main.sales.orders', table_type: 'MANAGED' },
    { name: 'orders_v', full_name: 'main.sales.orders_v', table_type: 'VIEW' },
  ],
  'volumes list main sales': [{ name: 'raw', full_name: 'main.sales.raw', volume_type: 'MANAGED' }],
  'clusters list': [{ cluster_id: '0123-abc', cluster_name: 'shared', state: 'RUNNING' }],
  'warehouses list': [{ id: 'wh1', name: 'Serverless', state: 'STOPPED' }],
  'jobs list': Array.from({ length: 60 }, (_, i) => ({ job_id: 100 + i, settings: { name: `job ${String(i).padStart(2, '0')}` } })),
  'pipelines list-pipelines': [],
  'apps list': [],
  'lakeview list': [],
}

const truncated = new Set<string>()
let onTool: ((e: any) => Promise<void>) | null = null
const failingDb = new Set<string>()
let gate: { key: string; wait: Promise<void> } | null = null
let cliFail: 'spawn' | { exitCode: number; stderr: string } | null = null

function world(on: any, env: Record<string, string>, ran: Ran, copied: string[]) {
  cliFail = null
  mock.env(on, env)
  const clock = mock.clock(on, { now: 1_800_000_000_000 })
  mock.store(on)
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/work' }))
  on('session.id', () => ({ value: 'test' }))
  on('command.register', () => ({ value: undefined }))
  on('ui.open', (_$: any, e: any) => {
    opens.push(e)
    return { value: { isPlaced: true } }
  })
  on('ui.close', (_$: any, e: any) => {
    closes.push(e)
    return {}
  })
  on('ui.toast', () => ({ value: undefined }))
  on('ui.copy', (_$: any, e: any) => {
    copied.push(e.text)
    return { value: { isCopied: true } }
  })
  on('fs.read', (_$: any, e: any) => {
    if (String(e.path).replace(/\\/g, '/').endsWith('/.databrickscfg')) return { value: `[DEFAULT]\nhost = ${HOST}\n` }
    throw new Error('ENOENT')
  })
  on('fs.list', () => ({ value: [] }))
  on('fs.stat', () => {
    throw new Error('ENOENT')
  })
  on('process.run', async (_$: any, e: any) => {
    const argv: string[] = [...e.argv]
    ran.push(argv)
    const ok = (stdout: string) => ({ value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
    if (argv[0] === 'uname') return ok(env.HOME?.startsWith('/Users') ? 'Darwin\n' : 'Linux\n')
    if (argv[0] === 'sh') return ok('missing\n')
    if (argv[0] === 'databricks') {
      const key = argv.slice(1).filter((a, i, all) => a !== '-o' && all[i - 1] !== '-o' && a !== '-p' && all[i - 1] !== '-p' && !a.startsWith('--omit-')).join(' ')
      if (cliFail === 'spawn') throw new Error('spawn databricks ENOENT')
      if (cliFail) return { value: { exitCode: cliFail.exitCode, stdout: '', stderr: cliFail.stderr, isStdoutTruncated: false, isStderrTruncated: false } }
      if (gate && gate.key === key) await gate.wait
      if (failingDb.has(key)) return { value: { exitCode: 1, stdout: '', stderr: 'PERMISSION_DENIED', isStdoutTruncated: false, isStderrTruncated: false } }
      if (truncated.has(key)) return { value: { exitCode: 0, stdout: JSON.stringify(DATA[key] ?? []).slice(0, 20), stderr: '', isStdoutTruncated: true, isStderrTruncated: false } }
      return ok(JSON.stringify(DATA[key] ?? []))
    }
    return ok('')
  })
  on('tool.call', async (_$: any, e: any) => {
    if (onTool) await onTool(e)
    return { result: { stdout: '', stderr: '' } }
  })
  on('prompt.submit', (_$: any, e: any) => ({ text: e.text, context: e.context }))
  return clock
}

const paneProps = { title: 'Databricks', isFocused: false, bodyColumns: 70, placement: 'dock', scroll: { offset: 0, bodyRows: 24 }, view: {} } as any
const rowsOf = async (ui: any) => {
  const find = (n: any): any => (n?.type === 'Client' && n.props?.key === 'rows' ? n : (n?.children ?? []).map(find).find(Boolean))
  return find(await ui.drawn())?.props.props
}
const ids = (p: any) => p.rows.map((r: any) => r.id)
const drawnText = async (ui: any) => JSON.stringify(await ui.drawn())
const byKey = (n: any, key: string): any => (n?.props?.key === key ? n : (n?.children ?? []).map((c: any) => byKey(c, key)).find(Boolean))
const LOGIN = 'databricks auth login --host <your workspace URL>'
const ONBOARD_TITLES = ['Databricks CLI not found', 'Not signed in to Databricks', "Can't reach Databricks"]

async function shimmerOf(ui: any, id: string): Promise<{ working: string; lit: string; others: string[] }> {
  const tree = await ui.drawn()
  const toneIn = (row: any) => row?.left.find((s: any) => s.sh)?.sh ?? ''
  const working = toneIn(byKey(tree, 'working')?.props.props.rows[0])
  const rows = byKey(tree, 'rows')?.props.props.rows ?? []
  return { working, lit: toneIn(rows.find((r: any) => r.id === id)), others: rows.map(toneIn).filter((t: string) => t && t !== working) }
}
const NERD = /[\u{e000}-\u{f8ff}\u{f0000}-\u{fffff}]/u

async function open($: any, clock: any, surface: 'terminal' | 'desktop') {
  await $.session.start({ cwd: '/work', surface, isInteractive: true })
  await clock.settle()
  await $.command.run({ command: PANE, args: '', origin: { kind: 'person' } } as any)
  await clock.settle()
  const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: PANE, props: paneProps })
  await clock.settle()
  return ui
}

test('macOS app: sections browse like a file tree, copy CLI arguments, open objects in Databricks', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const copied: string[] = []
  const clock = world(on, { HOME: '/Users/k' }, ran, copied)
  const ui = await open($, clock, 'desktop')
  let p = await rowsOf(ui)
  expect(ids(p)).toEqual(['S:workspace', 'S:catalog', 'S:compute', 'S:jobs', 'S:pipelines', 'S:apps', 'S:dashboards'])
  expect(NERD.test(JSON.stringify(p.rows))).toBe(false)
  for (const id of ['S:catalog', 'UC:main', 'UC:main.sales']) {
    await ui.post({ press: id }, { in: 'rows' })
    await clock.settle()
  }
  p = await rowsOf(ui)
  expect(ids(p)).toEqual(expect.arrayContaining(['UC:main.sales.orders', 'UC:main.sales.orders_v', 'UV:main.sales.raw']))
  await ui.post({ press: 'UC:main.sales.orders' }, { in: 'rows' })
  await clock.settle()
  await ui.post({ copy: 'UC:main.sales.orders' }, { in: 'rows' })
  await clock.settle()
  expect(copied).toEqual(['main.sales.orders'])
  await ui.post({ press: 'UC:main.sales.orders', ctrl: true }, { in: 'rows' })
  await clock.settle()
  expect(ran).toContainEqual(['open', '--', `${HOST}/explore/data/main/sales/orders`])
  const sent = await $.prompt.submit({ text: 'describe this', wait: false } as any)
  expect(JSON.stringify(sent)).toContain('databricks CLI argument: main.sales.orders')
  await ui.unmount()
})

test('long sections scroll, and a databricks command Claude runs lights the object even when scrolled away', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { HOME: '/home/k' }, ran, [])
  const ui = await open($, clock, 'terminal')
  await ui.post({ press: 'S:jobs' }, { in: 'rows' })
  await clock.settle()
  let p = await rowsOf(ui)
  expect(p.bar).toBeDefined()
  await ui.post({ scrollTo: 1 }, { in: 'rows' })
  await clock.settle()
  p = await rowsOf(ui)
  expect(ids(p)).not.toContain('S:catalog')
  await $.tool.call({ tool: 'Bash', command: 'databricks tables get main.sales.orders -o json' } as any)
  await clock.advance(50)
  p = await rowsOf(ui)
  const row = p.rows.find((r: any) => r.id === 'UC:main.sales.orders')
  expect(JSON.stringify(row)).toContain('"sh":"purple"')
  await $.tool.call({ tool: 'Bash', command: 'databricks workspace import /Shared/etl --file etl.py --language PYTHON --overwrite' } as any)
  await clock.advance(50)
  p = await rowsOf(ui)
  expect(JSON.stringify(p.rows.find((r: any) => r.id === 'WS:/Shared/etl'))).toContain('"sh":"pink"')
  await $.tool.call({ tool: 'Bash', command: 'databricks jobs run-now 105' } as any)
  await clock.advance(50)
  p = await rowsOf(ui)
  expect(JSON.stringify(p.rows.find((r: any) => r.id === 'J:105'))).toContain('"sh":"orange"')
  await $.tool.call({ tool: 'Bash', command: 'databricks schemas create staging main' } as any)
  await clock.advance(50)
  await ui.post({ scrollTo: 0 }, { in: 'rows' })
  await clock.settle()
  p = await rowsOf(ui)
  expect(ids(p)).toContain('UC:main.sales.orders')
  expect(JSON.stringify(p.rows)).not.toContain('loading')
  await ui.unmount()
})

test('Windows: objects open through ShellExecute with the URL as one literal argument; databricks auth is ignored', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const clock = world(on, { OS: 'Windows_NT', USERPROFILE: 'C:\\Users\\k' }, ran, [])
  const ui = await open($, clock, 'terminal')
  await ui.post({ press: 'S:compute' }, { in: 'rows' })
  await clock.settle()
  await ui.post({ press: 'CL:0123-abc', ctrl: true }, { in: 'rows' })
  await clock.settle()
  expect(ran.find(a => a[0] === 'powershell')?.at(-1)).toContain('UseShellExecute = $true')
  const before = ran.length
  await $.tool.call({ tool: 'Bash', command: 'databricks auth login --host x' } as any)
  await clock.advance(50)
  expect(ran.length).toBe(before)
  expect(ran.some(a => ['cmd', 'setsid', 'osascript', 'uname', 'find'].includes(a[0] ?? ''))).toBe(false)
  await ui.unmount()
})

test('sidebar only: no pane in the default layout or a narrow terminal, and an inline pane closes itself', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const copied: string[] = []
  const clock = world(on, { HOME: '/Users/k' }, ran, copied)
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
  void copied
})

test('schemas list tables without column payloads, and a cut-off listing shows an error instead of an empty schema', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const copied: string[] = []
  const clock = world(on, { HOME: '/home/k' }, ran, copied)
  truncated.add('tables list main sales')
  const ui = await open($, clock, 'terminal')
  for (const id of ['S:catalog', 'UC:main', 'UC:main.sales']) {
    await ui.post({ press: id }, { in: 'rows' })
    await clock.settle()
  }
  expect(ran.some(a => a[1] === 'tables' && a.includes('--omit-columns') && a.includes('--omit-properties'))).toBe(true)
  expect(JSON.stringify(await ui.drawn())).toContain('too much output')
  truncated.clear()
  await ui.unmount()
})

test('a listing that started under one profile does not land after Claude switches profile', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const copied: string[] = []
  const clock = world(on, { HOME: '/home/k' }, ran, copied)
  const ui = await open($, clock, 'terminal')
  let release = () => {}
  gate = { key: 'catalogs list', wait: new Promise<void>(r => (release = r)) }
  void ui.post({ press: 'S:catalog' }, { in: 'rows' })
  await clock.advance(20)
  await $.tool.call({ tool: 'Bash', command: 'databricks -p prod clusters list' } as any)
  await clock.advance(50)
  release()
  gate = null
  await clock.settle()
  await clock.advance(600)
  await ui.post({ press: 'S:catalog' }, { in: 'rows' })
  await clock.settle()
  expect(ran.some(a => a[1] === 'catalogs' && a.includes('prod'))).toBe(true)
  await ui.unmount()
})

test('a local file name in fs cp is not taken for a Unity Catalog table', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const copied: string[] = []
  const clock = world(on, { HOME: '/home/k' }, ran, copied)
  const ui = await open($, clock, 'terminal')
  const before = ran.filter(a => a[1] === 'catalogs').length
  await $.tool.call({ tool: 'Bash', command: 'databricks fs cp report.v1.csv dbfs:/tmp/report.csv' } as any)
  await clock.settle()
  expect(ran.filter(a => a[1] === 'catalogs').length).toBe(before)
  await ui.unmount()
})

test('a job Claude creates reloads the open Jobs section, and /Workspace paths match the tree', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const copied: string[] = []
  const clock = world(on, { HOME: '/home/k' }, ran, copied)
  const ui = await open($, clock, 'terminal')
  await ui.post({ press: 'S:jobs' }, { in: 'rows' })
  await clock.settle()
  const jobs = () => ran.filter(a => a[1] === 'jobs' && a[2] === 'list').length
  const before = jobs()
  await $.tool.call({ tool: 'Bash', command: 'databricks jobs create --json @job.json' } as any)
  await clock.settle()
  expect(jobs() - before).toBe(1)
  await clock.advance(600)
  await ui.post({ press: 'S:workspace' }, { in: 'rows' })
  await clock.settle()
  await $.tool.call({ tool: 'Bash', command: 'databricks workspace export /Workspace/Shared/etl --file ./etl.py' } as any)
  await clock.advance(50)
  const p = await rowsOf(ui)
  expect(JSON.stringify(p.rows.find((r: any) => r.id === 'WS:/Shared/etl'))).toContain('"sh":"teal"')
  await ui.unmount()
})

test('plain calls count under DATABRICKS_CONFIG_PROFILE and after an explicit -p DEFAULT', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const copied: string[] = []
  const clock = world(on, { HOME: '/home/k', DATABRICKS_CONFIG_PROFILE: 'dev' }, ran, copied)
  const ui = await open($, clock, 'terminal')
  const cats = () => ran.filter(a => a[1] === 'catalogs' && a[2] === 'list').length
  await $.tool.call({ tool: 'Bash', command: 'databricks tables get main.sales.orders' } as any)
  await clock.settle()
  expect(cats()).toBe(1)
  await ui.unmount()
})

test('-p DEFAULT and plain calls address the same workspace', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const copied: string[] = []
  const clock = world(on, { HOME: '/home/k' }, ran, copied)
  const ui = await open($, clock, 'terminal')
  await $.tool.call({ tool: 'Bash', command: 'databricks -p DEFAULT current-user me' } as any)
  await clock.settle()
  await $.tool.call({ tool: 'Bash', command: 'databricks tables get main.sales.orders' } as any)
  await clock.settle()
  expect(ran.filter(a => a[1] === 'catalogs' && a[2] === 'list').length).toBe(1)
  await ui.unmount()
})

test('a schema whose volumes listing fails keeps retrying instead of showing only tables', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const copied: string[] = []
  const clock = world(on, { HOME: '/home/k' }, ran, copied)
  failingDb.add('volumes list main sales')
  const ui = await open($, clock, 'terminal')
  for (const id of ['S:catalog', 'UC:main', 'UC:main.sales']) {
    await ui.post({ press: id }, { in: 'rows' })
    await clock.settle()
  }
  expect(JSON.stringify(await ui.drawn())).toContain('PERMISSION_DENIED')
  expect(ids(await rowsOf(ui))).not.toContain('UC:main.sales.orders')
  failingDb.clear()
  await clock.advance(600)
  await ui.post({ press: 'UC:main.sales' }, { in: 'rows' })
  await clock.settle()
  await clock.advance(600)
  await ui.post({ press: 'UC:main.sales' }, { in: 'rows' })
  await clock.settle()
  expect(ids(await rowsOf(ui))).toContain('UC:main.sales.orders')
  expect(JSON.stringify(await ui.drawn())).not.toContain('PERMISSION_DENIED')
  await ui.unmount()
})

test('job runs re-list nothing, a bundle deploy reloads the open Jobs section', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const copied: string[] = []
  const clock = world(on, { HOME: '/home/k' }, ran, copied)
  const ui = await open($, clock, 'terminal')
  await ui.post({ press: 'S:jobs' }, { in: 'rows' })
  await clock.settle()
  const jobs = () => ran.filter(a => a[1] === 'jobs' && a[2] === 'list').length
  const before = jobs()
  await $.tool.call({ tool: 'Bash', command: 'databricks jobs run-now 105 && databricks jobs cancel-run 77' } as any)
  await clock.settle()
  expect(jobs()).toBe(before)
  await $.tool.call({ tool: 'Bash', command: 'databricks bundle deploy -t dev' } as any)
  await clock.settle()
  expect(jobs()).toBe(before + 1)
  await ui.unmount()
})

test('tables create targets catalog.schema.table, a started cluster refreshes Compute, and a cut-off reload shows its error', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const copied: string[] = []
  const clock = world(on, { HOME: '/home/k' }, ran, copied)
  const ui = await open($, clock, 'terminal')
  for (const id of ['S:catalog', 'UC:main', 'UC:main.sales']) {
    await ui.post({ press: id }, { in: 'rows' })
    await clock.settle()
  }
  const tables = () => ran.filter(a => a[1] === 'tables' && a[2] === 'list').length
  const before = tables()
  await $.tool.call({ tool: 'Bash', command: 'databricks tables create customers main sales EXTERNAL DELTA s3://b/t' } as any)
  await clock.settle()
  expect(tables()).toBe(before + 1)
  await clock.advance(600)
  await ui.post({ press: 'S:compute' }, { in: 'rows' })
  await clock.settle()
  const clusters = () => ran.filter(a => a[1] === 'clusters' && a[2] === 'list').length
  const c0 = clusters()
  await $.tool.call({ tool: 'Bash', command: 'databricks clusters start 0123-abc' } as any)
  await clock.settle()
  expect(clusters()).toBe(c0 + 1)
  truncated.add('clusters list')
  await $.tool.call({ tool: 'Bash', command: 'databricks clusters start 0123-abc' } as any)
  await clock.settle()
  truncated.clear()
  expect(JSON.stringify(await ui.drawn())).toContain('too much output')
  await ui.unmount()
})

test('a folder or schema Claude drops and recreates loses what the old one held', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const copied: string[] = []
  const clock = world(on, { HOME: '/home/k' }, ran, copied)
  const saved = { ...DATA }
  DATA['workspace list /Shared'] = [{ object_type: 'DIRECTORY', path: '/Shared/tmp', object_id: 90 }]
  DATA['workspace list /Shared/tmp'] = [{ object_type: 'NOTEBOOK', path: '/Shared/tmp/old', object_id: 91 }]
  const ui = await open($, clock, 'terminal')
  for (const id of ['S:workspace', 'WS:/Shared', 'WS:/Shared/tmp', 'S:catalog', 'UC:main', 'UC:main.sales']) {
    await ui.post({ press: id }, { in: 'rows' })
    await clock.settle()
  }
  expect(ids(await rowsOf(ui))).toEqual(expect.arrayContaining(['WS:/Shared/tmp/old', 'UC:main.sales.orders']))
  DATA['workspace list /Shared'] = [{ object_type: 'DIRECTORY', path: '/Shared/tmp', object_id: 100 }]
  DATA['workspace list /Shared/tmp'] = []
  DATA['schemas list main'] = [{ name: 'sales', full_name: 'main.sales', created_at: 1_800_000_000_000 }]
  DATA['tables list main sales'] = []
  DATA['volumes list main sales'] = []
  await $.tool.call({ tool: 'Bash', command: 'databricks workspace delete /Shared/tmp --recursive && databricks workspace mkdirs /Shared/tmp' } as any)
  await clock.settle()
  await $.tool.call({ tool: 'Bash', command: 'databricks schemas delete main.sales --force && databricks schemas create sales main' } as any)
  await clock.settle()
  Object.assign(DATA, saved)
  const p = ids(await rowsOf(ui))
  expect(p).toEqual(expect.arrayContaining(['WS:/Shared/tmp', 'UC:main.sales']))
  expect(p).not.toContain('WS:/Shared/tmp/old')
  expect(p).not.toContain('UC:main.sales.orders')
  await ui.unmount()
})
test('follow off: Claude touching objects far away or in a catalog above never moves the view; the wheel still does', { timeoutMs: 20_000, options: { follow: 'off' } } as any, async ($: any, on: any) => {
  const ran: Ran = []
  const copied: string[] = []
  const clock = world(on, { HOME: '/home/k' }, ran, copied)
  const ui = await open($, clock, 'terminal')
  await ui.post({ press: 'S:jobs' }, { in: 'rows' })
  await clock.settle()
  await $.ui.scroll({ component: 'Pane', requestId: PANE, by: 20 })
  await clock.settle()
  const top = (await rowsOf(ui)).rows[0]?.id
  expect(top).not.toBe('S:workspace')
  await $.tool.call({ tool: 'Bash', command: 'databricks jobs get 158' } as any)
  await clock.settle()
  expect((await rowsOf(ui)).rows[0]?.id).toBe(top)
  await $.tool.call({ tool: 'Bash', command: 'databricks tables get main.sales.orders' } as any)
  await clock.settle()
  expect((await rowsOf(ui)).rows[0]?.id).toBe(top)
  await $.ui.scroll({ component: 'Pane', requestId: PANE, by: 10 })
  await clock.settle()
  expect((await rowsOf(ui)).rows[0]?.id).not.toBe(top)
  await ui.unmount()
})

test('double-clicking a section navigates into it; home comes back; a SQL statement lights its warehouse purple', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const copied: string[] = []
  const clock = world(on, { HOME: '/home/k' }, ran, copied)
  const ui = await open($, clock, 'terminal')
  await ui.post({ press: 'S:compute' }, { in: 'rows' })
  await clock.advance(100)
  await ui.post({ press: 'S:compute' }, { in: 'rows' })
  await clock.settle()
  let p = await rowsOf(ui)
  expect(ids(p)).not.toContain('S:catalog')
  expect(ids(p)).toContain('SW:wh1')
  await $.tool.call({ tool: 'Bash', command: `databricks api post /api/2.0/sql/statements --json '{"warehouse_id": "wh1", "statement": "SELECT 1"}'` } as any)
  await clock.advance(50)
  p = await rowsOf(ui)
  expect(JSON.stringify(p.rows.find((r: any) => r.id === 'SW:wh1'))).toContain('"sh":"purple"')
  await clock.settle()
  await ui.press({ key: 'home' })
  await clock.settle()
  expect(ids(await rowsOf(ui))).toContain('S:catalog')
  await ui.unmount()
})

test('plain glyphs: sections, catalog objects, navigation and buttons draw without any private-use characters', { timeoutMs: 20_000, options: { glyphs: 'plain' } } as any, async ($: any, on: any) => {
  const ran: Ran = []
  const copied: string[] = []
  const clock = world(on, { HOME: '/home/k' }, ran, copied)
  const ui = await open($, clock, 'terminal')
  for (const id of ['S:workspace', 'S:catalog', 'UC:main', 'UC:main.sales', 'S:compute', 'S:jobs']) {
    await clock.advance(600)
    await ui.post({ press: id }, { in: 'rows' })
    await clock.settle()
  }
  expect(JSON.stringify(await ui.drawn())).not.toMatch(NERD)
  await clock.advance(600)
  await ui.post({ press: 'UC:main' }, { in: 'rows' })
  await clock.advance(100)
  await ui.post({ press: 'UC:main' }, { in: 'rows' })
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).not.toMatch(NERD)
  await ui.unmount()
})

test('&> stays one redirection operator', { timeoutMs: 5_000 }, async () => {
  const tokens = tokenize('databricks catalogs list &> /dev/null')
  expect(tokens).toContain('&>')
  expect(tokens).not.toContain('&')
})

test('a $( ) call takes the profile exported before it, not one exported after it', { timeoutMs: 5_000 }, async () => {
  const profiles = (command: string) => invocations(command, '/work').map(i => i.env.DATABRICKS_CONFIG_PROFILE ?? '')
  expect(profiles('export DATABRICKS_CONFIG_PROFILE=prod; echo "$(databricks jobs list)"')).toEqual(['prod'])
  expect(profiles('echo "$(databricks jobs list)"; export DATABRICKS_CONFIG_PROFILE=prod')).toEqual([''])
  expect(profiles('echo $(databricks jobs list); export DATABRICKS_CONFIG_PROFILE=prod')).toEqual([''])
  expect(profiles("echo '$(databricks jobs list)'")).toEqual([])
})

test('without the icon fonts Claude gets a one-line font hint once per session, unless fontHint is off', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const copied: string[] = []
  const clock = world(on, { HOME: '/home/k' }, ran, copied)
  const ui = await open($, clock, 'terminal')
  const first = JSON.stringify(await $.prompt.submit({ text: 'hi', context: [] } as any))
  expect(first).toContain('github.com/data-goblin/databricks-nf')
  expect(first).toContain('fontHint=off')
  expect(JSON.stringify(await $.prompt.submit({ text: 'hi', context: [] } as any))).not.toContain('databricks-nf')
  await ui.unmount()
})

test('fontHint off keeps the font hint out of prompts', { timeoutMs: 20_000, options: { fontHint: 'off' } } as any, async ($: any, on: any) => {
  const ran: Ran = []
  const copied: string[] = []
  const clock = world(on, { HOME: '/home/k' }, ran, copied)
  const ui = await open($, clock, 'terminal')
  expect(JSON.stringify(await $.prompt.submit({ text: 'hi', context: [] } as any))).not.toContain('databricks-nf')
  await ui.unmount()
})

test('a plain glyphs setting is a choice, not a fallback, so no font hint', { timeoutMs: 20_000, options: { glyphs: 'plain' } } as any, async ($: any, on: any) => {
  const ran: Ran = []
  const copied: string[] = []
  const w: any = world(on, { HOME: '/home/k' }, ran, copied)
  const ui = await open($, w.clock ?? w, 'terminal')
  expect(JSON.stringify(await $.prompt.submit({ text: 'hi', context: [] } as any))).not.toContain('databricks-nf')
  await ui.unmount()
})

test('a highlight on a row already in view does not scroll the tree', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const copied: string[] = []
  const clock = world(on, { HOME: '/home/k' }, ran, copied)
  const ui = await open($, clock, 'terminal')
  for (const id of ['S:jobs', 'S:catalog', 'UC:main', 'UC:main.sales', 'UC:main.sales.orders']) {
    await clock.advance(600)
    await ui.post({ press: id }, { in: 'rows' })
    await clock.settle()
  }
  const before = (await rowsOf(ui)).rows[0].id
  await $.tool.call({ tool: 'Bash', command: 'databricks tables get main.sales.orders' } as any)
  await clock.advance(50)
  const during = await rowsOf(ui)
  expect(JSON.stringify(during.rows.find((r: any) => r.id === 'UC:main.sales.orders'))).toContain('"sh":"purple"')
  expect(during.rows[0].id).toBe(before)
  await ui.unmount()
})

test('while Claude reads far down the tree, its catalog and schema stay pinned; the search row says Claude is working', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const copied: string[] = []
  const clock = world(on, { HOME: '/home/k' }, ran, copied)
  const ui = await open($, clock, 'terminal')
  for (const id of ['S:catalog', 'UC:main', 'UC:main.sales', 'S:jobs']) {
    await clock.advance(600)
    await ui.post({ press: id }, { in: 'rows' })
    await clock.settle()
  }
  let working = ''
  onTool = async () => {
    working = JSON.stringify(await ui.drawn())
  }
  await $.tool.call({ tool: 'Bash', command: 'databricks jobs get 150' } as any)
  onTool = null
  expect(working).toContain('Claude is working in Databricks...')
  await clock.advance(100)
  const during = (await rowsOf(ui)).rows.map((r: any) => r.id)
  expect(during).toContain('S:jobs')
  await clock.advance(6000)
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).not.toContain('Claude is working')
  await ui.unmount()
})

test('command -v databricks only looks the CLI up, so the pane does not say Claude is working', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const copied: string[] = []
  const clock = world(on, { HOME: '/home/k' }, ran, copied)
  const ui = await open($, clock, 'terminal')
  let drawn = ''
  onTool = async () => {
    drawn = JSON.stringify(await ui.drawn())
  }
  await $.tool.call({ tool: 'Bash', command: 'command -v databricks' } as any)
  onTool = null
  expect(drawn).not.toContain('Claude is working in Databricks')
  await ui.unmount()
})

test('the working text and the row shimmer run on one clock in one tone: both from the command start until its flash ends', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const copied: string[] = []
  const clock = world(on, { HOME: '/home/k' }, ran, copied)
  const ui = await open($, clock, 'terminal')
  for (const id of ['S:catalog', 'UC:main', 'UC:main.sales']) {
    await clock.advance(600)
    await ui.post({ press: id }, { in: 'rows' })
    await clock.settle()
  }
  const together = (s: { working: string; lit: string; others: string[] }) => {
    expect(Boolean(s.working)).toBe(Boolean(s.lit))
    expect(s.working).toBe(s.lit)
    expect(s.others).toEqual([])
  }
  const orders = 'UC:main.sales.orders'
  let during = { working: '', lit: '', others: [] as string[] }
  onTool = async () => {
    during = await shimmerOf(ui, orders)
  }
  await $.tool.call({ tool: 'Bash', command: 'databricks tables get main.sales.orders' } as any)
  onTool = null
  await clock.advance(50)
  const flashing = await shimmerOf(ui, orders)
  await clock.advance(1500)
  const later = await shimmerOf(ui, orders)
  await clock.advance(1500)
  await clock.settle()
  const after = await shimmerOf(ui, orders)
  for (const s of [during, flashing, later, after]) together(s)
  expect(during.working).toBe('purple')
  expect(flashing.working).toBe('purple')
  expect(later.working).toBe('purple')
  expect(after.working).toBe('')

  await $.tool.call({ tool: 'Bash', command: 'databricks tables get main.sales.orders' } as any)
  await clock.advance(2000)
  let second = { working: '', lit: '', others: [] as string[] }
  onTool = async () => {
    second = await shimmerOf(ui, 'UC:main.sales')
  }
  await $.tool.call({ tool: 'Bash', command: 'databricks schemas update main.sales --comment x' } as any)
  onTool = null
  together(second)
  expect(second.working).toBe('orange')
  await clock.advance(1500)
  const restarted = await shimmerOf(ui, 'UC:main.sales')
  together(restarted)
  expect(restarted.working).toBe('orange')
  await clock.advance(3000)
  await clock.settle()
  const done = await shimmerOf(ui, 'UC:main.sales')
  together(done)
  expect(done.working).toBe('')

  let bare = ''
  onTool = async () => {
    bare = (await shimmerOf(ui, orders)).working
  }
  await $.tool.call({ tool: 'Bash', command: 'databricks current-user me' } as any)
  onTool = null
  expect(bare).toBe('purple')
  await clock.advance(50)
  expect((await shimmerOf(ui, orders)).working).toBe('')
  await ui.unmount()
})

test('onboarding: a databricks CLI that cannot start shows install and sign-in steps, and a command copies on click', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const copied: string[] = []
  const clock = world(on, { HOME: '/home/k' }, ran, copied)
  cliFail = 'spawn'
  const ui = await open($, clock, 'terminal')
  const drawn = await drawnText(ui)
  for (const line of [
    'Databricks CLI not found',
    'This pane needs the Databricks CLI (databricks).',
    'Install it',
    'macOS or Linux: ',
    'brew tap databricks/tap && brew install databricks',
    'Windows: ',
    'winget install Databricks.DatabricksCLI',
    'Then sign in to your workspace',
    LOGIN,
    "Press ↻ when you're done. Or ask Claude to set it up for you.",
  ])
    expect(drawn).toContain(line)
  expect(drawn).not.toMatch(NERD)
  expect(await rowsOf(ui)).toBeUndefined()
  await ui.post({ press: 'brew tap databricks/tap && brew install databricks' }, { in: 'onboard-1-1' })
  await clock.settle()
  await ui.post({ copy: LOGIN }, { in: 'onboard-2-1' })
  await clock.settle()
  expect(copied).toEqual(['brew tap databricks/tap && brew install databricks', LOGIN])
  cliFail = { exitCode: 127, stderr: 'sh: 1: databricks: not found' }
  await ui.press({ key: 'refresh' })
  await clock.settle()
  expect(await drawnText(ui)).toContain('Databricks CLI not found')
  await ui.unmount()
})

test('onboarding: every way the CLI says it is signed out shows the sign-in step with Nerd Font icons', { timeoutMs: 20_000, options: { glyphs: 'nerd' } } as any, async ($: any, on: any) => {
  const ran: Ran = []
  const copied: string[] = []
  const clock = world(on, { HOME: '/home/k' }, ran, copied)
  const ui = await open($, clock, 'terminal')
  for (const stderr of [
    'Error: default auth: cannot configure default credentials, please check https://docs.databricks.com/en/dev-tools/auth.html#databricks-client-unified-authentication to configure credentials for your preferred authentication method.',
    'Error: A new access token could not be retrieved because the refresh token is invalid. To reauthenticate, run the following command:\n  $ databricks auth login --host https://dbc-demo.cloud.databricks.com',
    'Error: resolve: ~/.databrickscfg has no prod profile configured. Configure with: databricks configure --profile prod',
    'Error: Invalid access token. [ReqId: 1a2b]',
    'Error: Credential was not sent or was of an unsupported type for this API. [ReqId: 1a2b]',
    'Error: oauth2: token expired and refresh token is not set',
    "Error: no profiles configured. Run 'databricks auth login' to create a profile",
    'Error: 401 Unauthorized',
  ]) {
    cliFail = { exitCode: 1, stderr }
    await ui.press({ key: 'refresh' })
    await clock.settle()
    const drawn = await drawnText(ui)
    expect(drawn).toContain('Not signed in to Databricks')
    expect(drawn).toContain(LOGIN)
    expect(drawn).toContain("Press ↻ when you're done. Several workspaces? Pick one with -p <profile>.")
    expect(drawn).not.toContain('Databricks CLI not found')
    expect(drawn).toMatch(NERD)
    expect(await rowsOf(ui)).toBeUndefined()
  }
  await ui.post({ press: LOGIN }, { in: 'onboard-0-1' })
  await clock.settle()
  expect(copied).toEqual([LOGIN])
  await ui.unmount()
})

test('onboarding: a network failure shows the first line of the CLI error and the network hint', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const copied: string[] = []
  const clock = world(on, { HOME: '/home/k' }, ran, copied)
  const ui = await open($, clock, 'terminal')
  for (const first of [
    'Error: dial tcp 10.0.0.1:443: connect: connection refused',
    'Error: Get https://dbc-demo.cloud.databricks.com/api/2.0/preview/scim/v2/Me: dial tcp: lookup dbc-demo.cloud.databricks.com: no such host',
    'Error: Get https://dbc-demo.cloud.databricks.com/api/2.0/preview/scim/v2/Me: proxyconnect tcp: dial tcp 10.1.1.1:3128: i/o timeout',
    'Error: read tcp 10.0.0.2:51234->10.0.0.1:443: read: connection reset by peer',
  ]) {
    cliFail = { exitCode: 1, stderr: `${first}\nretrying in 2s` }
    await ui.press({ key: 'refresh' })
    await clock.settle()
    const drawn = await drawnText(ui)
    expect(drawn).toContain("Can't reach Databricks")
    expect(drawn).toContain(first)
    expect(drawn).toContain('Check your network or proxy, then press ↻.')
    expect(drawn).not.toContain('retrying in 2s')
    expect(drawn).not.toContain('Not signed in')
  }
  await ui.unmount()
})

test('onboarding: any other CLI error keeps the tree and its error line', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const copied: string[] = []
  const clock = world(on, { HOME: '/home/k' }, ran, copied)
  cliFail = { exitCode: 1, stderr: 'Error: INTERNAL_ERROR: the service hit an unexpected condition' }
  const ui = await open($, clock, 'terminal')
  expect(ids(await rowsOf(ui))).toContain('S:catalog')
  await ui.post({ press: 'S:catalog' }, { in: 'rows' })
  await clock.settle()
  const drawn = await drawnText(ui)
  expect(drawn).toContain('error: Error: INTERNAL_ERROR: the service hit an unexpected condition')
  for (const title of ONBOARD_TITLES) expect(drawn).not.toContain(title)
  expect(ids(await rowsOf(ui))).toContain('S:jobs')
  await ui.unmount()
})

test('onboarding: refresh brings the tree back once listing works, and a sign-out mid-session onboards until a listing works again', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const copied: string[] = []
  const clock = world(on, { HOME: '/home/k' }, ran, copied)
  cliFail = { exitCode: 1, stderr: 'Error: default auth: cannot configure default credentials' }
  const ui = await open($, clock, 'terminal')
  expect(await drawnText(ui)).toContain('Not signed in to Databricks')
  cliFail = null
  await ui.press({ key: 'refresh' })
  await clock.settle()
  let drawn = await drawnText(ui)
  for (const title of ONBOARD_TITLES) expect(drawn).not.toContain(title)
  expect(ids(await rowsOf(ui))).toEqual(['S:workspace', 'S:catalog', 'S:compute', 'S:jobs', 'S:pipelines', 'S:apps', 'S:dashboards'])
  await ui.post({ press: 'S:catalog' }, { in: 'rows' })
  await clock.settle()
  cliFail = { exitCode: 1, stderr: 'Error: Invalid access token. [ReqId: 9f]' }
  await clock.advance(600)
  await ui.post({ press: 'S:jobs' }, { in: 'rows' })
  await clock.settle()
  expect(await drawnText(ui)).toContain('Not signed in to Databricks')
  expect(await rowsOf(ui)).toBeUndefined()
  cliFail = null
  await $.tool.call({ tool: 'Bash', command: 'databricks clusters list' } as any)
  await clock.settle()
  drawn = await drawnText(ui)
  for (const title of ONBOARD_TITLES) expect(drawn).not.toContain(title)
  expect(ids(await rowsOf(ui))).toEqual(expect.arrayContaining(['UC:main', 'J:100']))
  await ui.unmount()
})
