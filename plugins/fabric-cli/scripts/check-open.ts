import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { LINUX_LAUNCH, LINUX_OPEN } from '../hooks/open'

const dir = mkdtempSync(join(tmpdir(), 'pane-open-'))
const bin = join(dir, 'bin')
const data = join(dir, 'data with spaces')
const run = (script: string, args: string[], env = process.env) => spawnSync('/bin/sh', ['-c', script, 'sh', ...args], { encoding: 'utf8', env, timeout: 5000 })
const dry = LINUX_OPEN.replace(/exec (gio launch [^\n]+|gio open \"\$f\"|xdg-open \"\$f\")/g, '{ echo $1; exit 0; }')
try {
  mkdirSync(bin)
  mkdirSync(join(data, 'applications'), { recursive: true })
  writeFileSync(join(data, 'applications/editor.desktop'), '')
  writeFileSync(join(bin, 'gio'), '#!/bin/sh\n[ "$1" = info ] || exit 99\nprintf "standard::content-type: %s\n" "$TEST_MIME"\n', { mode: 0o700 })
  writeFileSync(join(bin, 'xdg-mime'), '#!/bin/sh\necho editor.desktop\n', { mode: 0o700 })
  for (const tool of ['file', 'sed']) symlinkSync(`/usr/bin/${tool}`, join(bin, tool))
  const env = { ...process.env, PATH: bin, XDG_DATA_HOME: data, XDG_DATA_DIRS: join(dir, 'absent'), TEST_MIME: 'video/mpeg' }
  for (const ext of ['ts', 'txt', 'json', 'mp3']) {
    const target = join(dir, `A & B.${ext}`)
    writeFileSync(target, 'plain text\n')
    for (const mime of ['video/mpeg', 'audio/mpeg']) {
      const result = run(dry, [target], { ...env, TEST_MIME: mime })
      assert.equal(result.status, 0, result.stderr)
      assert.equal(result.stdout.trim(), `gio launch ${data}/applications/editor.desktop ${target}`)
    }
    const normal = run(dry, [target], { ...env, TEST_MIME: 'text/plain' })
    assert.equal(normal.status, 0, normal.stderr)
    assert.equal(normal.stdout.trim(), `gio open ${target}`)
  }
  const binary = join(dir, 'movie.ts')
  writeFileSync(binary, new Uint8Array([0, 1, 2, 0, 255]))
  for (const target of [binary, dir, 'https://example.test/?a=1&b=two%20words']) {
    const result = run(dry, [target], env)
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout.trim(), `gio open ${target}`)
  }
  rmSync(join(data, 'applications/editor.desktop'))
  assert.equal(run(dry, [join(dir, 'A & B.ts')], env).status, 1)
  const fallbackScript = LINUX_OPEN.replace('exec xdg-open', 'echo xdg-open')
  assert.equal(run(fallbackScript, [dir], env).stdout.trim(), `xdg-open ${dir}`)
  rmSync(join(bin, 'gio'))
  const fallback = run(dry, [dir], env)
  assert.equal(fallback.status, 0, fallback.stderr)
  assert.equal(fallback.stdout.trim(), `xdg-open ${dir}`)
  for (const code of [0, 7, 127]) assert.equal(run(LINUX_LAUNCH, ['/bin/sh', '-c', `exit ${code}`]).status, code)
  assert.equal(run(LINUX_LAUNCH, ['/bin/sh', '-c', 'for fd in 0 1 2; do [ "$(readlink /proc/$$/fd/$fd)" = /dev/null ] || exit 9; done']).status, 0)
  for (const target of process.argv.slice(2)) {
    const result = run(dry, [target])
    assert.equal(result.status, 0, result.stderr)
    console.log(`${target}: ${result.stdout.trim()}`)
  }
  console.log('Open checks passed; no applications launched')
} finally {
  rmSync(dir, { recursive: true, force: true })
}
