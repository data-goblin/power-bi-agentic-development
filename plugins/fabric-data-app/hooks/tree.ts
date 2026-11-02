import type { FileNode, FileTree, Theme } from '../types'
import { stronger } from './icons'

export type Entry = { name: string; kind: 'file' | 'dir' | 'other'; mtimeMs: number; isLink: boolean }
export type Row = { node: FileNode; depth: number; open: boolean }

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

export const DEFAULT_THEME: Theme = {
  fg: '',
  accent: '#5b9bd5',
  muted: '',
  urgent: '#d0605e',
  selection: '#3e4451',
}

export function emptyTree(root: string): FileTree {
  return {
    root,
    nodes: [],
    expanded: [],
    cursor: '',
    selected: '',
    query: '',
    showHidden: true,
    git: {},
    ignored: [],
    untrackedDirs: [],
    diff: {},
    counts: {},
    status: '',
    flash: [],
    flashDim: [],
    flashOn: false,
    flashTones: {},
    scroll: null,
    top: '',
    work: null,
  }
}

export function parseTheme(toml: string): Theme {
  const get = (k: string) => toml.match(new RegExp(`^${k}\\s*=\\s*"(#[0-9a-fA-F]{6})"`, 'm'))?.[1]
  return {
    fg: get('foreground') ?? get('color7') ?? DEFAULT_THEME.fg,
    accent: get('accent') ?? get('color4') ?? DEFAULT_THEME.accent,
    muted: get('muted') ?? DEFAULT_THEME.muted,
    urgent: get('red') ?? get('color1') ?? DEFAULT_THEME.urgent,
    selection: get('selection') ?? DEFAULT_THEME.selection,
  }
}

export function join(dir: string, name: string): string {
  return dir.endsWith('/') ? dir + name : `${dir}/${name}`
}

let drives = false

export function dirname(path: string): string {
  if (drives && /^[A-Za-z]:\/[^/]*$/.test(path)) return path.slice(0, 3)
  const i = path.lastIndexOf('/')
  return i <= 0 ? '/' : path.slice(0, i)
}

export function useDrives(on: boolean): void {
  drives = on
}

export function posix(path: string): string {
  if (!drives) return path
  return path.replace(/\\/g, '/').replace(/^\/([A-Za-z])(\/|$)/, (_, d: string) => `${d.toUpperCase()}:/`)
}

export function isAbsolute(path: string): boolean {
  return path.startsWith('/') || (drives && /^[A-Za-z]:\//.test(path))
}

export function resolvePath(base: string, path: string): string {
  const p = posix(path)
  const abs = isAbsolute(p) ? p : join(base, p)
  const head = (drives ? abs.match(/^[A-Za-z]:\//)?.[0] : undefined) ?? '/'
  const parts: string[] = []
  for (const seg of abs.slice(head.length).split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') parts.pop()
    else parts.push(seg)
  }
  return head + parts.join('/')
}

export function toNodes(dir: string, list: Entry[]): FileNode[] {
  return list
    .map(e => ({
      id: join(dir, e.name),
      parent: dir,
      name: e.name,
      kind: e.isLink ? ('link' as const) : e.kind === 'dir' ? ('dir' as const) : ('file' as const),
      hidden: e.name.startsWith('.'),
      mtime: e.mtimeMs,
      loaded: false,
    }))
    .sort((a, b) => (a.kind === 'dir' ? 0 : 1) - (b.kind === 'dir' ? 0 : 1) || collator.compare(a.name, b.name))
}

function under(id: string, set: Set<string>): boolean {
  for (let i = id.lastIndexOf('/'); i > 0; i = id.lastIndexOf('/', i - 1)) if (set.has(id.slice(0, i))) return true
  return false
}

export function replaceChildren(nodes: FileNode[], listed: Map<string, FileNode[]>): FileNode[] {
  if (listed.size === 0) return nodes
  const keep = new Map<string, FileNode>()
  for (const n of nodes) if (listed.has(n.parent)) keep.set(n.id, n)
  const fresh: FileNode[] = []
  for (const kids of listed.values())
    for (const k of kids) {
      const old = keep.get(k.id)
      fresh.push(old && old.kind === 'dir' && k.kind === 'dir' ? { ...k, loaded: old.loaded } : k)
    }
  const freshIds = new Set(fresh.map(k => k.id))
  const gone = new Set([...keep.keys()].filter(id => !freshIds.has(id)))
  const out: FileNode[] = []
  for (const n of nodes) {
    if (listed.has(n.parent) || (gone.size > 0 && under(n.id, gone))) continue
    out.push(listed.has(n.id) ? { ...n, loaded: true } : n)
  }
  const taken = new Set(out.map(n => n.id))
  return [...out, ...fresh.filter(k => !taken.has(k.id) && !(gone.size > 0 && under(k.id, gone)))]
}

export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i] as T)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

export type GitStatus = {
  git: Record<string, string>
  ignored: string[]
  untrackedDirs: string[]
  files: Record<string, Change>
}

export type Change = 'new' | 'mod' | 'del'

export function mapper(root: string, prefix: string): (rel: string) => string | null {
  return rel => (rel.startsWith(prefix) ? join(root, rel.slice(prefix.length).replace(/\/$/, '')).replace(/\/$/, '') : null)
}

export function parseGit(stdout: string, root: string, prefix: string): GitStatus {
  const map = mapper(root, prefix)
  const git: Record<string, string> = {}
  const ignored: string[] = []
  const untrackedDirs: string[] = []
  const files: Record<string, Change> = {}
  const parts = stdout.split('\0')
  for (let i = 0; i < parts.length; i++) {
    const rec = parts[i] ?? ''
    if (rec.length < 4) continue
    const xy = rec.slice(0, 2)
    const raw = rec.slice(3)
    if (xy[0] === 'R' || xy[0] === 'C') i++
    const path = map(raw)
    if (!path) continue
    if (xy === '!!') {
      ignored.push(path)
      continue
    }
    if (xy === '??' && raw.endsWith('/')) untrackedDirs.push(path)
    else files[path] = xy === '??' || (xy.includes('A') && !xy.includes('D')) ? 'new' : xy.includes('D') && !/U/.test(xy) ? 'del' : 'mod'
    const letter =
      xy === '??'
        ? '?'
        : /U/.test(xy) || xy === 'AA' || xy === 'DD'
          ? 'U'
          : (['D', 'M', 'R', 'C', 'A', 'T'].find(c => xy.includes(c)) ?? '')
    if (!letter) continue
    git[path] = stronger(git[path], letter)
    let dir = dirname(path)
    while (dir.length >= root.length && dir !== '/') {
      git[dir] = stronger(git[dir], letter)
      if (dir === root) break
      dir = dirname(dir)
    }
  }
  return { git, ignored, untrackedDirs, files }
}

export function parseNumstat(stdout: string, root: string, prefix: string, into: Record<string, [number, number]>): void {
  const map = mapper(root, prefix)
  const parts = stdout.split('\0')
  for (let i = 0; i < parts.length; i++) {
    const rec = parts[i] ?? ''
    if (!rec) continue
    const m = rec.match(/^(-|\d+)\t(-|\d+)\t(.*)$/s)
    if (!m) continue
    let path = m[3] ?? ''
    if (path === '') {
      i += 2
      path = parts[i] ?? ''
    }
    if (!path) continue
    const add = m[1] === '-' ? 0 : Number(m[1])
    const del = m[2] === '-' ? 0 : Number(m[2])
    const abs = map(path)
    if (!abs) continue
    const prev = into[abs] ?? [0, 0]
    into[abs] = [prev[0] + add, prev[1] + del]
  }
}

export function rollUp(diff: Record<string, [number, number]>, root: string): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = { ...diff }
  for (const [path, [add, del]] of Object.entries(diff)) {
    let dir = dirname(path)
    while (dir.length >= root.length && dir !== '/') {
      const prev = out[dir] ?? [0, 0]
      out[dir] = [prev[0] + add, prev[1] + del]
      if (dir === root) break
      dir = dirname(dir)
    }
  }
  return out
}

export function rollCounts(files: Record<string, Change>, root: string): Record<string, [number, number, number]> {
  const out: Record<string, [number, number, number]> = {}
  const slot = { new: 0, mod: 1, del: 2 } as const
  for (const [path, change] of Object.entries(files)) {
    let dir = dirname(path)
    while (dir.length >= root.length && dir !== '/') {
      const cur = out[dir] ?? [0, 0, 0]
      cur[slot[change]] += 1
      out[dir] = cur
      if (dir === root) break
      dir = dirname(dir)
    }
  }
  return out
}

export function underAny(id: string, set: Set<string>, root: string): boolean {
  if (set.size === 0) return false
  let cur = id
  while (cur.length >= root.length) {
    if (set.has(cur)) return true
    const up = dirname(cur)
    if (up === cur) break
    cur = up
  }
  return false
}

export function inside(root: string, path: string): boolean {
  return path === root || path.startsWith(root.endsWith('/') ? root : `${root}/`)
}

export function ancestorsOf(id: string, root: string): string[] {
  const out: string[] = []
  if (!root) return out
  for (let dir = dirname(id), prev = id; dir !== prev && dir !== root && inside(root, dir); prev = dir, dir = dirname(dir)) out.push(dir)
  return out
}

export function visibleRows(t: FileTree, top = ''): Row[] {
  const kids = new Map<string, FileNode[]>()
  for (const n of t.nodes) {
    if (!t.showHidden && n.hidden) continue
    const list = kids.get(n.parent)
    if (list) list.push(n)
    else kids.set(n.parent, [n])
  }
  const q = t.query.trim().toLowerCase()
  let keep: Set<string> | null = null
  if (q) {
    keep = new Set()
    for (const n of t.nodes) {
      if (!n.name.toLowerCase().includes(q)) continue
      keep.add(n.id)
      for (const a of ancestorsOf(n.id, t.root)) keep.add(a)
    }
  }
  const open = new Set(t.expanded)
  const rows: Row[] = []
  const walk = (dir: string, depth: number) => {
    for (const n of kids.get(dir) ?? []) {
      if (keep && !keep.has(n.id)) continue
      const isOpen = n.kind === 'dir' && (keep ? kids.has(n.id) : open.has(n.id))
      rows.push({ node: n, depth, open: isOpen })
      if (isOpen) walk(n.id, depth + 1)
    }
  }
  walk(top || t.root, 0)
  return rows
}

export function stamp(ms: number): string {
  if (!ms) return ''
  const d = new Date(ms)
  const p = (v: number) => String(v).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
