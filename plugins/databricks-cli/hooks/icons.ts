import type { TreeNode } from '../types'
import { DB_CODEPOINTS } from './icon-data'

type Rgb = [number, number, number]
type Icon = { db: string; nerd: string; rgb: Rgb; plain: string }
export type Tier = 'databricks' | 'nerd' | 'plain'
export type Glyph = { char: string; color: string | undefined; label?: string; icon: string }

const RED: Rgb = [255, 54, 33]
const SLATE: Rgb = [148, 163, 184]
const ICONS: Record<string, Icon> = {
  'section-workspace': { db: 'ui_workspace', nerd: '\u{f0b9f}', rgb: RED, plain: '▣' },
  'section-catalog': { db: 'ui_catalog_section', nerd: '\u{f05da}', rgb: RED, plain: '▣' },
  'section-compute': { db: 'ui_compute', nerd: '\u{f048b}', rgb: RED, plain: '▣' },
  'section-jobs': { db: 'ui_jobs', nerd: '\u{f0bb4}', rgb: RED, plain: '▣' },
  'section-pipelines': { db: 'pipeline', nerd: '\u{f07e5}', rgb: RED, plain: '▣' },
  'section-apps': { db: 'ui_apps', nerd: '\u{f003b}', rgb: RED, plain: '▣' },
  'section-dashboards': { db: 'ui_dashboard', nerd: '\u{f056e}', rgb: RED, plain: '▣' },
  folder: { db: 'ui_folder', nerd: '\u{f024b}', rgb: [184, 175, 137], plain: '■' },
  repo: { db: 'ui_repo', nerd: '\u{f02a2}', rgb: [240, 80, 50], plain: '⑂' },
  notebook: { db: 'ui_notebook', nerd: '\u{f082e}', rgb: [96, 165, 250], plain: '▤' },
  file: { db: 'file', nerd: '\u{f0214}', rgb: SLATE, plain: '▫' },
  library: { db: 'file_code', nerd: '\u{f03d7}', rgb: SLATE, plain: '▫' },
  dashboard: { db: 'ui_dashboard', nerd: '\u{f056e}', rgb: [251, 191, 36], plain: '▦' },
  catalog: { db: 'ui_catalog', nerd: '\u{f05da}', rgb: [167, 139, 250], plain: '◆' },
  schema: { db: 'ui_schema', nerd: '\u{f01bc}', rgb: [129, 140, 248], plain: '◇' },
  table: { db: 'ui_table', nerd: '\u{f04eb}', rgb: [74, 222, 128], plain: '▦' },
  view: { db: 'view', nerd: '\u{f0208}', rgb: [45, 212, 191], plain: '▧' },
  materialized_view: { db: 'materialized_view', nerd: '\u{f0208}', rgb: [45, 212, 191], plain: '▧' },
  streaming_table: { db: 'streaming_table', nerd: '\u{f04eb}', rgb: [52, 211, 153], plain: '▦' },
  metric_view: { db: 'ui_metric_view', nerd: '\u{f04eb}', rgb: [167, 139, 250], plain: '▦' },
  catalog_system: { db: 'ui_catalog_system', nerd: '\u{f05da}', rgb: [148, 163, 184], plain: '◆' },
  catalog_shared: { db: 'ui_catalog_shared', nerd: '\u{f05da}', rgb: [45, 212, 191], plain: '◆' },
  catalog_workspace: { db: 'ui_catalog_workspace', nerd: '\u{f05da}', rgb: [167, 139, 250], plain: '◆' },
  folder_users: { db: 'ui_folder_users', nerd: '\u{f0849}', rgb: [184, 175, 137], plain: '■' },
  folder_shared: { db: 'ui_folder_shared', nerd: '\u{f024b}', rgb: [184, 175, 137], plain: '■' },
  volume: { db: 'volume', nerd: '\u{f02ca}', rgb: [251, 146, 60], plain: '◎' },
  cluster: { db: 'ui_compute', nerd: '\u{f048b}', rgb: [56, 189, 248], plain: '◉' },
  warehouse: { db: 'ui_warehouse', nerd: '\u{f140b}', rgb: [250, 204, 21], plain: '◉' },
  job: { db: 'ui_jobs', nerd: '\u{f0bb4}', rgb: [244, 114, 182], plain: '▶' },
  pipeline: { db: 'pipeline', nerd: '\u{f07e5}', rgb: [52, 211, 153], plain: '⇶' },
  app: { db: 'ui_apps', nerd: '\u{f003b}', rgb: [251, 113, 133], plain: '◈' },
  placeholder: { db: '', nerd: '\u{f0453}', rgb: [110, 110, 122], plain: '…' },
  empty: { db: '', nerd: '∅', rgb: [110, 110, 122], plain: '∅' },
}
const FALLBACK: Icon = { db: 'file', nerd: '\u{f0214}', rgb: SLATE, plain: '▫' }

const hex = (c: Rgb) => `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`

function variant(n: TreeNode): string {
  if (n.kind === 'catalog') return n.note === 'system' && n.name === 'system' ? 'catalog_system' : n.note === 'system' || n.note === 'deltasharing' ? 'catalog_shared' : n.name === 'workspace' ? 'catalog_workspace' : 'catalog'
  if (n.kind === 'folder' && n.path === '/Users') return 'folder_users'
  if (n.kind === 'folder' && n.path === '/Shared') return 'folder_shared'
  return n.kind
}

export function glyph(n: TreeNode, tier: Tier): Glyph {
  const key = ICONS[variant(n)] ? variant(n) : ICONS[n.kind] ? n.kind : 'file'
  const icon = ICONS[key] ?? FALLBACK
  const cp = DB_CODEPOINTS[icon.db]
  const char = tier === 'databricks' && cp ? String.fromCodePoint(cp) : tier === 'plain' ? icon.plain : icon.nerd
  return { char, color: hex(icon.rgb), icon: key }
}

export function titleGlyph(tier: Tier): string {
  const cp = DB_CODEPOINTS.ui_logo
  return tier === 'databricks' && cp ? String.fromCodePoint(cp) : tier === 'plain' ? '◈' : '\u{f0b9f}'
}
