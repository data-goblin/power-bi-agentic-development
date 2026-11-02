import type { TreeNode } from '../types'
import { FAB_ITEMS, PBIR_CHILDREN, PBIR_VISUALS } from './icon-data'

type Rgb = [number, number, number]
type Icon = { fabric: number; nerd: string; rgb: Rgb | null }
export type Tier = 'fabric' | 'nerd' | 'plain'

const GLYPH_DIM: Rgb = [0x6e, 0x6e, 0x7a]
const CONTAINER: Icon = { fabric: 0xf2609, nerd: '\u{f024b}', rgb: [197, 197, 197] }

const REPORT_NERD: Record<string, string> = {
  page: '\u{f0214}',
  visual: '\u{f154e}',
  reportfilter: '\u{f0232}',
  pagefilter: '\u{f0232}',
  visualfilter: '\u{f0232}',
  bookmark: '\u{f00c0}',
  theme: '\u{f03d8}',
  'data role': '\u{f0d7e}',
  field: '\u{f0835}',
  'ext measure': '\u{f00ec}',
  'theme colors': '\u{f03d8}',
  'theme data colors': '\u{f08b5}',
  'theme text': '\u{f06d6}',
  'text class': '\u{f027f}',
  'theme styles': '\u{f027c}',
  'theme state': '\u{f06c4}',
  'theme card': '\u{f062e}',
  'theme selector': '\u{f062e}',
}

const VISUAL_NERD: Record<string, string> = {
  accessibleTable: '\u{f1094}',
  actionButton: '\u{f12a8}',
  advancedSlicerVisual: '\u{f0570}',
  aiNarratives: '\u{f0674}',
  animatedNumber: '\u{f0199}',
  areaChart: '\u{f0e91}',
  azureMap: '\u{f0352}',
  barChart: '\u{f066c}',
  basicShape: '\u{f14fb}',
  bookmarkNavigator: '\u{f0e15}',
  card: '\u{f03a0}',
  cardVisual: '\u{f0b77}',
  clusteredBarChart: '\u{f066e}',
  clusteredColumnChart: '\u{f0128}',
  columnChart: '\u{f076a}',
  dataQueryVisual: '\u{f0866}',
  debugVisual: '\u{f00e4}',
  decompositionTreeVisual: '\u{f04aa}',
  donutChart: '\u{f07af}',
  filledMap: '\u{f01e7}',
  filterSlicer: '\u{f1aa3}',
  funnel: '\u{f0236}',
  gauge: '\u{f029a}',
  group: '\u{f02c3}',
  groupVisual: '\u{f02c3}',
  heatMap: '\u{f066d}',
  hundredPercentStackedAreaChart: '\u{f076b}',
  hundredPercentStackedBarChart: '\u{f0729}',
  hundredPercentStackedColumnChart: '\u{f056d}',
  image: '\u{f02e9}',
  keyDriversVisual: '\u{f06e8}',
  keyInfluencers: '\u{f06e8}',
  kpi: '\u{f0535}',
  lineChart: '\u{f012a}',
  lineClusteredColumnComboChart: '\u{f081f}',
  lineStackedColumnComboChart: '\u{f1213}',
  listSlicer: '\u{f096a}',
  map: '\u{f034d}',
  matrix: '\u{f121d}',
  multiRowCard: '\u{f0ab7}',
  pageNavigator: '\u{f0bb0}',
  pieChart: '\u{f012b}',
  pivotTable: '\u{f183c}',
  pythonVisual: '\u{f0320}',
  qnaVisual: '\u{f0817}',
  rdlVisual: '\u{f0219}',
  ribbonChart: '\u{f11df}',
  scatterChart: '\u{f0e92}',
  scorecard: '\u{f08c9}',
  scriptVisual: '\u{f07d4}',
  shape: '\u{f0831}',
  shapeMap: '\u{f0560}',
  slicer: '\u{f10e5}',
  stackedAreaChart: '\u{f0127}',
  stackedBarChart: '\u{f066c}',
  stackedColumnChart: '\u{f076a}',
  table: '\u{f04f1}',
  tableEx: '\u{f04eb}',
  textSlicer: '\u{f0eae}',
  textbox: '\u{f0d11}',
  treemap: '\u{f0e94}',
  waterfallChart: '\u{f1918}',
}

const VISUAL_PLAIN: Record<string, string> = {
  accessibleTable: '▧', actionButton: '►', advancedSlicerVisual: '⧉', aiNarratives: '✦', animatedNumber: '№', areaChart: '◢', azureMap: '♁',
  barChart: '▤', basicShape: '○', bookmarkNavigator: '⚐', card: '#', cardVisual: '▭', clusteredBarChart: '≡', clusteredColumnChart: '▆',
  columnChart: '▥', dataQueryVisual: '⊜', debugVisual: '✗', decompositionTreeVisual: '⊢', donutChart: '◎', filledMap: '◍', filterSlicer: '⧨',
  funnel: '▽', gauge: '◠', group: '❐', groupVisual: '❐', heatMap: '▒', hundredPercentStackedAreaChart: '◩', hundredPercentStackedBarChart: '▬',
  hundredPercentStackedColumnChart: '█', image: '⊡', keyDriversVisual: '☼', keyInfluencers: '☼', kpi: '⬈', lineChart: '∿',
  lineClusteredColumnComboChart: '╫', lineStackedColumnComboChart: '╪', listSlicer: '⁝', map: '⌖', matrix: '⧆', multiRowCard: '⊟', pageNavigator: '⇥',
  pieChart: '◔', pivotTable: '⊠', pythonVisual: 'π', qnaVisual: '?', rdlVisual: '⎙', ribbonChart: '≋', scatterChart: '∴', scorecard: '◉',
  scriptVisual: 'ℛ', shape: '◭', shapeMap: '⬠', slicer: '☐', stackedAreaChart: '◿', stackedBarChart: '▤', stackedColumnChart: '▥', table: '▩',
  tableEx: '▦', textSlicer: '⌕', textbox: '¶', treemap: '⊞', waterfallChart: '▟',
}

const ITEM_NERD: Record<string, string> = {
  SemanticModel: '\u{f01bc}',
  Report: '\u{f0219}',
}

const PLAIN: Record<string, string> = {
  report: '▣', 'semantic model': '◆', group: '■', page: '□', visual: '▢', reportfilter: '▿', pagefilter: '▿',
  visualfilter: '▿', bookmark: '⚑', theme: '◐', 'data role': '◫', field: '│', 'ext measure': 'Σ',
  'theme colors': '◐', 'theme data colors': '◐', 'theme text': 'T', 'text class': 'T', 'theme styles': '✎', 'theme state': '*', 'theme card': '◦', 'theme selector': '◦',
}

export type Glyph = { char: string; color: string | undefined; label?: string }

function hex(rgb: Rgb | null): string | undefined {
  return rgb ? '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('') : undefined
}

function pick(icon: Icon, tier: Tier, plain: string): Glyph {
  if (tier === 'plain') return { char: plain, color: hex(icon.rgb) }
  return { char: tier === 'fabric' && icon.fabric ? String.fromCodePoint(icon.fabric) : icon.nerd, color: hex(icon.rgb) }
}

function hls(rgb: Rgb): [number, number, number] {
  const [r, g, b] = rgb.map(v => v / 255) as Rgb
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const range = max - min
  if (range < 1e-6) return [0, l, 0]
  const s = l <= 0.5 ? range / (max + min) : range / (2 - max - min)
  const rc = (max - r) / range
  const gc = (max - g) / range
  const bc = (max - b) / range
  const h = r === max ? bc - gc : g === max ? 2 + rc - bc : 4 + gc - rc
  return [(((h / 6) % 1) + 1) % 1, l, s]
}

function component(m1: number, m2: number, hue: number): number {
  const h = ((hue % 1) + 1) % 1
  if (h < 1 / 6) return m1 + (m2 - m1) * h * 6
  if (h < 0.5) return m2
  if (h < 2 / 3) return m1 + (m2 - m1) * (2 / 3 - h) * 6
  return m1
}

function lift(rgb: Rgb): Rgb {
  const [h, l0, s] = hls(rgb)
  const l = Math.max(l0, 0.62)
  if (s < 1e-6) return [Math.round(l * 255), Math.round(l * 255), Math.round(l * 255)]
  const m2 = l <= 0.5 ? l * (1 + s) : l + s - l * s
  const m1 = 2 * l - m2
  return [h + 1 / 3, h, h - 1 / 3].map(x => Math.round(component(m1, m2, x) * 255)) as Rgb
}

function item(type: string): Icon {
  const hit = FAB_ITEMS[type]
  return { fabric: hit?.[0] ?? 0, nerd: ITEM_NERD[type] ?? '\u{f0214}', rgb: hit?.[1] ? lift(hit[1]) : null }
}

const CUSTOM_VISUAL = /^(.+?)[0-9A-F]{32}$/i

export function visualLabel(type: string): string {
  const custom = type.match(CUSTOM_VISUAL)?.[1]
  return custom ? `${custom[0]?.toUpperCase()}${custom.slice(1)}, custom visual` : type
}

const SWATCH = /^#[0-9a-f]{3,8}$/i

function swatch(hex: string): string {
  const h = hex.slice(1)
  return h.length === 3 || h.length === 4 ? `#${[...h.slice(0, 3)].map(c => c + c).join('')}` : `#${h.slice(0, 6)}`
}

export function glyph(n: TreeNode, tier: Tier): Glyph {
  if (n.kind === 'theme color' || n.kind === 'theme prop') {
    const code = n.note.split(' ')[0] ?? ''
    if (SWATCH.test(code)) return { char: tier === 'plain' ? '■' : '\u{f0764}', color: swatch(code) }
    return { char: '◦', color: hex(GLYPH_DIM) }
  }
  if (n.kind === 'text class') {
    const hexColor = n.note.split(' ').find(w => SWATCH.test(w))
    const g = pick({ fabric: 0, nerd: REPORT_NERD['text class'] ?? '', rgb: GLYPH_DIM }, tier, PLAIN['text class'] ?? 'T')
    return hexColor ? { ...g, color: swatch(hexColor) } : g
  }
  if (n.kind === 'theme style') {
    if (n.name === 'All visuals') return pick({ fabric: 0, nerd: '\u{f06c4}', rgb: GLYPH_DIM }, tier, '*')
    return glyph({ ...n, kind: 'visual', note: n.name }, tier)
  }
  const type = n.kind === 'visual' ? n.note || n.name : ''
  if (n.kind === 'visual' && CUSTOM_VISUAL.test(type)) return pick({ fabric: 0, nerd: '\u{f0431}', rgb: GLYPH_DIM }, tier, '⧈')
  const plain = VISUAL_PLAIN[type] ?? PLAIN[n.kind] ?? '■'
  if (n.kind === 'report') return pick(item('Report'), tier, plain)
  if (n.kind === 'semantic model') {
    const g = pick(item('SemanticModel'), tier, plain)
    return { ...g, label: g.color }
  }
  if (REPORT_NERD[n.kind]) {
    const fabric = n.kind === 'visual' ? (PBIR_VISUALS[type] ?? PBIR_CHILDREN.visual) : PBIR_CHILDREN[n.kind]
    return pick({ fabric: fabric ?? 0, nerd: VISUAL_NERD[type] ?? REPORT_NERD[n.kind] ?? CONTAINER.nerd, rgb: GLYPH_DIM }, tier, plain)
  }
  return pick(CONTAINER, tier, plain)
}
