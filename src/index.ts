import path from 'path'
import os from 'os'

import cache from '@actions/cache'
import core from '@actions/core'
import { exec } from '@actions/exec'
import io from '@actions/io'
import semver from 'semver'

import { GHAInputs, getInputs } from './input-helper'

const CCACHE_REPOSITORY = 'https://github.com/ccache/ccache'

type CCacheVersion = Record<string, semver.SemVer>

async function run(): Promise<void> {
  const input = await getInputs()

  await dependenciesCheck(input)
  await cloneRepository(input)
  await fetchRepository(input)
  const tags = await getAvailableTags(input)
  await checkoutRepository(input, tags)
  await build(input)
  await install(input)
}

async function dependenciesCheck(input: GHAInputs): Promise<void> {
  await core.group('Checking ccache action dependencies', async () => {
    const gitPath = await io.which('git', true)
    core.info(`Found git: ${gitPath}`)

    const cmakePath = await io.which('cmake', true)
    core.info(`Found cmake: ${cmakePath}`)
  })
}

async function cloneRepository(input: GHAInputs): Promise<void> {
  await core.group('Cloning ccache repository', async () => {
    await exec('git clone', [
      '--no-checkout',
      '--depth=1',
      CCACHE_REPOSITORY,
      input.path
    ])
  })
}

async function fetchRepository(input: GHAInputs): Promise<void> {
  await core.group('Fetching ccache repository', async () => {
    await exec('git fetch', ['--depth=1', '--tags'], { cwd: input.path })
  })
}

async function getAvailableTags(input: GHAInputs): Promise<CCacheVersion> {
  return await core.group('Getting available tags', async () => {
    const availableVersions: CCacheVersion = {}

    await exec('git tag', ['--list'], {
      cwd: input.path,
      listeners: {
        stdline: (data: string) => {
          const parsedVersion = semver.coerce(data, { loose: true })
          if (parsedVersion !== null) {
            availableVersions[data] = parsedVersion
          }
        }
      }
    })

    return availableVersions
  })
}

async function checkoutRepository(
  input: GHAInputs,
  tags: CCacheVersion
): Promise<void> {
  await core.group('Checkout ccache', async () => {
    const targetVersion = semver.maxSatisfying(
      Object.values(tags),
      input.version
    )

    if (targetVersion === null) {
      throw new Error(`Could not find a version that satisfy ${input.version}`)
    }

    core.info(`Selecting version ${targetVersion}`)

    const targetBranch = Object.entries(tags).find(([, version]) =>
      semver.eq(version, targetVersion)
    )?.[0]

    if (targetBranch === undefined) {
      throw new Error(`Could not find a branch that satisfy ${input.version}`)
    }

    await exec('git checkout', ['-f', '--detach', targetBranch], {
      cwd: input.path
    })
  })
}

async function build(input: GHAInputs): Promise<void> {
  await core.group('Build ccache', async () => {
    const defaultConfigureOptions =
      '-D CMAKE_BUILD_TYPE=Release -D ENABLE_TESTING=OFF -D REDIS_STORAGE_BACKEND=OFF'

    if (process.platform === 'win32') {
      if (process.env['MSYSTEM'] === undefined) {
        await exec(
          `cmake ${defaultConfigureOptions} -G "Visual Studio 17 2022" -A x64 -T host=x64 -S . -B build`,
          [],
          { cwd: input.path }
        )
        await exec(
          `cmake --build build --config Release -j ${os.availableParallelism()}`,
          [],
          {
            cwd: input.path
          }
        )
      } else {
        await exec(
          'msys2',
          [
            '-c',
            `cmake ${defaultConfigureOptions} -G "MSYS Makefiles" -S . -B build`
          ],
          { cwd: input.path }
        )
        await exec(
          'msys2',
          ['-c', `cmake --build build -j ${os.availableParallelism()}`],
          { cwd: input.path }
        )
      }
    } else {
      await exec(
        `cmake ${defaultConfigureOptions} -G "Unix Makefiles" -S . -B build`,
        [],
        { cwd: input.path }
      )
      await exec(`cmake --build build -j ${os.availableParallelism()}`, [], {
        cwd: input.path
      })
    }
  })
}

async function install(input: GHAInputs): Promise<void> {
  await core.group('Install ccache', async () => {
    if (process.platform === 'win32') {
      if (process.env['MSYSTEM'] === undefined) {
        await exec(
          'cmake --install build --config Release --prefix build/install',
          [],
          { cwd: input.path }
        )
      } else {
        await exec(
          'msys2',
          ['-c', 'cmake --install build --prefix build/install'],
          {
            cwd: input.path
          }
        )
      }
    } else {
      await exec('cmake --install build --prefix build/install', [], {
        cwd: input.path
      })
    }

    core.addPath(path.join(input.path, 'build', 'install', 'bin'))
  })
}

async function cacheBinary(input: GHAInputs): Promise<void> {
  await core.group('Storing binary in cache', async () => {
    if (cache.isFeatureAvailable()) {
      await cache.saveCache([path.join(input.path, 'build', 'install')], '')
    }
  })
}

run().catch(reason => {
  core.setFailed(reason)
})
