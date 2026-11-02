import type { AppInfo, Source } from '../types'
import { CONNECTOR_KIND, KIND_LABEL } from './glyphs'

const PORTAL = 'https://app.fabric.microsoft.com'
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type Cli = {
  name: string
  commands: string[]
  packages: string[]
  mutating: string[]
  deploy: string[]
  marker: string
  inputs: string[]
  start: string
  skills: string[]
  read: (dir: string, text: (rel: string) => Promise<string>) => Promise<AppInfo>
}

export function yamlScalar(raw: string): string {
  const v = raw.trim()
  const quoted = v.match(/^"((?:[^"\\]|\\.)*)"|^'((?:[^']|'')*)'/)
  if (quoted) return quoted[1] !== undefined ? quoted[1].replace(/\\(.)/g, '$1') : (quoted[2] ?? '').replace(/''/g, "'")
  return v.replace(/(^|\s+)#.*$/, '').trim()
}

export function portalUrl(workspace: string, item: string): string {
  return GUID.test(workspace) && GUID.test(item) ? `${PORTAL}/groups/${workspace}/appbackends/${item}` : ''
}

const ITEM_ROUTE: Record<string, string> = {
  SemanticModel: 'datasets',
  Lakehouse: 'lakehouses',
  Warehouse: 'datawarehouses',
  SQLEndpoint: 'lakewarehouses',
  SQLDatabase: 'sqldatabases',
  KQLDatabase: 'databases',
  UserDataFunction: 'userdatafunctions',
  AppBackend: 'appbackends',
}

export function itemUrl(workspace: string, type: string, item: string, tenant = ''): string {
  const route = ITEM_ROUTE[type]
  if (!route || !GUID.test(workspace) || !GUID.test(item)) return ''
  const tail = type === 'SemanticModel' ? '/details' : ''
  return `${PORTAL}/groups/${workspace}/${route}/${item}${tail}${GUID.test(tenant) ? `?ctid=${tenant}` : ''}`
}

export function merge(a: AppInfo, b: AppInfo): AppInfo {
  return {
    ...a,
    key: a.key || b.key,
    title: b.title !== b.name ? b.title : a.title,
    cli: a.cli === b.cli ? a.cli : `${a.cli}+${b.cli}`,
    tenant: a.tenant || b.tenant,
    workspace: a.workspace || b.workspace,
    item: a.item || b.item,
    portal: a.portal || b.portal,
    hosting: a.hosting || b.hosting,
    error: [a.error, b.error].filter(Boolean).join('; '),
  }
}

export type SourceInputs = {
  fabricYaml: string
  rayfinYml: string
  schemaTs: string
  udfDefs: { folder: string; text: string }[]
  tsFunctions: string[]
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length
}

function yamlSection(yaml: string, key: string): string[] {
  const lines = yaml.split('\n')
  const start = lines.findIndex(l => new RegExp(`^\\s*${key}:\\s*$`).test(l))
  if (start < 0) return []
  const base = indentOf(lines[start] ?? '')
  const out: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue
    if (indentOf(line) <= base && !line.trimStart().startsWith('- ')) break
    if (indentOf(line) < base) break
    out.push(line)
  }
  return out
}

function fabricYamlModels(yaml: string): Source[] {
  const block = yamlSection(yaml, 'semanticModels')
  if (block.length === 0) return []
  const keyIndent = Math.min(...block.map(indentOf))
  const out: Source[] = []
  for (const l of block) {
    if (indentOf(l) === keyIndent && /^\s*[^\s:]+:\s*$/.test(l)) {
      out.push({ kind: 'SemanticModel', name: l.trim().replace(/:$/, ''), note: 'semantic model' })
      continue
    }
    const item = l.match(/^\s*itemId:\s*["']?([0-9a-fA-F-]{36})/)?.[1]
    const ws = l.match(/^\s*workspaceId:\s*["']?([0-9a-fA-F-]{36})/)?.[1]
    const last = out[out.length - 1]
    if (item && last && !last.item) last.item = item
    if (ws && last && !last.workspace) last.workspace = ws
  }
  return out
}

function rayfinConnectors(yaml: string): Source[] {
  const lines = yaml.split('\n')
  const start = lines.findIndex(l => /^connectors:\s*(#.*)?$/.test(l))
  if (start < 0) return []
  const items: { keys: Record<string, string>; itemId: string; workspaceId: string }[] = []
  let dash = -1
  let keyIndent = -1
  const take = (text: string, indent: number) => {
    const item = items[items.length - 1]
    const kv = text.match(/^([\w-]+):(.*)$/)
    if (!item || !kv?.[1]) return
    const value = yamlScalar(kv[2] ?? '')
    if (indent === keyIndent && !(kv[1] in item.keys)) item.keys[kv[1]] = value
    if (kv[1] === 'itemId' && !item.itemId && /^[0-9a-fA-F-]{36}$/.test(value)) item.itemId = value
    if (kv[1] === 'workspaceId' && !item.workspaceId && /^[0-9a-fA-F-]{36}$/.test(value)) item.workspaceId = value
  }
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue
    if (/^\S/.test(line) && !line.startsWith('-')) break
    const entry = line.match(/^(\s*)-(\s+)(.*)$/)
    if (entry && (dash < 0 || (entry[1] ?? '').length === dash)) {
      dash = (entry[1] ?? '').length
      keyIndent = dash + 1 + (entry[2] ?? '').length
      items.push({ keys: {}, itemId: '', workspaceId: '' })
      take(entry[3] ?? '', keyIndent)
      continue
    }
    take(line.trimStart(), indentOf(line))
  }
  return items
    .filter(i => i.keys.name)
    .map(i => {
      const type = i.keys.type ?? ''
      const kind = CONNECTOR_KIND[type] ?? 'table'
      return { kind, name: i.keys.name ?? '', note: KIND_LABEL[kind] ?? type, ...(i.itemId ? { item: i.itemId } : {}), ...(i.workspaceId ? { workspace: i.workspaceId } : {}) }
    })
}

function service(yaml: string, name: string): { enabled: boolean; dialect: string } {
  const block = yamlSection(yaml, name)
  const enabled = block.some(l => /^\s*enabled:\s*true\b/.test(l) && indentOf(l) === Math.min(...block.map(indentOf)))
  const dialect = block.map(l => l.match(/^\s*dialect:\s*["']?([\w-]+)/)?.[1]).find(Boolean) ?? ''
  return { enabled, dialect }
}

function schemaEntities(ts: string): string[] {
  const list = ts.match(/schema\s*=\s*\[([^\]]*)\]/)?.[1] ?? ''
  return list
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

export function parseSources(input: SourceInputs): Source[] {
  const seen = new Set<string>()
  const out: Source[] = []
  const add = (s: Source) => {
    const key = s.item ? `id:${s.item.toLowerCase()}` : `${s.kind}:${s.name.toLowerCase()}`
    if (seen.has(key)) return
    seen.add(key)
    out.push(s)
  }
  for (const s of rayfinConnectors(input.rayfinYml)) add(s)
  for (const s of fabricYamlModels(input.fabricYaml)) add(s)
  for (const def of input.udfDefs) {
    try {
      const parsed = JSON.parse(def.text) as {
        connectedDataSources?: { alias?: string; artifactType?: string }[]
      }
      for (const c of parsed.connectedDataSources ?? []) {
        const kind = c.artifactType && KIND_LABEL[c.artifactType] ? c.artifactType : 'table'
        add({ kind, name: c.alias ?? 'connection', note: `${KIND_LABEL[kind] ?? c.artifactType ?? 'source'} (UDF)` })
      }
    } catch {
      continue
    }
  }
  const data = service(input.rayfinYml, 'data')
  if (data.enabled) {
    const entities = schemaEntities(input.schemaTs)
    add({
      kind: 'SQLDatabase',
      name: 'SQL database',
      note: [data.dialect || 'sql', entities.length ? `${entities.length} table${entities.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(', '),
      children: entities,
    })
  }
  const functions: string[] = [...input.tsFunctions]
  for (const def of input.udfDefs) {
    try {
      const parsed = JSON.parse(def.text) as { functions?: { name?: string }[] }
      for (const f of parsed.functions ?? []) if (f.name) functions.push(f.name)
    } catch {
      continue
    }
  }
  const fnService = service(input.rayfinYml, 'functions')
  if (functions.length || fnService.enabled) {
    add({
      kind: 'UserDataFunction',
      name: 'User data functions',
      note: functions.length ? `${functions.length} function${functions.length === 1 ? '' : 's'}` : 'enabled, none yet',
      children: [...new Set(functions)],
    })
  }
  return out
}
