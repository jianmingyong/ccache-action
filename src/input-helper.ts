import path from 'path'
import process from 'process'

import core from '@actions/core'
import semver from 'semver'

import { directoryExists } from './fs-helper'

export interface GHAInputs {
  path: string
  version: string
}

export async function getInputs(): Promise<GHAInputs> {
  let githubWorkspacePath = process.env['GITHUB_WORKSPACE']

  if (!githubWorkspacePath) {
    throw new Error('GITHUB_WORKSPACE not defined')
  }

  githubWorkspacePath = path.resolve(githubWorkspacePath)

  core.debug(`GITHUB_WORKSPACE = '${githubWorkspacePath}'`)

  if (!(await directoryExists(githubWorkspacePath))) {
    throw new Error(`Directory '${githubWorkspacePath}' does not exist`)
  }

  let repositoryPath = core.getInput('path') || '.'
  repositoryPath = path.resolve(githubWorkspacePath, repositoryPath)

  if (!(repositoryPath + path.sep).startsWith(githubWorkspacePath + path.sep)) {
    throw new Error(
      `Repository path '${repositoryPath}' is not under '${githubWorkspacePath}'`
    )
  }

  core.debug(`INPUT_PATH = '${repositoryPath}'`)

  let version: string | null = core.getInput('version') || '*'
  version = semver.validRange(version, { loose: true })

  if (version === null) {
    throw new Error(`Version '${core.getInput('version')}' is not valid range`)
  }

  core.debug(`INPUT_VERSION = '${version}'`)

  return {
    path: repositoryPath,
    version: version
  }
}
