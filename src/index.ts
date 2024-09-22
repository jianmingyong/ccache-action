import * as path from 'path'
import * as os from 'os'

import * as core from '@actions/core'
import { exec } from '@actions/exec'
import * as io from '@actions/io'
import * as tc from '@actions/tool-cache'
import * as semver from 'semver'

import { restoreBinaryCache, saveBinaryCache } from './cache-helper'
import {
  type CCacheBinaryMetadata,
  CCACHE_BINARY_SUPPORTED_URL,
  CCACHE_CONFIGURE_OPTIONS
} from './constants'
import * as git from './git-helper'
import { getInputs, type GHAInputs } from './input-helper'

async function run(): Promise<void> {
  const input = await getInputs()

  if (input.install) {
    await install(input)
  }

  // Configure Ccache step.
  await core.group('CCache Version', () => exec('ccache --version'))

  await core.group('Configure Ccache', () => {
    return new Promise(() => {
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
    })
  })

  core.saveState('isPost', 'true')
  core.saveState('ccacheDir', input.ccacheDir)
}

async function install(input: GHAInputs) {
  const gitPath = await io.which('git', true)
  core.info(`Found git: ${gitPath}`)

  await core.group('Clone Repository', () => git.clone(input.path))
  await core.group('Fetch Repository', () => git.fetch(input.path))
  const tags = await core.group('Get Tag List', () => git.tagList(input.path))
  const ccacheVersion = findVersion(tags, input.version)

  let hasInstalled = false
  const installPath = path.join(input.path, 'install', 'bin')

  await core.group('Restore Binary Cache', async () => {
    hasInstalled = await restoreBinaryCache(
      installPath,
      input.ccacheBinaryKeyPrefix,
      ccacheVersion.version.version
    )
  })

  if (input.installType === 'binary') {
    await core.group('Download Binary', async () => {
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
          hasInstalled = await downloadTool(
            targetBinary,
            ccacheVersion.version.version,
            input.path,
            installPath
          )
        }
      }
    })
  }

  if (!hasInstalled) {
    // Fail to restore or download, fall back to compile from source.
    await core.group('Checkout Binary', () =>
      git.checkout(input.path, ccacheVersion.tag)
    )

    await core.group('Build ccache', async () => {
      if (process.platform === 'win32') {
        if (process.env['MSYSTEM']) {
          await exec(
            'msys2',
            [
              '-c',
              `cmake ${CCACHE_CONFIGURE_OPTIONS} -G "MSYS Makefiles" -S . -B build`
            ],
            { cwd: input.path }
          )
          await exec(
            'msys2',
            ['-c', `cmake --build build -j ${os.availableParallelism()}`],
            { cwd: input.path }
          )
        } else {
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
        }
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
        if (process.env['MSYSTEM']) {
          await exec(
            'msys2',
            ['-c', `cmake --install build --prefix ${installPrefix}`],
            { cwd: input.path }
          )
        } else {
          await exec(
            `cmake --install build --config Release --prefix ${installPrefix}`,
            [],
            { cwd: input.path }
          )
        }
      } else {
        await exec(`cmake --install build --prefix ${installPrefix}`, [], {
          cwd: input.path
        })
      }

      core.addPath(path.join(installPrefix, 'bin'))
    })
  }

  await core.group('Save Binary Cache', () =>
    saveBinaryCache(
      installPath,
      input.ccacheBinaryKeyPrefix,
      ccacheVersion.version.version
    )
  )
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
    await io.mkdirP(installPath)

    const extractPath = path.join(downloadPath, 'extract')
    const file = await tc.downloadTool(binary.url(version), downloadPath)

    if (binary.fileType === 'zip') {
      await tc.extractZip(file, extractPath)
    } else if (binary.fileType === 'tar') {
      await tc.extractTar(file, extractPath, 'x')
    }

    await io.mv(
      path.join(extractPath, binary.pathToBinary(version)),
      installPath
    )
    core.addPath(installPath)

    const code = await exec('ccache', ['--version'], {
      ignoreReturnCode: true
    })

    return code === 0
  } catch {
    return false
  }
}

run().catch(reason => {
  core.setFailed((reason as Error)?.message ?? reason)
})
