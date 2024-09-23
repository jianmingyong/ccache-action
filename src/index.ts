import * as path from 'path'
import * as os from 'os'

import * as core from '@actions/core'
import { exec } from '@actions/exec'
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
import { testRun, showStats } from './ccache-helper'
import {
  type CCacheBinaryMetadata,
  CCACHE_BINARY_SUPPORTED_URL,
  CCACHE_CONFIGURE_OPTIONS
} from './constants'
import * as git from './git-helper'
import { hashFiles } from './hash-helper'
import { getInputs, type GHAInputs } from './input-helper'

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
  } else if (core.getState('isPost') === 'false') {
    core.info('Post action skipped due to an error.')
    return
  }

  core.saveState('isPost', 'false')

  const input = await getInputs()

  if (input.install) {
    await preInstall(input)
  }

  const restoreKey = await core.group('Restore cache', () =>
    restoreCache(input.ccacheDir, input.ccacheKeyPrefix)
  )

  await configure(input)

  core.saveState('isPost', 'true')
  core.saveState('ccacheKeyPrefix', input.ccacheKeyPrefix)
  core.saveState('ccacheDir', input.ccacheDir)
  core.saveState('restoreKey', restoreKey ?? '')
  core.saveState('ghToken', input.ghToken)
}

async function preInstall(input: GHAInputs) {
  const gitPath = await io.which('git', true)
  core.info(`Found git: ${gitPath}`)

  await core.group('Clone Repository', () => git.clone(input.path))
  await core.group('Fetch Repository', () => git.fetch(input.path))
  const tags = await core.group('Get Tag List', () => git.tagList(input.path))
  const ccacheVersion = findVersion(tags, input.version)

  const installPath = path.join(input.path, 'install', 'bin')

  const cacheHit = await core.group('Restore Binary Cache', async () => {
    return await restoreBinaryCache(
      installPath,
      input.ccacheBinaryKeyPrefix,
      ccacheVersion.version.version
    )
  })

  if (cacheHit) {
    if (await postInstall(input, ccacheVersion, installPath)) {
      return
    }
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
      if (await postInstall(input, ccacheVersion, installPath, true)) {
        return
      }
    }
  }

  // Fail to restore or download, fall back to compile from source.
  await core.group('Checkout Binary', () =>
    git.checkout(input.path, ccacheVersion.tag)
  )

  await core.group('Build ccache', async () => {
    if (process.platform === 'win32') {
      await exec(
        `cmake ${CCACHE_CONFIGURE_OPTIONS} -G "Visual Studio 17 2022" -A x64 -T host=x64 -S . -B build`,
        [],
        { cwd: input.path }
      )
      await exec(
        `cmake --build build --config Release -j ${os.availableParallelism()}`,
        [],
        { cwd: input.path }
      )
    } else {
      await exec(
        `cmake ${CCACHE_CONFIGURE_OPTIONS} -G "Unix Makefiles" -S . -B build`,
        [],
        { cwd: input.path }
      )
      await exec(`cmake --build build -j ${os.availableParallelism()}`, [], {
        cwd: input.path
      })
    }
  })

  await core.group('Install ccache', async () => {
    const installPrefix = path.join(input.path, 'install')

    if (process.platform === 'win32') {
      await exec(
        `cmake --install build --config Release --prefix ${installPrefix}`,
        [],
        { cwd: input.path }
      )
    } else {
      await exec(`cmake --install build --prefix ${installPrefix}`, [], {
        cwd: input.path
      })
    }
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
  const working = await core.group('Test ccache', () => testRun(installPath))

  if (working) {
    core.addPath(installPath)

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
  await core.group<void>('Configure ccache', () => {
    return new Promise(resolve => {
      core.exportVariable('CCACHE_DIR', input.ccacheDir)
      core.exportVariable('CCACHE_COMPILERCHECK', input.compilerCheck)
      core.exportVariable(
        input.compression ? 'CCACHE_COMPRESS' : 'CCACHE_NOCOMPRESS',
        ''
      )
      core.exportVariable(
        'CCACHE_COMPRESSLEVEL',
        input.compressionLevel.toString()
      )
      core.exportVariable('CCACHE_MAXFILES', input.maxFiles.toString())
      core.exportVariable('CCACHE_MAXSIZE', input.maxSize)
      core.exportVariable('CCACHE_SLOPPINESS', input.sloppiness)

      core.info('Configure Completed.')
      resolve()
    })
  })
}

async function postAction(state: GHAStates) {
  await core.group('Show ccache statistics', () => showStats())

  const outputHash = await core.group('Calculate cache hashes', async () => {
    const hash = await hashFiles(
      `${state.ccacheDir.replace('\\', '/')}/**`,
      `!${state.ccacheDir.replace('\\', '/')}/**/stats`
    )
    core.info(hash)
    return hash
  })

  if (outputHash === '') {
    core.info('No cache found. Skip saving cache.')
    return
  }

  const restoreKey = `${state.ccacheKeyPrefix}_${outputHash}`

  if (restoreKey === state.restoreKey) {
    if (state.ghToken !== '') {
      await core.group('Delete old cache', async () => {
        await deleteCache(state.ghToken, restoreKey)
        core.info(`Cache with key: '${restoreKey}' deleted.`)
      })
    }
  }

  await core.group('Saving cache', () => saveCache(state.ccacheDir, restoreKey))
}

interface CCacheVersion {
  tag: string
  version: semver.SemVer
}

function findVersion(
  tags: readonly string[],
  range: string | semver.Range
): CCacheVersion {
  const versions: CCacheVersion[] = []

  tags.forEach((tag: string) => {
    const result = semver.coerce(tag, { loose: true })
    if (result !== null) versions.push({ tag: tag, version: result })
  })

  const version = semver.maxSatisfying(
    versions.map(v => v.version),
    range
  )

  if (version === null) {
    throw new Error(
      `Could not find a version that satisfy ${(range as semver.Range)?.range ?? range}`
    )
  }

  return versions.find((v: CCacheVersion) => semver.eq(v.version, version))!
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
