import * as core from '@actions/core'
import { exec, getExecOutput } from '@actions/exec'
import * as semver from 'semver'

import { GHAInputs, getInputs } from './input-helper'

async function run(): Promise<void> {
  const input = await getInputs()
  await install(input)
}

async function install(input: GHAInputs): Promise<void> {
  try {
    core.startGroup('Install ccache')

    await exec(
      `git clone --no-checkout --depth 1 https://github.com/ccache/ccache ${input.path}`,
      []
    )

    await exec(`git fetch --depth 1 --tags`, [], { cwd: input.path })

    const output = await getExecOutput('git tag --list', [], {
      cwd: input.path,
      silent: true
    })

    const availableVersions: semver.SemVer[] = []

    output.stdout.split('\n').forEach((value: string) => {
      const parsedVersion = semver.coerce(value, { loose: true })
      if (parsedVersion !== null) {
        availableVersions.push(parsedVersion)
      }
    })

    const targetVersion = semver.maxSatisfying(availableVersions, input.version)

    core.info(
      `Found version ${targetVersion?.version} that satisfy ${input.version}`
    )
  } finally {
    core.endGroup()
  }
}

run().catch(reason => {
  core.setFailed(reason)
})
