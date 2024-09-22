import * as exec from '@actions/exec'
import { jest, describe, beforeEach, it } from '@jest/globals'

import * as git from '../src/git-helper'

let execMock: jest.SpiedFunction<typeof exec.exec>

describe('git-helper.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    execMock = jest.spyOn(exec, 'exec')
  })

  it('clone', async () => {
    const cloneMock = jest.spyOn(git, 'clone')
    const path = '/some/path'

    execMock.mockImplementation((commandLine: string, args?: string[]) => {
      return new Promise(resolve => {
        if (commandLine === 'git clone' && args !== undefined && path in args) {
          resolve(0)
        } else {
          resolve(1)
        }
      })
    })

    await git.clone(path)
    expect(cloneMock).toHaveReturned()
  })

  it('fetch', async () => {
    const fetchMock = jest.spyOn(git, 'fetch')
    const path = '/some/path'

    execMock.mockImplementation(
      (commandLine: string, args?: string[], options?: exec.ExecOptions) => {
        return new Promise(resolve => {
          if (
            commandLine === 'git fetch' &&
            args !== undefined &&
            options?.cwd === path
          ) {
            resolve(0)
          } else {
            resolve(1)
          }
        })
      }
    )

    await git.fetch(path)

    expect(fetchMock).toHaveReturned()
  })

  it('checkout', async () => {
    const checkoutMock = jest.spyOn(git, 'checkout')
    const path = '/some/path'
    const branch = 'some-branch'

    execMock.mockImplementation(
      (commandLine: string, args?: string[], options?: exec.ExecOptions) => {
        return new Promise(resolve => {
          if (
            commandLine === 'git checkout' &&
            args !== undefined &&
            branch in args &&
            options?.cwd === path
          ) {
            resolve(0)
          } else {
            resolve(1)
          }
        })
      }
    )

    await git.checkout(path, branch)

    expect(checkoutMock).toHaveReturned()
  })

  it('tagList', async () => {
    const tagListMock = jest.spyOn(git, 'tagList')
    const path = '/some/path'

    execMock.mockImplementation(
      (commandLine: string, args?: string[], options?: exec.ExecOptions) => {
        return new Promise(resolve => {
          if (
            commandLine === 'git tag' &&
            args !== undefined &&
            options?.cwd === path &&
            options?.listeners?.stdline !== undefined
          ) {
            options?.listeners.stdline('test')
            resolve(0)
          } else {
            resolve(1)
          }
        })
      }
    )

    await git.tagList(path)

    expect(tagListMock).toHaveReturned()
  })
})
