import * as exec from '@actions/exec'

import * as git from '../src/git-helper'

let execMock: jest.SpiedFunction<typeof exec.exec>
let getExecOutputMock: jest.SpiedFunction<typeof exec.getExecOutput>

describe('git-helper.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    execMock = jest.spyOn(exec, 'exec')
    getExecOutputMock = jest.spyOn(exec, 'getExecOutput')
  })

  it('clone', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    execMock.mockImplementation((commandLine: string, args?: string[]) => {
      return new Promise(resolve => {
        if (commandLine.startsWith('git clone')) {
          resolve(0)
        } else {
          resolve(1)
        }
      })
    })

    const cloneMock = jest.spyOn(git, 'clone')
    const result = await git.clone('/some/path')

    expect(cloneMock).toHaveReturned()
    expect(result).toStrictEqual(0)
  })

  it('fetch', async () => {
    const path = '/some/path'

    execMock.mockImplementation(
      (commandLine: string, args?: string[], options?: exec.ExecOptions) => {
        return new Promise(resolve => {
          if (commandLine.startsWith('git fetch') && options?.cwd === path) {
            resolve(0)
          } else {
            resolve(1)
          }
        })
      }
    )

    const fetchMock = jest.spyOn(git, 'fetch')
    const result = await git.fetch(path)

    expect(fetchMock).toHaveReturned()
    expect(result).toStrictEqual(0)

    const result2 = await git.fetch('')
    expect(result2).toStrictEqual(1)
  })

  it('checkout', async () => {
    const path = '/some/path'
    const branch = 'some-branch'

    execMock.mockImplementation(
      (commandLine: string, args?: string[], options?: exec.ExecOptions) => {
        return new Promise(resolve => {
          if (commandLine.startsWith('git checkout') && options?.cwd === path) {
            resolve(0)
          } else {
            resolve(1)
          }
        })
      }
    )

    const checkoutMock = jest.spyOn(git, 'checkout')
    const result = await git.checkout(path, branch)

    expect(checkoutMock).toHaveBeenCalled()
    expect(result).toStrictEqual(0)

    const result2 = await git.checkout('', branch)
    expect(result2).toStrictEqual(1)
  })

  it('tagList', async () => {
    const path = '/some/path'
    const output = ['1.0.0', '1.0.1']

    getExecOutputMock.mockImplementation(
      (commandLine: string, _args?: string[], options?: exec.ExecOptions) => {
        return new Promise(resolve => {
          if (commandLine.startsWith('git tag') && options?.cwd === path) {
            resolve({ exitCode: 0, stdout: output.join('\n'), stderr: '' })
          } else {
            resolve({ exitCode: 1, stdout: '', stderr: '' })
          }
        })
      }
    )

    const tagListMock = jest.spyOn(git, 'tagList')
    const result = await git.tagList(path)

    expect(tagListMock).toHaveBeenCalled()
    expect(result).toHaveLength(output.length)
    output.forEach(o => {
      expect(result).toContain(o)
    })

    const result2 = await git.tagList('')
    expect(result2).toHaveLength(0)
  })
})
