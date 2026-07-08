import { spawnSync } from 'node:child_process'
import process from 'node:process'

const args = ['playwright', 'install', '--only-shell', '--no-progress', 'chromium']

const result = spawnSync('npx', args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

process.exit(result.status ?? 1)
