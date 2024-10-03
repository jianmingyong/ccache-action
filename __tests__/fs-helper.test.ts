import * as fsHelper from '../src/fs-helper'

describe('fs-helper.ts', () => {
  it('directoryExists', async () => {
    const mock = jest.spyOn(fsHelper, 'directoryExists')
    const result = await fsHelper.directoryExists(__dirname)

    expect(mock).toHaveReturned()
    expect(result).toBeTruthy()

    const result2 = await fsHelper.directoryExists(__dirname + '.testFails')
    expect(result2).toBeFalsy()
  })
})
