import * as core from '@actions/core'
import { exec } from '@actions/exec'
import * as semver from 'semver'

import { GHAInputs, getInputs } from './input-helper'
import path from 'path'

const CCACHE_REPOSITORY = 'https://github.com/ccache/ccache'

type CCacheVersion = Record<string, semver.SemVer>

async function run(): Promise<void> {
  const input = await getInputs()
  await cloneRepository(input)
  await fetchRepository(input)
  const tags = await getAvailableTags(input)
  await checkoutRepository(input, tags)
  await build(input)
  await install(input)
}

async function cloneRepository(input: GHAInputs): Promise<void> {
  try {
    core.startGroup('Cloning ccache repository')

    await exec('git clone', [
      '--no-checkout',
      '--depth=1',
      CCACHE_REPOSITORY,
      input.path
    ])
  } finally {
    core.endGroup()
  }
}

async function fetchRepository(input: GHAInputs): Promise<void> {
  try {
    core.startGroup('Fetching ccache repository')

    await exec('git fetch', ['--depth=1', '--tags'], { cwd: input.path })
  } finally {
    core.endGroup()
  }
}

async function getAvailableTags(input: GHAInputs): Promise<CCacheVersion> {
  const availableVersions: CCacheVersion = {}

  try {
    core.startGroup('Getting available tags')

    await exec('git tag --list', [], {
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
  } finally {
    core.endGroup()
  }

  return availableVersions
}

async function checkoutRepository(
  input: GHAInputs,
  tags: CCacheVersion
): Promise<void> {
  try {
    core.startGroup('Checkout ccache')

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
  } finally {
    core.endGroup()
  }
}

async function build(input: GHAInputs): Promise<void> {
  try {
    core.startGroup('Build ccache')

    if (process.platform === 'win32') {
      if (process.env['MSYSTEM'] === undefined) {
        await exec(
          'cmake -D CMAKE_BUILD_TYPE=Release -D ENABLE_TESTING=OFF -D REDIS_STORAGE_BACKEND=OFF -D CMAKE_INSTALL_PREFIX=build -G "Visual Studio 17 2022" -A x64 -T host=x64 -S . -B build',
          [],
          { cwd: input.path }
        )
        await exec('cmake --build build --config Release', [], {
          cwd: input.path
        })
      } else {
        await exec(
          'msys2',
          [
            '-c',
            'cmake -D CMAKE_BUILD_TYPE=Release -D ENABLE_TESTING=OFF -D REDIS_STORAGE_BACKEND=OFF -D CMAKE_INSTALL_PREFIX=build -G "Ninja" -S . -B build'
          ],
          { cwd: input.path }
        )
        await exec('msys2', ['-c', 'cmake --build build'], { cwd: input.path })
      }
    } else {
      await exec(
        'cmake -D CMAKE_BUILD_TYPE=Release -D ENABLE_TESTING=OFF -D REDIS_STORAGE_BACKEND=OFF -D CMAKE_INSTALL_PREFIX=build -G "Unix Makefiles" -S . -B build',
        [],
        { cwd: input.path }
      )
      await exec('cmake --build build', [], { cwd: input.path })
    }
  } finally {
    core.endGroup()
  }
}

async function install(input: GHAInputs): Promise<void> {
  try {
    core.startGroup('Install ccache')

    if (process.platform === 'win32') {
      if (process.env['MSYSTEM'] === undefined) {
        await exec('cmake --install build', [], { cwd: input.path })
      } else {
        await exec('msys2', ['-c', 'cmake --install build'], {
          cwd: input.path
        })
      }
    } else {
      await exec('cmake --install build', [], { cwd: input.path })
    }

    core.addPath(path.join(input.path, 'build', 'bin'))
  } finally {
    core.endGroup()
  }
}

run().catch(reason => {
  core.setFailed(reason)
})
