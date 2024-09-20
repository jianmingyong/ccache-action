import * as core from '@actions/core'
import { exec } from '@actions/exec'
import * as semver from 'semver'

import { GHAInputs, getInputs } from './input-helper'

const CCACHE_REPOSITORY = 'https://github.com/ccache/ccache'

type CCacheVersion = Record<string, semver.SemVer>

async function run(): Promise<void> {
  const input = await getInputs()
  await cloneRepository(input)
  await fetchRepository(input)
  const tags = await getAvailableTags(input)
  await checkoutRepository(input, tags)
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

    exec('git checkout', ['-f', '--detach', targetBranch])
  } finally {
    core.endGroup()
  }
}

async function install(input: GHAInputs): Promise<void> {
  try {
    core.startGroup('Install ccache')
  } finally {
    core.endGroup()
  }
}

run().catch(reason => {
  core.setFailed(reason)
})
