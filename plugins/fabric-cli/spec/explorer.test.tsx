import { expect, mock, test } from 'claude-code/testing'
import { decoded, fabPositionals, invocations, tokenize } from '../hooks/parse'
import { runFailure, spawnFailure } from '../hooks/setup'

type Ran = string[][]
const opens: unknown[] = []
const closes: unknown[] = []
const PLUGIN = 'fabric-cli'
const PANE = 'fabric-pane'
const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const WORKSPACES = [...Array.from({ length: 60 }, (_, i) => ({ name: `WS${String(i).padStart(2, '0')}.Workspace`, id: UUID(i + 1) })), { name: 'My WS.Workspace', id: UUID(99) }]
const ITEMS: Record<string, { name: string; id: string }[]> = {
  'WS00.Workspace': [
    { name: 'Sales.SemanticModel', id: UUID(900) },
    { name: 'Sales.Report', id: UUID(901) },
    { name: 'LH.Lakehouse', id: UUID(902) },
    { name: 'Ops.Folder', id: UUID(903) },
  ],
  'WS00.Workspace/Ops.Folder': [{ name: 'Deep.Notebook', id: UUID(904) }],
  'My WS.Workspace': [{ name: 'My Model.SemanticModel', id: UUID(905) }],
}
let onTool: ((e: any) => Promise<void>) | null = null
let toolResult: any = null
let copyResult: any = { isCopied: true }
const failing = new Set<string>()
let domainsOn = false
let paged = false
const DOM = '11111111-2222-4333-8444-555555555555'
const toasts: string[] = []
let fabFail: ((argv: string[]) => unknown) | null = null
const envOf = new WeakMap<string[], Record<string, string> | undefined>()
let runHook: ((argv: string[]) => unknown) | null = null
let surfaces = ['terminal']

function world(on: any, env: Record<string, string>, ran: Ran) {
  mock.env(on, env)
  const clock = mock.clock(on, { now: 1_800_000_000_000 })
  mock.store(on)
  const copied: string[] = []
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/work' }))
  on('session.id', () => ({ value: 'test' }))
  on('session.surfaces', () => ({ value: surfaces }))
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
    toasts.push(String(e?.text ?? e))
    return { value: undefined }
  })
  on('ui.copy', (_$: any, e: any) => {
    copied.push(e.text)
    return { value: copyResult }
  })
  on('fs.read', () => {
    throw new Error('none')
  })
  on('fs.list', () => ({ value: [] }))
  on('fs.stat', () => {
    throw new Error('ENOENT')
  })
  on('process.run', (_$: any, e: any) => {
    const argv: string[] = [...e.argv]
    ran.push(argv)
    envOf.set(argv, e.init?.env)
    const hooked = runHook?.(argv)
    if (hooked) return hooked
    if (argv[0] === 'fab' && fabFail) {
      const failed = fabFail(argv)
      if (failed) return failed
    }
    const ok = (stdout: string) => ({ value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
    if (argv[0] === 'uname') return ok(env.OS ? '' : env.HOME?.startsWith('/Users') ? 'Darwin\n' : 'Linux\n')
    if (argv[0] === 'sh') return ok('missing\n')
    if (argv[0] === 'fab' && argv[1] === 'api' && argv[2]?.startsWith('workspaces')) {
      if (!domainsOn) return ok('')
      const all = WORKSPACES.map((w, i) => ({ id: w.id, displayName: w.name, ...(i < 3 || (paged && i === WORKSPACES.length - 1) ? { domainId: DOM } : {}) }))
      if (!paged) return ok(JSON.stringify({ status_code: 200, text: { value: all } }))
      const second = argv[2].includes('continuationToken=next')
      return ok(JSON.stringify({ status_code: 200, text: { value: second ? all.slice(30) : all.slice(0, 30), ...(second ? {} : { continuationToken: 'next' }) } }))
    }
    if (argv[0] === 'fab' && argv[1] === 'ls' && argv[2] === '/.domains') return ok(domainsOn ? JSON.stringify({ result: { data: [{ name: 'Sales.Domain', id: DOM }] } }) : '')
    if (argv[0] === 'fab' && argv[1] === 'ls') {
      const path = argv[2] && !argv[2].startsWith('-') ? argv[2].replace(/^\/+/, '') : ''
      if (failing.has(path)) return { value: { exitCode: 1, stdout: '', stderr: 'Forbidden', isStdoutTruncated: false, isStderrTruncated: false } }
      const data = path ? (ITEMS[path] ?? []) : WORKSPACES
      return ok(JSON.stringify({ status: 'Success', result: { data } }))
    }
    return ok('')
  })
  on('tool.call', async (_$: any, e: any) => {
    if (onTool) await onTool(e)
    return toolResult ?? { result: { stdout: '', stderr: '' } }
  })
  on('prompt.submit', (_$: any, e: any) => ({ text: e.text, context: e.context }))
  return { clock, copied }
}

const paneProps = (bodyRows: number) => ({ title: 'Fabric', isFocused: false, bodyColumns: 70, placement: 'dock', scroll: { offset: 0, bodyRows }, view: {} }) as any
const rowsOf = async (ui: any) => {
  const find = (n: any): any => (n?.type === 'Client' && n.props?.props?.rows && n.props.key === 'rows' ? n : (n?.children ?? []).map(find).find(Boolean))
  return find(await ui.drawn())?.props.props
}
const NERD = /[\u{e000}-\u{f8ff}\u{f0000}-\u{fffff}]/u

async function open($: any, clock: any, surface: 'terminal' | 'desktop') {
  await $.session.start({ cwd: '/work', surface, isInteractive: true })
  await clock.settle()
  await $.command.run({ command: PANE, args: '', origin: { kind: 'person' } } as any)
  await clock.settle()
  const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: PANE, props: paneProps(24) })
  await clock.settle()
  return ui
}

test('macOS app: workspaces draw, scroll, copy fab paths, clear search, open the portal and te', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock, copied } = world(on, { HOME: '/Users/k' }, ran)
  const ui = await open($, clock, 'desktop')
  let p = await rowsOf(ui)
  expect(p.rows[0].id).toBe('W:WS00')
  expect(p.bar).toBeDefined()
  expect(NERD.test(JSON.stringify(p.rows))).toBe(false)
  expect(JSON.stringify(p.rows)).not.toContain('below')
  await $.ui.scroll({ component: 'Pane', requestId: PANE, by: 1 } as any)
  await clock.settle()
  p = await rowsOf(ui)
  expect(p.rows[0].id).toBe('W:WS03')
  await ui.post({ scrollTo: 0 }, { in: 'rows' })
  await ui.post({ press: 'W:WS00' }, { in: 'rows' })
  await clock.settle()
  p = await rowsOf(ui)
  expect(JSON.stringify(p.rows)).toContain('W:WS00/Sales.SemanticModel')
  await ui.post({ copy: 'W:WS00/Sales.SemanticModel' }, { in: 'rows' })
  await clock.settle()
  expect(copied).toEqual(['WS00.Workspace/Sales.SemanticModel'])
  await ui.post({ press: 'W:WS00/Sales.SemanticModel', ctrl: true }, { in: 'rows' })
  await clock.settle()
  expect(ran.find(a => a[0] === 'open')?.at(-1)).toContain(`/groups/${UUID(1)}/datasets/${UUID(900)}`)
  await ui.post({ press: 'W:WS00/Sales.SemanticModel', shift: true }, { in: 'rows' })
  await clock.settle()
  const osa = ran.find(a => a[0] === 'osascript')
  expect(osa?.join(' ')).toContain("'te' 'interactive' '-s' 'WS00' '-d' 'Sales'")
  expect(ran.some(a => a[0] === 'setsid' || a[0] === 'xdg-terminal-exec')).toBe(false)
  await ui.input({ key: 'q', text: 'WS1', kind: 'change' })
  await clock.settle()
  expect(await ui.find({ key: 'clearq' })).toBeDefined()
  await ui.press({ key: 'clearq' })
  await clock.settle()
  expect(await ui.find({ key: 'clearq' })).toBeUndefined()
  await ui.unmount()
})

test('a fab export Claude runs shimmers teal on the item; fab get with -o too', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  await ui.post({ press: 'W:WS00' }, { in: 'rows' })
  await clock.settle()
  await $.tool.call({ tool: 'Bash', command: 'fab export "WS00.Workspace/Sales.SemanticModel" -o ./out -f' } as any)
  await clock.advance(50)
  const p = await rowsOf(ui)
  const row = p.rows.find((r: any) => r.id === 'W:WS00/Sales.SemanticModel')
  expect(JSON.stringify(row)).toContain('"sh":"teal"')
  await ui.unmount()
})

test('Windows: the portal opens through ShellExecute and te through PowerShell with literal arguments, never cmd, setsid or osascript', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { OS: 'Windows_NT', USERPROFILE: 'C:\\Users\\k' }, ran)
  const ui = await open($, clock, 'terminal')
  await ui.post({ press: 'W:WS00' }, { in: 'rows' })
  await clock.settle()
  await ui.post({ press: 'W:WS00/Sales.SemanticModel', ctrl: true }, { in: 'rows' })
  await ui.post({ press: 'W:WS00/Sales.SemanticModel', shift: true }, { in: 'rows' })
  await clock.settle()
  const portal = ran.find(a => a[0] === 'powershell' && a.at(-1)?.includes('UseShellExecute'))
  expect(portal?.at(-1)).toContain('$env:PANE_OPEN_TARGET')
  const shell = ran.find(a => a[0] === 'powershell' && a.at(-1)?.includes('Start-Process'))
  expect(shell?.at(-1)).toContain("& ''te'' ''interactive'' ''-s'' ''WS00'' ''-d'' ''Sales''")
  expect(ran.some(a => ['cmd', 'setsid', 'osascript', 'uname', 'xdg-terminal-exec'].includes(a[0] ?? ''))).toBe(false)
  await ui.unmount()
})

const OPS: [string, string, string][] = [
  ['fab ls "WS00.Workspace" -l', 'W:WS00', 'purple'],
  ['fab exists "WS00.Workspace/Sales.Report"', 'W:WS00/Sales.Report', 'purple'],
  ['fab get "WS00.Workspace/Sales.SemanticModel" -q definition', 'W:WS00/Sales.SemanticModel', 'purple'],
  ['fab get "WS00.Workspace/Sales.SemanticModel" -q definition -o ./out', 'W:WS00/Sales.SemanticModel', 'teal'],
  ['fab export "WS00.Workspace/Sales.Report" -o ./out -f', 'W:WS00/Sales.Report', 'teal'],
  ['fab bulk-export "WS00.Workspace" -o ./bk', 'W:WS00', 'teal'],
  ['fab cp "WS00.Workspace/Sales.Report" ./local/', 'W:WS00/Sales.Report', 'teal'],
  ['fab cp ./local/Sales.Report "WS00.Workspace/Sales.Report" -f', 'W:WS00/Sales.Report', 'pink'],
  ['fab import "WS00.Workspace/Sales.Report" -i ./dir -f', 'W:WS00/Sales.Report', 'pink'],
  ['fab set "WS00.Workspace/Sales.Report" -q displayName -i Renamed -f', 'W:WS00/Sales.Report', 'orange'],
  ['fab mkdir "WS00.Workspace/New.Notebook"', 'W:WS00', 'orange'],
  ['fab rm "WS00.Workspace/Gone.Notebook" -f', 'W:WS00', 'orange'],
  ['fab job run "WS00.Workspace/Ops.Folder/Deep.Notebook"', 'W:WS00/Ops.Folder/Deep.Notebook', 'orange'],
  ['fab job run-status "WS00.Workspace/Ops.Folder/Deep.Notebook" --id 1', 'W:WS00/Ops.Folder/Deep.Notebook', 'purple'],
  ['fab table optimize "WS00.Workspace/LH.Lakehouse/Tables/sales" --vorder', 'W:WS00/LH.Lakehouse', 'orange'],
  ['fab table schema "WS00.Workspace/LH.Lakehouse/Tables/sales"', 'W:WS00/LH.Lakehouse', 'purple'],
  ['fab ls "WS00.Workspace/LH.Lakehouse/Files/raw"', 'W:WS00/LH.Lakehouse', 'purple'],
  ['fab acl get "WS00.Workspace"', 'W:WS00', 'purple'],
  ['fab acl set "WS00.Workspace" -I u@x.com -R viewer -f', 'W:WS00', 'orange'],
  ['fab assign ".capacities/cap.Capacity" -W "WS00.Workspace" -f', 'W:WS00', 'orange'],
  ['fab start "WS00.Workspace/Mirror.MirroredDatabase" -f', 'W:WS00', 'orange'],
  ['fab cd "WS00.Workspace" && fab get "Sales.Report"', 'W:WS00/Sales.Report', 'purple'],
  ["fab get 'My WS.Workspace/My Model.SemanticModel' -q . | jq .", 'W:My WS/My Model.SemanticModel', 'purple'],
]

test('every fab operation class lights the right item in the right tone', { timeoutMs: 60_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  const misses: string[] = []
  for (const [command, id, tone] of OPS) {
    await $.tool.call({ tool: 'Bash', command } as any)
    await clock.advance(50)
    const p = await rowsOf(ui)
    const row = p.rows.find((r: any) => r.id === id)
    if (!JSON.stringify(row ?? {}).includes(`"sh":"${tone}"`)) misses.push(`${command} -> ${id} ${tone}: ${row ? 'wrong tone' : 'not in view'}`)
    await clock.advance(3000)
  }
  expect(misses).toEqual([])
  await $.tool.call({ tool: 'Bash', command: 'fab find "sales"' } as any)
  await clock.advance(50)
  await ui.unmount()
})

test('auth, config, help and commented-out fab commands are ignored', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  for (const command of ['fab auth status', 'fab config set mode command_line', 'fab --version', 'fab desc .Workspace', 'echo hi # fab rm "WS00.Workspace/Sales.Report" -f']) {
    await $.tool.call({ tool: 'Bash', command } as any)
    await clock.advance(50)
  }
  expect(ran.filter(a => a[0] === 'fab')).toEqual([])
})

test('Claude activity scrolls into view; a user scroll stays put without activity', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  await ui.post({ scrollTo: 1 }, { in: 'rows' })
  await clock.settle()
  let p = await rowsOf(ui)
  expect(p.rows.some((r: any) => r.id === 'W:WS00')).toBe(false)
  await $.tool.call({ tool: 'Bash', command: 'fab get "WS00.Workspace/Sales.SemanticModel" -q definition' } as any)
  await clock.advance(50)
  p = await rowsOf(ui)
  expect(JSON.stringify(p.rows.find((r: any) => r.id === 'W:WS00/Sales.SemanticModel') ?? {})).toContain('"sh":"purple"')
  await clock.advance(3000)
  await $.ui.scroll({ component: 'Pane', requestId: PANE, by: 3 } as any)
  await clock.settle()
  const top = (await rowsOf(ui)).rows[0].id
  await clock.advance(6000)
  await ui.redraw()
  expect((await rowsOf(ui)).rows[0].id).toBe(top)
  await ui.unmount()
})

test('a running fab command shows a spinner on its workspace', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  let mid = ''
  onTool = async () => {
    await ui.redraw()
    mid = JSON.stringify((await rowsOf(ui)).rows.find((r: any) => r.id === 'W:WS00') ?? {})
  }
  await $.tool.call({ tool: 'Bash', command: 'fab export "WS00.Workspace/Sales.Report" -o ./out -f' } as any)
  onTool = null
  await clock.advance(50)
  expect(mid).toContain('"spin":true')
  await ui.unmount()
})

test('a change in a workspace keeps its open folders expanded', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  await ui.post({ press: 'W:WS00' }, { in: 'rows' })
  await clock.settle()
  await ui.post({ press: 'W:WS00/Ops.Folder' }, { in: 'rows' })
  await clock.settle()
  await $.tool.call({ tool: 'Bash', command: 'fab set "WS00.Workspace/Sales.Report" -q displayName -i "Sales 2"' } as any)
  await clock.advance(50)
  const p = await rowsOf(ui)
  expect(JSON.stringify(p.rows)).toContain('W:WS00/Ops.Folder/Deep.Notebook')
  expect(JSON.stringify(p.rows)).not.toContain('loading')
  await ui.unmount()
})

test('sidebar only: no pane in the default layout or a narrow terminal, and an inline pane closes itself', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const copied: string[] = []
  const { clock } = world(on, { HOME: '/Users/k' }, ran)
  const before = opens.length
  const main = await $.command.run({ command: PANE, args: '', origin: { kind: 'person' }, presentation: { isFullscreen: false, columns: 200 } } as any)
  expect(JSON.stringify(main)).toContain('/tui fullscreen')
  const narrow = await $.command.run({ command: PANE, args: '', origin: { kind: 'person' }, presentation: { isFullscreen: true, columns: 90 } } as any)
  expect(JSON.stringify(narrow)).toContain('110 columns')
  expect(opens.length).toBe(before)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: { ...paneProps(24), placement: 'inline' } })
  await clock.settle()
  expect(closes.length).toBeGreaterThan(0)
  await ui.unmount()
  void copied
})

const lists = (ran: Ran, path: string) => ran.filter(a => a[0] === 'fab' && a[1] === 'ls' && a[2] === `/${path}`).length

test('a failing workspace is listed once per refresh, and its error stays until that workspace loads', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  failing.add('WS01.Workspace')
  const ui = await open($, clock, 'terminal')
  await ui.post({ press: 'W:WS01' }, { in: 'rows' })
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).toContain('error: Forbidden')
  const before = lists(ran, 'WS01.Workspace')
  await ui.press({ key: 'refresh' })
  await clock.settle()
  expect(lists(ran, 'WS01.Workspace') - before).toBe(1)
  failing.delete('WS01.Workspace')
  await ui.post({ press: 'W:WS00' }, { in: 'rows' })
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).toContain('error: Forbidden')
  await clock.advance(600)
  await ui.post({ press: 'W:WS01' }, { in: 'rows' })
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).not.toContain('error: Forbidden')
  await ui.unmount()
})

test('one fab command touching a workspace several times reloads it once', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  await ui.post({ press: 'W:WS00' }, { in: 'rows' })
  await clock.settle()
  const before = lists(ran, 'WS00.Workspace')
  await $.tool.call({ tool: 'Bash', command: 'fab cp WS00.Workspace/Sales.Report WS00.Workspace/Copy.Report && fab rm WS00.Workspace/LH.Lakehouse -f' } as any)
  await clock.settle()
  expect(lists(ran, 'WS00.Workspace') - before).toBe(1)
  await ui.unmount()
})

test('a folder left open under a collapsed workspace loads when the workspace opens again', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  await ui.post({ press: 'W:WS00' }, { in: 'rows' })
  await clock.settle()
  await ui.post({ press: 'W:WS00/Ops.Folder' }, { in: 'rows' })
  await clock.settle()
  await ui.post({ press: 'W:WS00' }, { in: 'rows' })
  await clock.advance(600)
  await ui.press({ key: 'refresh' })
  await clock.settle()
  await ui.post({ press: 'W:WS00' }, { in: 'rows' })
  await clock.settle()
  const p = await rowsOf(ui)
  expect(p.rows.some((r: any) => r.id === 'W:WS00/Ops.Folder/Deep.Notebook')).toBe(true)
  await ui.unmount()
})

test('with the pane hidden, fab commands Claude runs list nothing', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  await ui.post({ press: 'W:WS00' }, { in: 'rows' })
  await clock.settle()
  await ui.unmount()
  const inline = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: { ...paneProps(24), placement: 'inline' } })
  await clock.settle()
  const before = ran.filter(a => a[0] === 'fab').length
  await $.tool.call({ tool: 'Bash', command: 'fab set "WS00.Workspace/Sales.SemanticModel" -q description -i x -f' } as any)
  await clock.settle()
  expect(ran.filter(a => a[0] === 'fab').length).toBe(before)
  await inline.unmount()
})

test('a fab command inside a for loop reveals each workspace the loop names', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  await $.tool.call({ tool: 'Bash', command: 'for w in WS00 "My WS"; do fab ls "$w.Workspace"; done' } as any)
  await clock.settle()
  expect(lists(ran, 'WS00.Workspace')).toBe(1)
  expect(lists(ran, 'My WS.Workspace')).toBe(1)
  const p = await rowsOf(ui)
  expect(p.rows.some((r: any) => r.id === 'W:My WS/My Model.SemanticModel')).toBe(true)
  await ui.unmount()
})

test('creating or deleting a whole workspace re-lists the tenant instead of listing the workspace', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  const roots = () => ran.filter(a => a[0] === 'fab' && a[1] === 'ls' && a[2] === '/').length
  const before = roots()
  await $.tool.call({ tool: 'Bash', command: 'fab rm WS05.Workspace -f' } as any)
  await clock.settle()
  expect(roots() - before).toBe(1)
  expect(lists(ran, 'WS05.Workspace')).toBe(0)
  await ui.unmount()
})

test('the selection stops riding along with prompts once the pane is hidden', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  await ui.post({ press: 'W:WS00' }, { in: 'rows' })
  await clock.settle()
  const shown = await $.prompt.submit({ text: 'what is this', context: [] } as any)
  expect(JSON.stringify(shown)).toContain('WS00')
  await ui.unmount()
  const inline = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: { ...paneProps(24), placement: 'inline' } })
  await clock.settle()
  const hidden = await $.prompt.submit({ text: 'what is this', context: [] } as any)
  expect(JSON.stringify(hidden)).not.toContain('WS00')
  await inline.unmount()
})

test('an empty workspace shows an empty marker and picks up an item Claude creates in it', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  await ui.post({ press: 'W:WS05' }, { in: 'rows' })
  await clock.settle()
  let p = await rowsOf(ui)
  expect(JSON.stringify(p.rows)).toContain('empty')
  ITEMS['WS05.Workspace'] = [{ name: 'New.Notebook', id: UUID(950) }]
  await $.tool.call({ tool: 'Bash', command: 'fab mkdir WS05.Workspace/New.Notebook' } as any)
  await clock.settle()
  p = await rowsOf(ui)
  expect(p.rows.some((r: any) => r.id === 'W:WS05/New.Notebook')).toBe(true)
  delete ITEMS['WS05.Workspace']
  await ui.unmount()
})

test('a change keeps loaded folders and does not re-list them', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  await ui.post({ press: 'W:WS00' }, { in: 'rows' })
  await clock.settle()
  await ui.post({ press: 'W:WS00/Ops.Folder' }, { in: 'rows' })
  await clock.settle()
  const before = lists(ran, 'WS00.Workspace/Ops.Folder')
  await $.tool.call({ tool: 'Bash', command: 'fab set "WS00.Workspace/Sales.SemanticModel" -q description -i x -f' } as any)
  await clock.settle()
  expect(lists(ran, 'WS00.Workspace/Ops.Folder')).toBe(before)
  const p = await rowsOf(ui)
  expect(p.rows.some((r: any) => r.id === 'W:WS00/Ops.Folder/Deep.Notebook')).toBe(true)
  await ui.unmount()
})

test('a commit message that mentions fab commands runs nothing', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  const before = ran.filter(a => a[0] === 'fab').length
  await $.tool.call({ tool: 'Bash', command: "git commit -m \"$(cat <<'EOF'\nDocs: fab rm WS03.Workspace -f\nEOF\n)\"" } as any)
  await $.tool.call({ tool: 'Bash', command: 'git commit -m "explain \\`fab rm WS04.Workspace -f\\`"' } as any)
  await clock.settle()
  expect(ran.filter(a => a[0] === 'fab').length).toBe(before)
  await ui.unmount()
})

test('an item created inside an open folder appears without a manual refresh', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  await ui.post({ press: 'W:WS00' }, { in: 'rows' })
  await clock.settle()
  await ui.post({ press: 'W:WS00/Ops.Folder' }, { in: 'rows' })
  await clock.settle()
  const saved = ITEMS['WS00.Workspace/Ops.Folder']
  ITEMS['WS00.Workspace/Ops.Folder'] = [...(saved ?? []), { name: 'Created.Notebook', id: UUID(960) }]
  await $.tool.call({ tool: 'Bash', command: 'fab mkdir WS00.Workspace/Ops.Folder/Created.Notebook' } as any)
  await clock.settle()
  const p = await rowsOf(ui)
  expect(p.rows.some((r: any) => r.id === 'W:WS00/Ops.Folder/Created.Notebook')).toBe(true)
  ITEMS['WS00.Workspace/Ops.Folder'] = saved ?? []
  await ui.unmount()
})

test('a compound command that fails after a create still shows the created item', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  await ui.post({ press: 'W:WS02' }, { in: 'rows' })
  await clock.settle()
  ITEMS['WS02.Workspace'] = [{ name: 'Made.Report', id: UUID(961) }]
  toolResult = { result: { stdout: '', stderr: 'boom' }, isError: true }
  await $.tool.call({ tool: 'Bash', command: 'fab mkdir WS02.Workspace/Made.Report && false' } as any)
  toolResult = null
  await clock.settle()
  const p = await rowsOf(ui)
  expect(p.rows.some((r: any) => r.id === 'W:WS02/Made.Report')).toBe(true)
  delete ITEMS['WS02.Workspace']
  await ui.unmount()
})

test('a fab command sent to the background keeps its spinner until its task notification arrives', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  toolResult = { result: { stdout: '', stderr: '', interrupted: false, backgroundTaskId: 'bg77' } }
  await $.tool.call({ tool: 'Bash', command: 'fab export "WS00.Workspace/Sales.SemanticModel" -o ./out -f' } as any)
  toolResult = null
  await clock.advance(200)
  expect(JSON.stringify(await rowsOf(ui))).toContain('"spin":true')
  await $.prompt.submit({ text: '<task-notification><task-id>bg77</task-id><status>completed</status></task-notification>', origin: { kind: 'task-notification' } } as any)
  await clock.settle()
  expect(JSON.stringify((await rowsOf(ui)).rows.find((r: any) => r.id === 'W:WS00'))).not.toContain('"spin":true')
  await ui.unmount()
})

test('rm -f on a whole workspace re-lists the tenant, and a refused clipboard write says so', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  const roots = () => ran.filter(a => a[0] === 'fab' && a[1] === 'ls' && a[2] === '/').length
  const before = roots()
  await $.tool.call({ tool: 'Bash', command: 'fab rm -f WS05.Workspace' } as any)
  await clock.settle()
  expect(roots() - before).toBe(1)
  copyResult = { isCopied: false, reason: 'no-clipboard' }
  await ui.post({ copy: 'W:WS00' }, { in: 'rows' })
  await clock.settle()
  copyResult = { isCopied: true }
  expect(toasts.at(-1)).toBe('Could not copy')
  await ui.unmount()
})

const held = () => {
  let release = () => {}
  const until = new Promise<void>(r => (release = r))
  return { until, release }
}
const done = (stdout: string, more: object = {}) => ({ value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false, ...more } })
const failed = (stderr: string) => ({ value: { exitCode: 1, stdout: '', stderr, isStdoutTruncated: false, isStderrTruncated: false } })
const listed = (path: string) => JSON.stringify({ result: { data: ITEMS[path] ?? [] } })

test('a workspace reload that finishes after a newer refresh is dropped', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  ITEMS['WS03.Workspace'] = [{ name: 'Old.Report', id: UUID(970) }]
  await ui.post({ press: 'W:WS03' }, { in: 'rows' })
  await clock.settle()
  const slow = held()
  let first = true
  runHook = argv => {
    if (argv[1] !== 'ls' || argv[2] !== '/WS03.Workspace' || !first) return null
    first = false
    const stdout = listed('WS03.Workspace')
    return slow.until.then(() => done(stdout))
  }
  await $.tool.call({ tool: 'Bash', command: 'fab set WS03.Workspace/Old.Report -q description -i x' } as any)
  await clock.advance(10)
  ITEMS['WS03.Workspace'] = [{ name: 'New.Report', id: UUID(971) }]
  await ui.press({ key: 'refresh' })
  await clock.settle()
  slow.release()
  await clock.settle()
  runHook = null
  expect((await rowsOf(ui)).rows.some((r: any) => r.id === 'W:WS03/New.Report')).toBe(true)
  delete ITEMS['WS03.Workspace']
  await ui.unmount()
})

test('a cut-off tenant listing keeps the tree and says why', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  runHook = argv => (argv[1] === 'ls' && argv[2] === '/' ? done('{"result":{"data":[{"name":"WS00.Wor', { isStdoutTruncated: true }) : null)
  await ui.press({ key: 'refresh' })
  await clock.settle()
  runHook = null
  expect((await rowsOf(ui)).rows.some((r: any) => r.id === 'W:WS00')).toBe(true)
  expect(JSON.stringify(await ui.drawn())).toContain('too much output')
  await ui.unmount()
})

test('/fabric-pane opens in a session with the desktop app attached, whatever the terminal layout', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  world(on, { HOME: '/home/k' }, ran)
  surfaces = ['terminal', 'desktop']
  const before = opens.length
  await $.command.run({ command: PANE, args: '', origin: { kind: 'person' }, presentation: { isFullscreen: false, columns: 80 } } as any)
  surfaces = ['terminal']
  expect(opens.length).toBeGreaterThan(before)
})

test('a slow earlier selection does not overwrite the details of the latest one', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  const slow = held()
  runHook = argv => (argv[1] === 'ls' && argv[2] === '/WS00.Workspace' ? slow.until.then(() => done(listed('WS00.Workspace'))) : null)
  void ui.post({ press: 'W:WS00' }, { in: 'rows' })
  await clock.advance(1000)
  await ui.post({ press: 'W:WS01' }, { in: 'rows' })
  await clock.settle()
  slow.release()
  await clock.settle()
  runHook = null
  const drawn = JSON.stringify(await ui.drawn())
  expect(drawn).toContain('workspace WS01')
  expect(drawn).not.toContain('workspace WS00')
  await ui.unmount()
})

test('heredoc markers inside quotes or comments hide no commands; expanding heredoc bodies still run their substitutions; -f takes no value', { timeoutMs: 5_000 }, async () => {
  expect(invocations("printf '%s\\n' 'example <<EOF'\nfab rm WS05.Workspace -f", '/w')).toHaveLength(1)
  expect(invocations('echo x # <<EOF\nfab rm WS05.Workspace -f', '/w')).toHaveLength(1)
  expect(invocations('cat <<EOF\n$(fab rm WS05.Workspace -f)\nEOF', '/w')).toHaveLength(1)
  expect(invocations("cat <<'EOF'\n$(fab rm WS05.Workspace -f)\nEOF", '/w')).toHaveLength(0)
  expect(fabPositionals(['-f', 'WS05.Workspace'])).toEqual(['WS05.Workspace'])
})

test('fab listings from many commands at once share one limit of four processes', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  const slow = held()
  let live = 0
  let peak = 0
  runHook = argv => {
    if (argv[1] !== 'ls' || argv[2] === '/') return null
    peak = Math.max(peak, ++live)
    return slow.until.then(() => {
      live--
      return done(listed(''))
    })
  }
  for (let i = 10; i < 20; i++) await $.tool.call({ tool: 'Bash', command: `fab ls WS${i}.Workspace` } as any)
  await clock.advance(1000)
  slow.release()
  await clock.settle()
  runHook = null
  expect(peak).toBe(4)
  await ui.unmount()
})

test('a workspace reload that fails after a change shows its error', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  await ui.post({ press: 'W:WS00' }, { in: 'rows' })
  await clock.settle()
  failing.add('WS00.Workspace')
  await $.tool.call({ tool: 'Bash', command: 'fab mkdir WS00.Workspace/X.Report' } as any)
  await clock.settle()
  failing.delete('WS00.Workspace')
  expect(JSON.stringify(await ui.drawn())).toContain('error: Forbidden')
  await ui.unmount()
})

test('Linux: a failed URL launch reports the target', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  await ui.post({ press: 'W:WS00' }, { in: 'rows' })
  await clock.settle()
  runHook = argv => (argv[0] === 'sh' && argv[2]?.startsWith('setsid') ? failed('gio: no handler') : null)
  await ui.post({ press: 'W:WS00/Sales.Report', ctrl: true }, { in: 'rows' })
  await clock.settle()
  runHook = null
  expect(toasts.some(t => t.startsWith('could not open https://') && t.includes('gio: no handler'))).toBe(true)
  await ui.unmount()
})

test('macOS: a refused osascript or open says it could not start', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/Users/k' }, ran)
  const ui = await open($, clock, 'terminal')
  await ui.post({ press: 'W:WS00' }, { in: 'rows' })
  await clock.settle()
  runHook = argv => (argv[0] === 'osascript' || argv[0] === 'open' ? failed('execution error: Not authorized to send Apple events to Terminal. (-1743)') : null)
  const from = toasts.length
  await ui.post({ press: 'W:WS00/Sales.SemanticModel', shift: true }, { in: 'rows' })
  await ui.post({ press: 'W:WS00/Sales.SemanticModel', ctrl: true }, { in: 'rows' })
  await clock.settle()
  runHook = null
  expect(toasts.slice(from).filter(t => t.startsWith('could not start'))).toHaveLength(1)
  expect(toasts.slice(from).filter(t => t.startsWith('could not open'))).toHaveLength(1)
  await ui.unmount()
})

test('a lakehouse opens to Files and Tables; a Delta folder becomes a table and a schema lists its tables', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const lake = ITEMS as Record<string, { name: string; id?: string; type?: string }[]>
  lake['WS00.Workspace/LH.Lakehouse'] = [{ name: 'Files' }, { name: 'Tables' }]
  lake['WS00.Workspace/LH.Lakehouse/Tables'] = [{ name: 'orders', type: 'Directory' }, { name: 'dbo', type: 'Directory' }]
  lake['WS00.Workspace/LH.Lakehouse/Tables/orders'] = [{ name: '_delta_log', type: 'Directory' }, { name: 'part-0.parquet', type: 'File' }]
  lake['WS00.Workspace/LH.Lakehouse/Tables/dbo'] = [{ name: 'customers', type: 'Directory' }]
  const ui = await open($, clock, 'terminal')
  const press = async (id: string) => {
    await clock.advance(600)
    await ui.post({ press: id }, { in: 'rows' })
    await clock.settle()
  }
  await press('W:WS00')
  await press('W:WS00/LH.Lakehouse')
  let p = await rowsOf(ui)
  expect(p.rows.some((r: any) => r.id === 'W:WS00/LH.Lakehouse/Tables')).toBe(true)
  expect(p.rows.some((r: any) => r.id === 'W:WS00/LH.Lakehouse/Files')).toBe(true)
  await press('W:WS00/LH.Lakehouse/Tables')
  await press('W:WS00/LH.Lakehouse/Tables/orders')
  await press('W:WS00/LH.Lakehouse/Tables/dbo')
  p = await rowsOf(ui)
  const ids = p.rows.map((r: any) => r.id)
  expect(ids).toContain('W:WS00/LH.Lakehouse/Tables/dbo/customers')
  expect(ids.some((id: string) => id.startsWith('W:WS00/LH.Lakehouse/Tables/orders/'))).toBe(false)
  expect(JSON.stringify(p.rows.find((r: any) => r.id === 'W:WS00/LH.Lakehouse/Tables/orders'))).toContain('Delta table')
  for (const k of Object.keys(lake)) if (k.startsWith('WS00.Workspace/LH.Lakehouse')) delete lake[k]
  await ui.unmount()
})

test('follow off: Claude reads far away or inside a folder above the view never move it; the wheel still does', { timeoutMs: 20_000, options: { follow: 'off' } } as any, async ($: any, on: any) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  await $.ui.scroll({ component: 'Pane', requestId: PANE, by: 20 })
  await clock.settle()
  const top = (await rowsOf(ui)).rows[0]?.id
  expect(top).not.toBe('W:WS00')
  await $.tool.call({ tool: 'Bash', command: 'fab get "WS58.Workspace" -q id' } as any)
  await clock.settle()
  expect((await rowsOf(ui)).rows[0]?.id).toBe(top)
  await $.tool.call({ tool: 'Bash', command: 'fab get "WS00.Workspace/Sales.SemanticModel" -q id' } as any)
  await clock.settle()
  expect((await rowsOf(ui)).rows[0]?.id).toBe(top)
  await $.ui.scroll({ component: 'Pane', requestId: PANE, by: 10 })
  await clock.settle()
  expect((await rowsOf(ui)).rows[0]?.id).not.toBe(top)
  await ui.unmount()
})

test('workspaces group by domain with counts through the absolute /.domains path, and the top-left icon turns grouping off', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  domainsOn = true
  const ui = await open($, clock, 'terminal')
  let p = await rowsOf(ui)
  const ids = p.rows.map((r: any) => r.id)
  expect(ids).toContain(`D:${DOM}`)
  expect(ids).toContain('D:none')
  expect(JSON.stringify(p.rows.find((r: any) => r.id === `D:${DOM}`))).toContain('3 workspaces')
  expect(ids).not.toContain('W:WS00')
  expect(ran.filter(a => a[1] === 'ls' && a[2]?.endsWith('.domains')).every(a => a[2] === '/.domains')).toBe(true)
  await ui.press({ key: 'domains' })
  await clock.settle()
  p = await rowsOf(ui)
  expect(p.rows.map((r: any) => r.id)).toContain('W:WS00')
  domainsOn = false
  await ui.unmount()
})

test('double-clicking a workspace navigates into it; up and home come back', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  await ui.post({ press: 'W:WS00' }, { in: 'rows' })
  await clock.advance(100)
  await ui.post({ press: 'W:WS00' }, { in: 'rows' })
  await clock.settle()
  let p = await rowsOf(ui)
  expect(p.rows[0]?.id).toBe('W:WS00/Sales.SemanticModel')
  expect(p.rows.map((r: any) => r.id)).not.toContain('W:WS01')
  expect(JSON.stringify(await ui.drawn())).toContain('WS00')
  await ui.press({ key: 'home' })
  await clock.settle()
  p = await rowsOf(ui)
  expect(p.rows.map((r: any) => r.id)).toContain('W:WS01')
  await ui.unmount()
})

test('a te query against a Fabric model lights the semantic model purple', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  await $.tool.call({ tool: 'Bash', command: 'te query -s "powerbi://api.powerbi.com/v1.0/myorg/WS00" -d Sales "EVALUATE ROW(1)"' } as any)
  await clock.advance(50)
  const p = await rowsOf(ui)
  expect(JSON.stringify(p.rows.find((r: any) => r.id === 'W:WS00/Sales.SemanticModel'))).toContain('"sh":"purple"')
  await ui.unmount()
})

test('plain glyphs: domains, lakehouse folders, navigation and buttons draw without any private-use characters', { timeoutMs: 20_000, options: { glyphs: 'plain' } } as any, async ($: any, on: any) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  domainsOn = true
  const lake = ITEMS as Record<string, { name: string; id?: string; type?: string }[]>
  lake['WS00.Workspace/LH.Lakehouse'] = [{ name: 'Files' }, { name: 'Tables' }]
  const ui = await open($, clock, 'terminal')
  const press = async (id: string) => {
    await clock.advance(600)
    await ui.post({ press: id }, { in: 'rows' })
    await clock.settle()
  }
  await press(`D:${DOM}`)
  await press('W:WS00')
  await press('W:WS00/LH.Lakehouse')
  const plain = JSON.stringify(await ui.drawn())
  expect(plain).not.toMatch(NERD)
  for (const ch of ['◇', '◫', '◆', '▣', '≋', '■']) expect(plain).toContain(ch)
  await clock.advance(600)
  await ui.post({ press: 'W:WS00' }, { in: 'rows' })
  await clock.advance(100)
  await ui.post({ press: 'W:WS00' }, { in: 'rows' })
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).not.toMatch(NERD)
  delete lake['WS00.Workspace/LH.Lakehouse']
  domainsOn = false
  await ui.unmount()
})

test('domain grouping follows every page of workspaces, and skips the workspace listing when no domain names are readable', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  domainsOn = true
  paged = true
  const ui = await open($, clock, 'terminal')
  const p = await rowsOf(ui)
  expect(JSON.stringify(p.rows.find((r: any) => r.id === `D:${DOM}`))).toContain('4 workspaces')
  expect(ran.some(a => a[1] === 'api' && a[2] === 'workspaces?continuationToken=next')).toBe(true)
  paged = false
  domainsOn = false
  await ui.unmount()
})

test('without readable domain names the pane never lists workspaces through the API', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  expect(ran.some(a => a[1] === 'api' && a[2]?.startsWith('workspaces'))).toBe(false)
  expect((await rowsOf(ui)).rows.map((r: any) => r.id)).toContain('W:WS00')
  await ui.unmount()
})

test('a fab binary written with ~ falls back to fab on PATH; an absolute one is kept for the pane listings', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  const listingsAfter = (from: number) => ran.slice(from).filter(a => a[1] === 'ls')
  let from = ran.length
  await $.tool.call({ tool: 'Bash', command: 'cd ~/proj && ~/.local/bin/fab ls "WS00.Workspace"' } as any)
  await clock.settle()
  await ui.press({ key: 'refresh' })
  await clock.settle()
  expect(listingsAfter(from).length).toBeGreaterThan(0)
  expect(listingsAfter(from).every(a => a[0] === 'fab')).toBe(true)
  expect(ran.slice(from).some(a => a[0]?.includes('~'))).toBe(false)
  from = ran.length
  await $.tool.call({ tool: 'Bash', command: '/opt/fab/bin/fab ls "WS00.Workspace"' } as any)
  await clock.settle()
  await ui.press({ key: 'refresh' })
  await clock.settle()
  expect(listingsAfter(from).some(a => a[0] === '/opt/fab/bin/fab')).toBe(true)
  await ui.unmount()
})

test('listings carry the auth env of the command that triggered them, and /fabric-pane keeps that tenant apart from the default one', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  const roots = (from: number) => ran.slice(from).filter(a => a[0] === 'fab' && a[1] === 'ls' && a[2] === '/')
  let from = ran.length
  await $.tool.call({ tool: 'Bash', command: 'FAB_TENANT_ID=tenant-b FAB_SPN_CLIENT_ID=app-b FAB_SPN_CLIENT_SECRET=s fab ls WS00.Workspace' } as any)
  await clock.settle()
  const tenantB = ran.slice(from).filter(a => a[0] === 'fab' && a[1] === 'ls')
  expect(tenantB.length).toBeGreaterThan(0)
  expect(tenantB.every(a => envOf.get(a)?.FAB_TENANT_ID === 'tenant-b')).toBe(true)
  await $.command.run({ command: PANE, args: '', origin: { kind: 'person' } } as any)
  await clock.settle()
  from = ran.length
  await $.tool.call({ tool: 'Bash', command: 'fab ls WS00.Workspace' } as any)
  await clock.settle()
  expect(roots(from).length).toBe(1)
  expect(envOf.get(roots(from)[0] ?? [])?.FAB_TENANT_ID).toBeUndefined()
  await ui.unmount()
})

test('/fabric-pane <workspace> opens the domain the workspace sits in and puts the cursor on it', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  domainsOn = true
  const ui = await open($, clock, 'terminal')
  expect((await rowsOf(ui)).rows.map((r: any) => r.id)).not.toContain('W:WS01')
  await $.command.run({ command: PANE, args: 'WS01', origin: { kind: 'person' } } as any)
  await clock.settle()
  expect((await rowsOf(ui)).rows.map((r: any) => r.id)).toContain('W:WS01')
  domainsOn = false
  await ui.unmount()
})

test('redirections and URL text parse safely: &> stays one operator and a bare % is kept as is', { timeoutMs: 5_000 }, async () => {
  const tokens = tokenize('fab ls "WS00.Workspace" &> /dev/null')
  expect(tokens).toContain('&>')
  expect(tokens).not.toContain('&')
  expect(decoded('100% Sales')).toBe('100% Sales')
  expect(decoded('Sales%20Team')).toBe('Sales Team')
})

test('without the icon fonts Claude gets a one-line font hint once per session', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  const first = JSON.stringify(await $.prompt.submit({ text: 'hi', context: [] } as any))
  expect(first).toContain('github.com/data-goblin/fabric-nf')
  expect(first).toContain('fontHint=off')
  const second = JSON.stringify(await $.prompt.submit({ text: 'hi', context: [] } as any))
  expect(second).not.toContain('fabric-nf')
  await ui.unmount()
})

test('fontHint off keeps the font hint out of prompts', { timeoutMs: 20_000, options: { fontHint: 'off' } } as any, async ($: any, on: any) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  expect(JSON.stringify(await $.prompt.submit({ text: 'hi', context: [] } as any))).not.toContain('fabric-nf')
  await ui.unmount()
})

test('a plain glyphs setting is a choice, not a fallback, so no font hint', { timeoutMs: 20_000, options: { glyphs: 'plain' } } as any, async ($: any, on: any) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  expect(JSON.stringify(await $.prompt.submit({ text: 'hi', context: [] } as any))).not.toContain('fabric-nf')
  await ui.unmount()
})

test('a fab command Claude runs in another workspace leaves your selection where you put it', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  domainsOn = true
  const ui = await open($, clock, 'terminal')
  await ui.post({ press: `D:${DOM}` }, { in: 'rows' })
  await clock.settle()
  await clock.advance(600)
  await ui.post({ press: 'W:WS00' }, { in: 'rows' })
  await clock.settle()
  expect((await rowsOf(ui)).active).toBe('W:WS00')
  await $.tool.call({ tool: 'Bash', command: 'fab get "WS40.Workspace/Model.SemanticModel" -q id' } as any)
  await clock.advance(3000)
  await clock.settle()
  expect((await rowsOf(ui)).active).toBe('W:WS00')
  domainsOn = false
  await ui.unmount()
})

test('while Claude reads far down the tree, the domain and workspace it sits in stay pinned; the search row says Claude is working', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  domainsOn = true
  const ui = await open($, clock, 'terminal')
  await ui.post({ press: `D:${DOM}` }, { in: 'rows' })
  await clock.settle()
  await clock.advance(600)
  await ui.post({ press: 'D:none' }, { in: 'rows' })
  await clock.settle()
  let working = ''
  onTool = async () => {
    working = JSON.stringify(await ui.drawn())
  }
  await $.tool.call({ tool: 'Bash', command: 'fab get "WS50.Workspace/Model.SemanticModel" -q id' } as any)
  onTool = null
  expect(working).toContain('Claude is working in Fabric...')
  await clock.advance(100)
  const during = (await rowsOf(ui)).rows.map((r: any) => r.id)
  expect(during).toContain('D:none')
  expect(during).toContain('W:WS50')
  await clock.advance(6000)
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).not.toContain('Claude is working')
  domainsOn = false
  await ui.unmount()
})

test('/fabric-pane takes a workspace name with spaces, quoted or not', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  await $.command.run({ command: PANE, args: 'My WS', origin: { kind: 'person' } } as any)
  await clock.settle()
  expect((await rowsOf(ui)).active).toBe('W:My WS')
  await $.command.run({ command: PANE, args: '"WS02"', origin: { kind: 'person' } } as any)
  await clock.settle()
  expect((await rowsOf(ui)).active).toBe('W:WS02')
  await ui.unmount()
})

test('command -v fab only looks the CLI up, so the pane does not say Claude is working', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  let drawn = ''
  onTool = async () => {
    drawn = JSON.stringify(await ui.drawn())
  }
  await $.tool.call({ tool: 'Bash', command: 'command -v fab' } as any)
  onTool = null
  expect(drawn).not.toContain('Claude is working in Fabric')
  await ui.unmount()
})

const clientOf = (n: any, key: string): any => (n?.type === 'Client' && n.props?.key === key ? n : (n?.children ?? []).map((c: any) => clientOf(c, key)).find(Boolean))

async function workSample(ui: any) {
  await ui.redraw()
  const drawn = await ui.drawn()
  const working = clientOf(drawn, 'working')?.props.props.rows[0]?.left[0]
  const rows = clientOf(drawn, 'rows')?.props.props.rows ?? []
  const shimmer = [...new Set(rows.flatMap((r: any) => [...r.left, ...r.right].filter((x: any) => x.sh).map((x: any) => x.sh)))]
  return { text: working?.t === 'Claude is working in Fabric...' ? String(working.sh) : '', shimmer }
}

test('the working text and the row shimmer share one clock: on while the command runs, on through the flash, off together, and a new command restarts them in its tone', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  const ui = await open($, clock, 'terminal')
  await ui.post({ press: 'W:WS00' }, { in: 'rows' })
  await clock.settle()
  const samples: { at: string; text: string; shimmer: unknown[] }[] = []
  const take = async (at: string) => {
    samples.push({ at, ...(await workSample(ui)) })
  }
  onTool = () => take('purple command')
  await $.tool.call({ tool: 'Bash', command: 'fab get "WS00.Workspace/Sales.SemanticModel" -q definition' } as any)
  await clock.advance(50)
  await take('purple flash')
  onTool = () => take('teal command')
  await $.tool.call({ tool: 'Bash', command: 'fab export "WS00.Workspace/Sales.Report" -o ./out -f' } as any)
  await clock.advance(50)
  await take('teal flash')
  await clock.advance(3000)
  await take('after flash')
  toolResult = { result: { stdout: '', stderr: 'boom' }, isError: true }
  onTool = () => take('failing command')
  await $.tool.call({ tool: 'Bash', command: 'fab set "WS00.Workspace/Sales.Report" -q description -i x -f' } as any)
  onTool = null
  toolResult = null
  await clock.advance(50)
  await take('after failing command')
  expect(samples.map(x => `${x.at}: ${x.text || 'none'} / ${x.shimmer.join(',') || 'none'}`)).toEqual([
    'purple command: purple / purple',
    'purple flash: purple / purple',
    'teal command: teal / teal',
    'teal flash: teal / teal',
    'after flash: none / none',
    'failing command: orange / orange',
    'after failing command: none / none',
  ])
  await ui.unmount()
})

const ICON = '<icon> '
const COPY_MISSING = [
  '<icon> Fabric CLI not found',
  'This pane needs the Fabric CLI (fab).',
  '',
  '<icon> Install it',
  'uv tool install ms-fabric-cli',
  'No uv yet? brew install uv or winget install uv',
  '',
  '<icon> Then sign in',
  'fab auth login',
  '',
  "Press ↻ when you're done. Or ask Claude to set it up for you.",
]
const COPY_SIGNED_OUT = ['<icon> Not signed in to Fabric', 'fab auth login', '', "Press ↻ when you're done. To check which account you use: fab auth status"]
const NET_ERROR = "An unexpected error occurred: HTTPSConnectionPool(host='api.fabric.microsoft.com', port=443): Read timed out"
const COPY_UNREACHABLE = ["<icon> Can't reach Fabric", NET_ERROR, 'Check your network or proxy, then press ↻.']

const fabJson = (message: string, code: string) => JSON.stringify({ timestamp: '2026-01-01T00:00:00Z', status: 'Failure', command: 'ls', result: { message, error_code: code } }, null, 4)
const fabFailure = (exitCode: number, message: string, code: string) => ({ value: { exitCode, stdout: fabJson(message, code), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })

async function openWide($: any, clock: any, columns = 120) {
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  await $.command.run({ command: PANE, args: '', origin: { kind: 'person' } } as any)
  await clock.settle()
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: { ...paneProps(40), bodyColumns: columns } })
  await clock.settle()
  return ui
}

async function setupLines(ui: any, expected: string[]) {
  const all = clientOf(await ui.drawn(), 'setup')?.props.props.rows
  if (!all) return { rows: undefined, lines: [] as string[] }
  const text = (r: any) => r.left.map((x: any) => x.t).join('').trim()
  expect(text(all[0])).toBe('')
  const rows = all.slice(1).map((r: any) => ({ ...r, left: r.left.filter((x: any, i: number) => i > 0 || x.t.trim()) }))
  const lines = rows.map((r: any) => r.left.map((x: any) => x.t).join('').trim())
  return { rows, lines: lines.map((l: string, i: number) => (expected[i]?.startsWith(ICON) ? l.replace(/^\S+ /, ICON) : l)) }
}

test('onboarding: a missing fab shows the install steps word for word, commands copy on click, and it goes away once Claude gets fab listing', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock, copied } = world(on, { HOME: '/home/k' }, ran)
  fabFail = () => ({ deny: 'spawn fab ENOENT' })
  const ui = await openWide($, clock)
  const { rows, lines } = await setupLines(ui, COPY_MISSING)
  expect(lines).toEqual(COPY_MISSING)
  expect(clientOf(await ui.drawn(), 'rows')).toBeUndefined()
  expect(JSON.stringify(await ui.drawn())).not.toContain('nothing loaded yet')
  expect(JSON.stringify(await ui.drawn())).not.toMatch(NERD)
  const install = rows.find((r: any) => r.id === 'copy:uv tool install ms-fabric-cli')
  expect(install.left.map((x: any) => x.c)).toEqual(['#7dd3fc'])
  expect(rows[0].left[1].b).toBe(true)
  await ui.post({ press: 'copy:uv tool install ms-fabric-cli' }, { in: 'setup' })
  await ui.post({ tab: 'copy:brew install uv' }, { in: 'setup' })
  await clock.settle()
  expect(copied).toEqual(['uv tool install ms-fabric-cli', 'brew install uv'])
  expect(toasts.at(-1)).toBe('Copied brew install uv')
  fabFail = null
  await $.tool.call({ tool: 'Bash', command: 'fab ls "WS00.Workspace"' } as any)
  await clock.settle()
  expect(clientOf(await ui.drawn(), 'setup')).toBeUndefined()
  expect((await rowsOf(ui)).rows.map((r: any) => r.id)).toContain('W:WS00')
  await ui.unmount()
})

test('onboarding: signed out shows the sign-in copy word for word with Nerd glyphs, and pressing refresh after signing in brings the workspaces back', { timeoutMs: 20_000, options: { glyphs: 'nerd' } } as any, async ($: any, on: any) => {
  const ran: Ran = []
  const { clock, copied } = world(on, { HOME: '/home/k' }, ran)
  fabFail = argv => (argv[1] === 'ls' ? fabFailure(1, 'Failed to get access token', 'AuthenticationFailed') : null)
  const ui = await openWide($, clock)
  const { rows, lines } = await setupLines(ui, COPY_SIGNED_OUT)
  expect(lines).toEqual(COPY_SIGNED_OUT)
  expect(rows[0].left[0].t).toMatch(NERD)
  expect(JSON.stringify(await ui.drawn())).not.toContain('error:')
  await ui.post({ tab: 'copy:fab auth status' }, { in: 'setup' })
  await clock.settle()
  expect(copied).toEqual(['fab auth status'])
  await ui.press({ key: 'refresh' })
  await clock.settle()
  expect((await setupLines(ui, COPY_SIGNED_OUT)).lines).toEqual(COPY_SIGNED_OUT)
  fabFail = null
  await ui.post({ tab: 'refresh' }, { in: 'setup' })
  await clock.settle()
  expect(clientOf(await ui.drawn(), 'setup')).toBeUndefined()
  expect((await rowsOf(ui)).rows.map((r: any) => r.id)).toContain('W:WS00')
  await ui.unmount()
})

test('onboarding: an unreachable service shows the first line of the CLI error, wraps in a narrow pane, and clears on refresh', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  fabFail = argv => (argv[1] === 'ls' ? fabFailure(1, NET_ERROR, 'UnexpectedError') : null)
  const ui = await openWide($, clock)
  expect((await setupLines(ui, COPY_UNREACHABLE)).lines).toEqual(COPY_UNREACHABLE)
  await ui.unmount()
  const narrow = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: { ...paneProps(40), bodyColumns: 30 } })
  await clock.settle()
  const rows = clientOf(await narrow.drawn(), 'setup')?.props.props.rows ?? []
  const texts = rows.map((r: any) => r.left.map((x: any) => x.t).join(''))
  expect(texts.every((t: string) => [...t.trimEnd()].length <= 30)).toBe(true)
  expect(texts.join(' ').replace(/\s+/g, ' ')).toContain('Check your network or proxy, then press ↻.')
  fabFail = null
  await narrow.press({ key: 'refresh' })
  await clock.settle()
  expect(clientOf(await narrow.drawn(), 'setup')).toBeUndefined()
  expect((await rowsOf(narrow)).rows.map((r: any) => r.id)).toContain('W:WS00')
  await narrow.unmount()
})

test('onboarding: any other listing failure keeps the error line and the tree view', { timeoutMs: 20_000 }, async ($, on) => {
  const ran: Ran = []
  const { clock } = world(on, { HOME: '/home/k' }, ran)
  fabFail = argv => (argv[1] === 'ls' && argv[2] === '/' ? fabFailure(1, 'Access is forbidden. You do not have permission to access this resource', 'Forbidden') : null)
  const ui = await openWide($, clock)
  const drawn = JSON.stringify(await ui.drawn())
  expect(drawn).toContain('error: Access is forbidden. You do not have permission to access this resource')
  expect(clientOf(await ui.drawn(), 'setup')).toBeUndefined()
  expect(clientOf(await ui.drawn(), 'rows')).toBeDefined()
  fabFail = null
  await ui.press({ key: 'refresh' })
  await clock.settle()
  expect(JSON.stringify(await ui.drawn())).not.toContain('error:')
  expect((await rowsOf(ui)).rows.map((r: any) => r.id)).toContain('W:WS00')
  await ui.unmount()
})

test('fab failures classify as missing, signed out, unreachable or other', { timeoutMs: 5_000 }, async () => {
  const run = (exitCode: number, stdout: string, stderr = '') => runFailure({ exitCode, stdout, stderr }, 'fab ls failed').kind
  expect(spawnFailure(new Error('spawn fab ENOENT'), 'fab').kind).toBe('missing')
  expect(spawnFailure(new Error('command timed out after 60000 ms'), 'fab').kind).toBe('unreachable')
  expect(run(127, '', 'sh: fab: command not found')).toBe('missing')
  expect(run(4, fabJson('Access is unauthorized', 'Unauthorized'))).toBe('signed-out')
  expect(run(1, fabJson('Failed to get access token', 'AuthenticationFailed'))).toBe('signed-out')
  expect(run(1, fabJson('Failed to get access token: Something went wrong while trying to acquire a token. Please try to run `fab auth logout` and then `fab auth login` to re-login and acquire new tokens', 'AuthenticationFailed'))).toBe('signed-out')
  expect(run(1, fabJson('Authentication credential is missing. Either FAB_SPN_CLIENT_SECRET, FAB_SPN_CERT_PATH or FAB_SPN_FEDERATED_TOKEN must be set', 'AuthenticationFailed'))).toBe('signed-out')
  expect(run(1, '', 'ERROR: token expired, please sign in again')).toBe('signed-out')
  expect(run(1, fabJson("An unexpected error occurred: HTTPSConnectionPool(host='api.fabric.microsoft.com', port=443): Max retries exceeded with url: /v1/workspaces (Caused by NameResolutionError(\"Failed to resolve 'api.fabric.microsoft.com'\"))", 'UnexpectedError'))).toBe('unreachable')
  expect(run(1, fabJson("An unexpected error occurred: HTTPSConnectionPool(host='api.fabric.microsoft.com', port=443): Max retries exceeded with url: /v1/workspaces (Caused by ProxyError('Unable to connect to proxy', OSError('Tunnel connection failed: 407 Proxy Authentication Required')))", 'UnexpectedError'))).toBe('unreachable')
  expect(run(1, '', 'ConnectionResetError: [Errno 104] Connection reset by peer')).toBe('unreachable')
  expect(run(1, fabJson('Access is forbidden. You do not have permission to access this resource', 'Forbidden'))).toBe('')
  expect(runFailure({ exitCode: 1, stdout: fabJson('Access is forbidden', 'Forbidden'), stderr: '' }, 'fab ls failed').message).toBe('Access is forbidden')
})
