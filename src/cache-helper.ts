import * as os from 'os'

import * as cache from '@actions/cache'
import * as core from '@actions/core'

export async function restoreBinaryCache(
  installPath: string,
  restoreKeyPrefix: string,
  version: string
): Promise<boolean> {
  try {
    if (cache.isFeatureAvailable()) {
      const restoreKey = `${restoreKeyPrefix}_${os.platform()}_${os.arch()}_${version}`
      const key = await cache.restoreCache([installPath], restoreKey)
      return key === restoreKey
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
): Promise<void> {
  try {
    if (cache.isFeatureAvailable()) {
      await cache.saveCache(
        [installPath],
        `${restoreKeyPrefix}_${os.platform()}_${os.arch()}_${version}`
      )
    }
  } catch {
    core.warning('Unable to save binary cache.')
  }
}
