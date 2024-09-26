import * as semver from 'semver'

import * as utils from '../src/utils'

const tags = ['v1.0.0', 'v1.0.1', 'v1.1.0', 'v2.0.0']
const latestTag = 'v2.0.0'

describe('utils.ts', () => {
  it('Can find version', () => {
    expect(utils.findVersion(tags, '*')).toMatchObject<utils.CCacheVersion>({
      tag: latestTag,
      version: semver.coerce(latestTag, { loose: true })!
    })
  })

  it('Cannot find version', () => {
    expect(() => utils.findVersion(tags, '^3.0.0')).toThrow(
      new Error('Could not find a version that satisfy ^3.0.0')
    )
  })
})
