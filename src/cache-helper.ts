import * as os from 'os'

import * as cache from '@actions/cache'
import * as core from '@actions/core'
import { exec } from '@actions/exec'

export async function restoreBinaryCache(
  installPath: string,
  restoreKeyPrefix: string,
  version: string
): Promise<boolean> {
  try {
    if (cache.isFeatureAvailable()) {
      const restoryKey = `${restoreKeyPrefix}_${os.platform()}_${os.arch()}_${version}`
      const key = await cache.restoreCache([installPath], restoryKey)

      if (key === restoryKey) {
        core.addPath(installPath)

        const code = await exec('ccache', ['--version'], {
          ignoreReturnCode: true,
          listeners: {
            stdout: (data: Buffer) => {
              data.toString()
            }
          }
        })

        return code === 0
      }
    }

    return false
  } catch {
    return false
  }
}

export async function saveBinaryCache(
  installPath: string,
  restoreKeyPrefix: string,
  version: string
): Promise<number | null> {
  try {
    if (cache.isFeatureAvailable()) {
      return await cache.saveCache(
        [installPath],
        `${restoreKeyPrefix}_${os.platform()}_${os.arch()}_${version}`
      )
    }
    return null
  } catch {
    return null
  }
}
