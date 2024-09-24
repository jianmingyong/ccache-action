import { exec, getExecOutput } from '@actions/exec'

import { CCACHE_REPOSITORY } from './constants'

export function clone(path: string): Promise<number> {
  return exec('git clone', [
    '--no-checkout',
    '--depth=1',
    CCACHE_REPOSITORY,
    path
  ])
}

export function fetch(cwd: string): Promise<number> {
  return exec('git fetch', ['--depth=1', '--tags'], { cwd: cwd })
}

export function checkout(cwd: string, branch: string): Promise<number> {
  return exec('git checkout', ['-f', '--detach', branch], { cwd: cwd })
}

export async function tagList(cwd: string): Promise<string[]> {
  const output = await getExecOutput('git tag', ['--list'], {
    cwd: cwd,
    ignoreReturnCode: true,
    silent: true
  })

  return output.exitCode === 0 ? output.stdout.split(/\r?\n/) : []
}
