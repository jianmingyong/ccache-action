import { exec } from '@actions/exec'

import { CCACHE_REPOSITORY } from './constants'

export function clone(path: string): Promise<number> {
  return exec('git clone', [
    '--no-checkout',
    '--depth=1',
    CCACHE_REPOSITORY,
    path
  ])
}

export function fetch(path: string): Promise<number> {
  return exec('git fetch', ['--depth=1', '--tags'], { cwd: path })
}

export function checkout(path: string, branch: string): Promise<number> {
  return exec('git checkout', ['-f', '--detach', branch], { cwd: path })
}

export async function tagList(path: string): Promise<string[]> {
  let output = ''

  await exec('git tag', ['--list'], {
    cwd: path,
    silent: true,
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString()
      }
    }
  })

  return output.split(/\r?\n/)
}
