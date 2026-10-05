import type { TreeNode } from '../types'

export const PLACEHOLDER = 'placeholder'

export const SECTIONS = [
  { id: 'S:workspace', name: 'Workspace', kind: 'section-workspace' },
  { id: 'S:catalog', name: 'Catalog', kind: 'section-catalog' },
  { id: 'S:compute', name: 'Compute', kind: 'section-compute' },
  { id: 'S:jobs', name: 'Jobs', kind: 'section-jobs' },
  { id: 'S:pipelines', name: 'Pipelines', kind: 'section-pipelines' },
  { id: 'S:apps', name: 'Apps', kind: 'section-apps' },
  { id: 'S:dashboards', name: 'Dashboards', kind: 'section-dashboards' },
] as const

type Rec = Record<string, unknown>

function node(id: string, parent: string, kind: string, name: string, path: string, extra: Partial<TreeNode> = {}): TreeNode {
  return { id, parent, kind, name, path, hidden: false, sig: '', note: '', ...extra }
}

export function stub(parent: string): TreeNode {
  return node(`${parent}/…`, parent, PLACEHOLDER, 'loading…', '')
}

export function roots(): TreeNode[] {
  return SECTIONS.flatMap(s => [node(s.id, '', s.kind, s.name, ''), stub(s.id)])
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : ''
}

function at(rec: Rec, ...keys: string[]): string {
  let cur: unknown = rec
  for (const k of keys) cur = cur && typeof cur === 'object' ? (cur as Rec)[k] : undefined
  return str(cur)
}

export function records(stdout: string): Rec[] {
  const start = stdout.search(/[[{]/)
  if (start < 0) return []
  const parsed: unknown = JSON.parse(stdout.slice(start))
  const list = Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' ? Object.values(parsed).find(Array.isArray) : undefined
  return (list ?? []).filter((r): r is Rec => Boolean(r) && typeof r === 'object')
}

export function listCalls(n: TreeNode): string[][] {
  const [cat = '', sch = ''] = n.path.split('.')
  switch (n.kind) {
    case 'section-workspace':
      return [['workspace', 'list', '/']]
    case 'folder':
    case 'repo':
      return [['workspace', 'list', n.path]]
    case 'section-catalog':
      return [['catalogs', 'list']]
    case 'catalog':
      return [['schemas', 'list', cat]]
    case 'schema':
      return [
        ['tables', 'list', cat, sch, '--omit-columns', '--omit-properties', '--omit-username'],
        ['volumes', 'list', cat, sch],
      ]
    case 'section-compute':
      return [['clusters', 'list'], ['warehouses', 'list']]
    case 'section-jobs':
      return [['jobs', 'list']]
    case 'section-pipelines':
      return [['pipelines', 'list-pipelines']]
    case 'section-apps':
      return [['apps', 'list']]
    case 'section-dashboards':
      return [['lakeview', 'list']]
    default:
      return []
  }
}

const OBJECT_KIND: Record<string, string> = { DIRECTORY: 'folder', NOTEBOOK: 'notebook', FILE: 'file', REPO: 'repo', DASHBOARD: 'dashboard', LIBRARY: 'library' }

function base(path: string): string {
  return path.replace(/\/+$/, '').split('/').pop() || path
}

export function children(n: TreeNode, outputs: string[], host: string): TreeNode[] {
  const out: TreeNode[] = []
  const push = (child: TreeNode, open: boolean) => {
    child.url = urlFor(child, host)
    out.push(child)
    if (open) out.push(stub(child.id))
  }
  const [o0 = '', o1 = ''] = outputs
  switch (n.kind) {
    case 'section-workspace':
    case 'folder':
    case 'repo':
      for (const r of records(o0)) {
        const path = at(r, 'path')
        if (!path) continue
        const kind = OBJECT_KIND[at(r, 'object_type')] ?? 'file'
        push(node(`WS:${path}`, n.id, kind, base(path), path, { sig: at(r, 'object_id'), note: kind === 'notebook' ? at(r, 'language').toLowerCase() : '' }), kind === 'folder' || kind === 'repo')
        const dash = kind === 'dashboard' ? at(r, 'resource_id') : ''
        const made = out[out.length - 1]
        if (made && host) made.url = dash ? `${host}/dashboardsv3/${encodeURIComponent(dash)}/published` : kind === 'dashboard' ? `${host}/#workspace${path.split('/').map(encodeURIComponent).join('/')}` : made.url
      }
      break
    case 'section-catalog':
      for (const r of records(o0)) {
        const name = at(r, 'name')
        if (name) push(node(`UC:${name}`, n.id, 'catalog', name, name, { sig: at(r, 'created_at'), note: at(r, 'catalog_type').toLowerCase().replace(/_catalog$/, '') }), true)
      }
      break
    case 'catalog':
      for (const r of records(o0)) {
        const name = at(r, 'name')
        if (name) push(node(`UC:${n.path}.${name}`, n.id, 'schema', name, at(r, 'full_name') || `${n.path}.${name}`, { sig: at(r, 'created_at') }), true)
      }
      break
    case 'schema':
      for (const r of records(o0)) {
        const name = at(r, 'name')
        const type = at(r, 'table_type')
        const kind = type === 'METRIC_VIEW' ? 'metric_view' : type === 'MATERIALIZED_VIEW' ? 'materialized_view' : type === 'STREAMING_TABLE' ? 'streaming_table' : type === 'VIEW' ? 'view' : 'table'
        if (name) push(node(`UC:${n.path}.${name}`, n.id, kind, name, at(r, 'full_name') || `${n.path}.${name}`, { note: type.toLowerCase().replace(/_/g, ' ') }), false)
      }
      for (const r of records(o1)) {
        const name = at(r, 'name')
        if (name) push(node(`UV:${n.path}.${name}`, n.id, 'volume', name, at(r, 'full_name') || `${n.path}.${name}`, { note: 'volume' }), false)
      }
      break
    case 'section-compute':
      for (const r of records(o0)) {
        const id = at(r, 'cluster_id')
        if (id) push(node(`CL:${id}`, n.id, 'cluster', at(r, 'cluster_name') || id, id, { note: at(r, 'state').toLowerCase() }), false)
      }
      for (const r of records(o1)) {
        const id = at(r, 'id')
        if (id) push(node(`SW:${id}`, n.id, 'warehouse', at(r, 'name') || id, id, { note: at(r, 'state').toLowerCase() }), false)
      }
      break
    case 'section-jobs':
      for (const r of records(o0)) {
        const id = at(r, 'job_id')
        if (id) push(node(`J:${id}`, n.id, 'job', at(r, 'settings', 'name') || id, id), false)
      }
      break
    case 'section-pipelines':
      for (const r of records(o0)) {
        const id = at(r, 'pipeline_id')
        if (id) push(node(`P:${id}`, n.id, 'pipeline', at(r, 'name') || id, id, { note: at(r, 'state').toLowerCase() }), false)
      }
      break
    case 'section-apps':
      for (const r of records(o0)) {
        const name = at(r, 'name')
        if (name) push(node(`A:${name}`, n.id, 'app', name, name, { note: (at(r, 'app_status', 'state') || at(r, 'compute_status', 'state')).toLowerCase() }), false)
      }
      break
    case 'section-dashboards':
      for (const r of records(o0)) {
        const id = at(r, 'dashboard_id')
        if (id) push(node(`D:${id}`, n.id, 'dashboard', at(r, 'display_name') || id, id), false)
      }
      break
  }
  return out
}

export function urlFor(n: TreeNode, host: string): string {
  if (!host) return ''
  const [c = '', s = '', t = ''] = n.path.split('.')
  const enc = (v: string) => encodeURIComponent(v)
  switch (n.kind) {
    case 'folder':
    case 'notebook':
    case 'file':
    case 'repo':
    case 'library':
      return `${host}/#workspace${n.path.split('/').map(enc).join('/')}`
    case 'catalog':
      return `${host}/explore/data/${enc(c)}`
    case 'schema':
      return `${host}/explore/data/${enc(c)}/${enc(s)}`
    case 'table':
    case 'view':
    case 'metric_view':
    case 'materialized_view':
    case 'streaming_table':
      return `${host}/explore/data/${enc(c)}/${enc(s)}/${enc(t)}`
    case 'volume':
      return `${host}/explore/data/volumes/${enc(c)}/${enc(s)}/${enc(t)}`
    case 'cluster':
      return `${host}/compute/clusters/${enc(n.path)}`
    case 'warehouse':
      return `${host}/sql/warehouses/${enc(n.path)}`
    case 'job':
      return `${host}/jobs/${enc(n.path)}`
    case 'pipeline':
      return `${host}/pipelines/${enc(n.path)}`
    case 'app':
      return `${host}/apps/${enc(n.path)}`
    case 'dashboard':
      return `${host}/dashboardsv3/${enc(n.path)}/published`
    default:
      return host
  }
}

export function chainOf(id: string): string[] {
  if (id.startsWith('WS:')) {
    const parts = id.slice(3).split('/').filter(Boolean)
    return ['S:workspace', ...parts.slice(0, -1).map((_, i) => `WS:/${parts.slice(0, i + 1).join('/')}`)]
  }
  if (id.startsWith('UC:') || id.startsWith('UV:')) {
    const parts = id.slice(3).split('.')
    const out = ['S:catalog']
    if (parts.length >= 2) out.push(`UC:${parts[0]}`)
    if (parts.length >= 3) out.push(`UC:${parts[0]}.${parts[1]}`)
    return out
  }
  const prefix = id.split(':')[0]
  const section: Record<string, string> = { CL: 'S:compute', SW: 'S:compute', J: 'S:jobs', P: 'S:pipelines', A: 'S:apps', D: 'S:dashboards' }
  return prefix && section[prefix] ? [section[prefix]] : []
}

export function hostFrom(cfg: string, profile: string): string {
  const want = profile || 'DEFAULT'
  let section = ''
  for (const raw of cfg.split(/\r?\n/)) {
    const line = raw.trim()
    const head = /^\[(.+)\]$/.exec(line)
    if (head) {
      section = head[1]?.trim() ?? ''
      continue
    }
    const kv = /^host\s*=\s*(.+)$/i.exec(line)
    if (kv && section === want) return (kv[1] ?? '').trim().replace(/\/+$/, '')
  }
  return ''
}
