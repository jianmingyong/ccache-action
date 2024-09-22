import { sep } from 'path'

import { exec } from '@actions/exec'

export async function testRun(path?: string): Promise<boolean> {
  let returnCode: number

  if (path === undefined) {
    returnCode = await exec('ccache', ['--version'], {
      ignoreReturnCode: true
    })
  } else {
    returnCode = await exec(`.${sep}ccache`, ['--version'], {
      cwd: path,
      ignoreReturnCode: true
    })
  }

  return returnCode === 0
}
