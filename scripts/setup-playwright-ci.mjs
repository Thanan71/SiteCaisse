import { spawnSync } from 'node:child_process'
import process from 'node:process'

const args =
  process.platform === 'linux'
    ? ['playwright', 'install', '--with-deps', 'chromium']
    : ['playwright', 'install', 'chromium']

const result = spawnSync('npx', args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

process.exit(result.status ?? 1)
