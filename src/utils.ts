import * as semver from 'semver'

export interface CCacheVersion {
  tag: string
  version: semver.SemVer
}

export function findVersion(
  tags: readonly string[],
  versionRange: string | semver.Range
): CCacheVersion {
  const versions: CCacheVersion[] = []

  tags.forEach((tag: string) => {
    const result = semver.coerce(tag, { loose: true })
    if (result !== null) versions.push({ tag: tag, version: result })
  })

  const version = semver.maxSatisfying(
    versions.map(v => v.version),
    versionRange
  )

  if (version === null) {
    throw new Error(
      `Could not find a version that satisfy ${(versionRange as semver.Range)?.range ?? versionRange}`
    )
  }

  return versions.find((v: CCacheVersion) => semver.eq(v.version, version))!
}
