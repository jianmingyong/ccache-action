import * as path from 'path'
import * as os from 'os'

import * as cache from '@actions/cache'
import * as github from '@actions/github'

export async function restoreBinaryCache(
  installPath: string,
  restoreKeyPrefix: string,
  version: string
): Promise<string | undefined> {
  try {
    if (!cache.isFeatureAvailable()) return undefined

    return await cache.restoreCache(
      [`${installPath}${path.sep}**`],
      `${restoreKeyPrefix}_${os.platform()}_${os.arch()}_${version}`
    )
  } catch {
    return undefined
  }
}

export async function saveBinaryCache(
  installPath: string,
  restoreKeyPrefix: string,
  version: string
): Promise<number | undefined> {
  try {
    if (!cache.isFeatureAvailable()) return undefined

    return await cache.saveCache(
      [`${installPath}${path.sep}**`],
      `${restoreKeyPrefix}_${os.platform()}_${os.arch()}_${version}`
    )
  } catch {
    return undefined
  }
}

export async function restoreCache(
  ccachePath: string,
  restoreKeyPrefix: string
): Promise<string | undefined> {
  try {
    if (!cache.isFeatureAvailable()) return undefined

    return await cache.restoreCache(
      [`${ccachePath}${path.sep}**`],
      restoreKeyPrefix,
      [`${restoreKeyPrefix}_`]
    )
  } catch {
    return undefined
  }
}

export async function saveCache(
  ccachePath: string,
  restoreKey: string
): Promise<number | undefined> {
  try {
    if (!cache.isFeatureAvailable()) return undefined

    return await cache.saveCache([`${ccachePath}${path.sep}**`], restoreKey)
  } catch {
    return undefined
  }
}

export async function deleteCache(token: string, key: string) {
  const octokit = github.getOctokit(token)
  const { owner, repo } = github.context.repo

  await octokit.rest.actions.deleteActionsCacheByKey({
    owner: owner,
    repo: repo,
    key: key,
    ref: github.context.ref
  })
}
