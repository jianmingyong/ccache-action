import * as path from 'path'
import * as process from 'process'

import * as core from '@actions/core'
import * as semver from 'semver'

import { directoryExists } from './fs-helper'

export interface GHAInputs {
  path: string
  version: string
  install: boolean
  installType: 'binary' | 'source'
  ccacheBinaryKeyPrefix: string
  ccacheKeyPrefix: string

  ccacheDir: string
  compilerCheck: string
  compression: boolean
  compressionLevel: number
  maxFiles: number
  maxSize: string
  sloppiness: string
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

  let version: string | null = core.getInput('version') || '*'
  version = semver.validRange(version, { loose: true })

  if (version === null) {
    throw new Error(`Version '${core.getInput('version')}' is not valid range`)
  }

  const installType = core.getInput('install-type').toLowerCase() || 'binary'

  if (installType !== 'binary' && installType !== 'source') {
    throw new Error(`Install Type must be either binary or source.`)
  }

  let ccacheDir = core.getInput('cache-dir') || '.ccache'
  ccacheDir = path.resolve(githubWorkspacePath, ccacheDir)

  if (!(ccacheDir + path.sep).startsWith(githubWorkspacePath + path.sep)) {
    throw new Error(
      `CCache path '${ccacheDir}' is not under '${githubWorkspacePath}'`
    )
  }

  const compilerCheck = core.getInput('compiler-check') || 'mtime'

  const maxFiles = Number.parseInt(core.getInput('max-files') || '0')

  if (maxFiles < 0) {
    throw new Error('Max Files must be 0 or positive number.')
  }

  const maxSize = core.getInput('max-size').trim()
  const maxSizeRegex = /^(\d+)(k|M|G|T|Ki|Mi|Gi|Ti)$/

  if (maxSize !== '0' && !maxSizeRegex.test(maxSize)) {
    throw new Error(
      'Max Size must be 0 or a whole number with suffixes: k, M, G, T (decimal) and Ki, Mi, Gi, Ti (binary).'
    )
  }

  const sloppiness = core.getInput('sloppiness') || 'time_macros'

  return {
    path: repositoryPath,
    version: version,
    install: core.getBooleanInput('install') || true,
    installType: installType,
    ccacheBinaryKeyPrefix:
      core.getInput('ccache-binary-key-prefix') || 'ccache_binary',
    ccacheKeyPrefix: core.getInput('ccache-key-prefix') || 'ccache_cache',

    ccacheDir: ccacheDir,
    compilerCheck: compilerCheck,
    compression: core.getBooleanInput('compression') || true,
    compressionLevel: Number.parseInt(
      core.getInput('compression-level') || '0'
    ),
    maxFiles: maxFiles,
    maxSize: maxSize,
    sloppiness: sloppiness
  }
}
