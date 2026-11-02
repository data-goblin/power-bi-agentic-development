import type { ClientModule } from 'claude-code'

export type Seg = { t: string; c?: string; b?: boolean; s?: boolean; i?: boolean; sh?: string; dim?: boolean; one?: boolean; spin?: boolean; claude?: boolean; bg?: string; tab?: string }
export type RowSpec = { id: string; left: Seg[]; right: Seg[] }
export type RowsProps = {
  rows: RowSpec[]
  active: string
  activeBg: string
  hoverBg: string
  tones: Record<string, { bright: string[]; dim: string[] }>
  pointer?: boolean
  bar?: { pos: number; size: number; thumb: string; track: string }
}
type Local = { hover: number; phase: number; drag: boolean; ref: { stop?: () => void; unpoint?: () => void } }

const TICK_MS = 90
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const GRADIENT = ['#5eead4', '#67e8f9', '#7dd3fc', '#93c5fd', '#a5b4fc', '#c4b5fd', '#d8b4fe', '#f0abfc', '#d8b4fe', '#c4b5fd', '#a5b4fc', '#93c5fd', '#7dd3fc', '#67e8f9']

function shimmer(i: number, phase: number, len: number, palette: string[]): string {
  const band = ((phase * 1.6) % (len + 8)) - 4
  const d = Math.abs(i - band)
  return palette[d < 0.8 ? 3 : d < 1.8 ? 2 : d < 2.8 ? 1 : 0] ?? palette[0] ?? '#f97316'
}

const Rows: ClientModule<RowsProps, Local> = (props, surface) => {
  const { Box, Text } = surface.elements
  let state = surface.state
  if (state === undefined) {
    state = { hover: -1, phase: 0, drag: false, ref: {} }
    surface.setState(state)
  }
  const lit = props.rows.some(r => r.left.some(s => s.sh || s.spin || s.claude) || r.right.some(s => s.sh || s.spin || s.claude))
  if (lit && !state.ref.stop) {
    state.ref.stop = surface.every(TICK_MS, () => {
      const cur = surface.state
      if (cur) surface.setState({ ...cur, phase: cur.phase + 1 })
    })
  } else if (!lit && state.ref.stop) {
    state.ref.stop()
    state.ref.stop = undefined
  }
  if (props.pointer === false) {
    state.ref.unpoint?.()
    state.ref.unpoint = undefined
  } else state.ref.unpoint = surface.onPointer(e => {
    const cur = surface.state ?? state
    const span = Math.max(1, props.rows.length - 1)
    const onBar = Boolean(props.bar) && e.x >= surface.columns - 1
    if (props.bar && (cur.drag || (onBar && e.type === 'down' && (e.button ?? 'left') === 'left'))) {
      if (e.type === 'up' || e.type === 'leave') {
        surface.setState({ ...cur, drag: false })
        return
      }
      if (e.type === 'down' || e.type === 'move') {
        if (!cur.drag) surface.setState({ ...cur, drag: true, hover: -1 })
        surface.post({ scrollTo: Math.max(0, Math.min(1, e.y / span)) })
        return
      }
    }
    if (e.type === 'leave' || e.y < 0 || e.y >= props.rows.length) {
      if (cur.hover !== -1) surface.setState({ ...cur, hover: -1 })
      return
    }
    if (e.type === 'move' && !e.button && cur.hover !== e.y) surface.setState({ ...cur, hover: e.y })
    const row = props.rows[e.y]
    if (e.type === 'down' && e.button === 'right' && row?.id) {
      surface.post({ copy: row.id, shift: Boolean(e.shift) })
      return
    }
    if (e.type !== 'down' || (e.button ?? 'left') !== 'left' || !row) return
    const wide = (seg: Seg) => [...seg.t].length + (seg.spin ? 1 : 0)
    let x = 0
    for (const seg of row.left) {
      const w = wide(seg)
      if (seg.tab && e.x >= x && e.x < x + w) {
        surface.post({ tab: seg.tab })
        return
      }
      x += w
    }
    x = surface.columns - (props.bar ? 1 : 0) - row.right.reduce((n, seg) => n + wide(seg), 0)
    for (const seg of row.right) {
      const w = wide(seg)
      if (seg.tab && e.x >= x && e.x < x + w) {
        surface.post({ tab: seg.tab })
        return
      }
      x += w
    }
    if (row.id) surface.post({ press: row.id, ctrl: Boolean(e.ctrl), shift: Boolean(e.shift) })
  })
  surface.onKey(e => surface.post({ key: e.key, ctrl: Boolean(e.ctrl), shift: Boolean(e.shift) }))
  const draw = (s: Seg, k: number) => {
    if (s.claude) {
      const shut = Math.floor(state.phase / 3) % 12 === 11
      return (
        <Text key={String(k)} color={shut ? '#7a4535' : '#d97757'} bold={!shut}>
          {s.t}
        </Text>
      )
    }
    if (s.spin) {
      const frame = FRAMES[state.phase % FRAMES.length] ?? ''
      return (
        <Text key={String(k)} bold={s.b}>
          {s.t ? <Text color={s.c}>{s.t}</Text> : null}
          <Text color={GRADIENT[state.phase % GRADIENT.length]} bold>
            {frame}
          </Text>
        </Text>
      )
    }
    const palette = s.sh ? (s.dim ? props.tones[s.sh]?.dim : props.tones[s.sh]?.bright) : undefined
    if (!palette) {
      return (
        <Text key={String(k)} color={s.c || undefined} dimColor={s.c === ''} backgroundColor={s.bg} bold={s.b} strikethrough={s.s} italic={s.i}>
          {s.t}
        </Text>
      )
    }
    if (s.one) {
      return (
        <Text key={String(k)} color={shimmer(-1, state.phase, s.t.length, palette)}>
          {s.t}
        </Text>
      )
    }
    const chars = [...s.t]
    return (
      <Text key={String(k)} bold={s.b}>
        {chars.map((ch, i) => (
          <Text key={String(i)} color={shimmer(i, state.phase, chars.length, palette)}>{ch}</Text>
        ))}
      </Text>
    )
  }
  return (
    <Box flexDirection="column">
      {props.rows.map((r, i) => (
        <Box
          key={r.id || `row-${i}`}
          flexDirection="row"
          height={1}
          overflow="hidden"
          backgroundColor={r.id && r.id === props.active ? props.activeBg : r.id && i === state.hover ? props.hoverBg : undefined}
        >
          <Box flexShrink={1} overflow="hidden">
            {r.left.map(draw)}
          </Box>
          <Box flexGrow={1} />
          {r.right.map(draw)}
          {props.bar && (
            <Text color={(i >= props.bar.pos && i < props.bar.pos + props.bar.size ? props.bar.thumb : props.bar.track) || undefined} dimColor={!props.bar.track && !(i >= props.bar.pos && i < props.bar.pos + props.bar.size)}>
              {i >= props.bar.pos && i < props.bar.pos + props.bar.size ? '┃' : '│'}
            </Text>
          )}
        </Box>
      ))}
    </Box>
  )
}

export default Rows
