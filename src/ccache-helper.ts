import * as path from 'path'

import { exec } from '@actions/exec'

export async function showVersion(ccachePath?: string): Promise<boolean> {
  let returnCode: number

  if (ccachePath === undefined) {
    returnCode = await exec('ccache', ['--version'], {
      ignoreReturnCode: true
    })
  } else {
    returnCode = await exec(`.${path.sep}ccache`, ['--version'], {
      cwd: ccachePath,
      ignoreReturnCode: true
    })
  }

  return returnCode === 0
}

export async function showStats(): Promise<number> {
  return await exec('ccache --show-stats')
}
