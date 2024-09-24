import * as path from 'path'
import * as os from 'os'

import * as core from '@actions/core'
import * as github from '@actions/github'
import * as io from '@actions/io'
import * as tc from '@actions/tool-cache'
import * as semver from 'semver'

import {
  restoreBinaryCache,
  saveBinaryCache,
  restoreCache,
  saveCache,
  deleteCache
} from './cache-helper'
import { showVersion, showStats } from './ccache-helper'
import { CMakeHelper } from './cmake-helper'
import {
  type CCacheBinaryMetadata,
  CCACHE_BINARY_SUPPORTED_URL
} from './constants'
import * as git from './git-helper'
import { hashFiles } from './hash-helper'
import { getInputs, type GHAInputs } from './input-helper'
import { findVersion, type CCacheVersion } from './utils'

interface GHAStates {
  ccacheKeyPrefix: string
  ccacheDir: string
  restoreKey: string
  ghToken: string
}

async function run(): Promise<void> {
  if (core.getState('isPost') === 'true') {
    await postAction({
      ccacheKeyPrefix: core.getState('ccacheKeyPrefix'),
      ccacheDir: core.getState('ccacheDir'),
      restoreKey: core.getState('restoreKey'),
      ghToken: core.getState('ghToken')
    })
    return
  }

  const input = await getInputs()

  if (input.install) {
    await preInstall(input)
  }

  const restoreKey = await core.group('Restore cache', async () => {
    const key = await restoreCache(input.ccacheDir, input.ccacheKeyPrefix)

    if (key !== undefined) {
      core.info(`Restored cache with key: ${key}`)
    } else {
      core.info(`Cache not found.`)
    }

    return key
  })

  await configure(input)
  await core.group('Show ccache statistics', () => showStats())

  core.saveState('isPost', 'true')
  core.saveState('ccacheKeyPrefix', input.ccacheKeyPrefix)
  core.saveState('ccacheDir', input.ccacheDir)
  core.saveState('restoreKey', restoreKey ?? '')
  core.saveState('ghToken', input.ghToken)
}

async function preInstall(input: GHAInputs) {
  await io.which('git', true)

  await core.group('Clone Repository', () => git.clone(input.path))
  await core.group('Fetch Repository', () => git.fetch(input.path))

  const ccacheVersion = await core.group('Find Ccache Version', async () => {
    const tags = await git.tagList(input.path)
    const version = findVersion(tags, input.version)
    core.info(`Select version: ${version.version.version}`)
    return version
  })

  const installPath = path.join(input.path, 'install', 'bin')

  const cacheHit = await core.group('Restore Binary Cache', async () => {
    const restoreKey = await restoreBinaryCache(
      installPath,
      input.ccacheBinaryKeyPrefix,
      ccacheVersion.version.version
    )

    if (restoreKey !== undefined) {
      core.info(`Restored binary cache with key: ${restoreKey}`)
    } else {
      core.info('Binary cache not found.')
    }

    return restoreKey
  })

  if (cacheHit) {
    if (await postInstall(input, ccacheVersion, installPath)) return
  }

  await install(input, ccacheVersion, installPath)
}

async function install(
  input: GHAInputs,
  ccacheVersion: CCacheVersion,
  installPath: string
) {
  if (input.installType === 'binary') {
    const downloadHit = await core.group('Download Binary', async () => {
      const matrix = CCACHE_BINARY_SUPPORTED_URL[os.platform()]

      if (matrix) {
        let targetBinary: CCacheBinaryMetadata | undefined

        for (const v of Object.entries(matrix)) {
          if (semver.satisfies(ccacheVersion.version, v[0])) {
            targetBinary = v[1]
            break
          }
        }

        if (targetBinary) {
          return await downloadTool(
            targetBinary,
            ccacheVersion.version.version,
            input.path,
            installPath
          )
        }
      }

      return false
    })

    if (downloadHit) {
      if (await postInstall(input, ccacheVersion, installPath, true)) return
    }
  }

  // Fail to restore or download, fall back to compile from source.
  await core.group('Checkout Binary', () =>
    git.checkout(input.path, ccacheVersion.tag)
  )

  const cmakeHelper = new CMakeHelper(input.path)

  await core.group('Build Ccache', async () => {
    await cmakeHelper.configure()
    await cmakeHelper.build()
  })

  await core.group('Install Ccache', async () => {
    await cmakeHelper.install(path.join(input.path, 'install'))
  })

  if (!(await postInstall(input, ccacheVersion, installPath, true))) {
    throw new Error(
      'ccache is not working after compilation. Try downgrading if problem persist.'
    )
  }
}

async function postInstall(
  input: GHAInputs,
  ccacheVersion: CCacheVersion,
  installPath: string,
  saveCache?: boolean
): Promise<boolean> {
  const working = await core.group('Test Ccache', () =>
    showVersion(installPath)
  )

  if (working) {
    core.addPath(installPath)
    core.setOutput('ccache-binary', installPath)

    if (saveCache) {
      await core.group('Save Binary Cache', () =>
        saveBinaryCache(
          installPath,
          input.ccacheBinaryKeyPrefix,
          ccacheVersion.version.version
        )
      )
    }

    return true
  }

  return false
}

async function configure(input: GHAInputs) {
  await core.group<void>('Configure Ccache', () => {
    return new Promise(resolve => {
      core.exportVariable('CCACHE_DIR', input.ccacheDir)
      core.exportVariable('CCACHE_COMPILERCHECK', input.compilerCheck)
      // prettier-ignore
      core.exportVariable( input.compression ? 'CCACHE_COMPRESS' : 'CCACHE_NOCOMPRESS', 'true')
      // prettier-ignore
      core.exportVariable('CCACHE_COMPRESSLEVEL', input.compressionLevel.toString())
      core.exportVariable('CCACHE_MAXFILES', input.maxFiles.toString())
      core.exportVariable('CCACHE_MAXSIZE', input.maxSize)
      core.exportVariable('CCACHE_SLOPPINESS', input.sloppiness)

      core.info('Configure Complete.')
      resolve()
    })
  })
}

async function postAction(state: GHAStates) {
  await core.group('Show ccache statistics', () => showStats())

  const outputHash = await core.group('Calculate cache hashes', async () => {
    const hash = await hashFiles(
      `${state.ccacheDir}${path.sep}**`,
      `!${state.ccacheDir}${path.sep}**${path.sep}stats`
    )
    core.info(hash)
    return hash
  })

  if (outputHash === '') {
    core.info('No cache found. Skip saving cache.')
    return
  }

  const restoreKey = `${state.ccacheKeyPrefix}_${outputHash}`

  if (restoreKey !== state.restoreKey) {
    if (
      state.ghToken !== '' &&
      state.restoreKey !== '' &&
      !github.context.ref.startsWith('refs/pull/')
    ) {
      try {
        await core.group('Delete old cache', async () => {
          await deleteCache(state.ghToken, state.restoreKey)
          core.info(`Deleted cache with key: ${state.restoreKey}`)
        })
      } catch (error) {
        core.warning((error as Error)?.message ?? error)
      }
    }

    await core.group('Saving cache', () =>
      saveCache(state.ccacheDir, restoreKey)
    )
  }
}

async function downloadTool(
  binary: CCacheBinaryMetadata,
  version: string,
  downloadPath: string,
  installPath: string
): Promise<boolean> {
  try {
    const extractPath = path.join(downloadPath, 'extract')
    const file = await tc.downloadTool(binary.url(version))

    if (binary.fileType === 'zip') {
      await tc.extractZip(file, extractPath)
    } else if (binary.fileType === 'tar') {
      await tc.extractTar(file, extractPath, 'x')
    }

    await io.mv(
      path.join(extractPath, binary.pathToBinary(version)),
      installPath
    )

    return true
  } catch {
    return false
  }
}

run().catch(reason => {
  core.setFailed((reason as Error)?.message ?? reason)
})
