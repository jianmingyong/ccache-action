import * as os from 'os'
import * as process from 'process'

import { exec, getExecOutput } from '@actions/exec'
import * as io from '@actions/io'

import { CCACHE_CONFIGURE_OPTIONS } from './constants'

export class CMakeHelper {
  private workdir: string

  constructor(workdir: string) {
    this.workdir = workdir
  }

  public async configure(): Promise<number> {
    await this.cmakeCheck()

    if (process.platform === 'win32') {
      if (process.env['MSYSTEM']) {
        // msys2 environment found.
        if (await this.ninjaCheck()) {
          return await exec(
            `msys2 -c`,
            [`cmake ${CCACHE_CONFIGURE_OPTIONS} -G "Ninja" -S . -B build`],
            { cwd: this.workdir }
          )
        } else {
          return await exec(
            `msys2 -c`,
            [
              `cmake ${CCACHE_CONFIGURE_OPTIONS} -G "MSYS Makefiles" -S . -B build`
            ],
            { cwd: this.workdir }
          )
        }
      } else {
        // Not using msys2, fallback to msvc
        const vsVersion = await this.getLatestVisualStudioVersion()
        const arch = os.arch()

        let generator: string
        let platform: string

        if (vsVersion === '2019') {
          generator = '-G "Visual Studio 16 2019"'
        } else if (vsVersion === '2022') {
          generator = '-G "Visual Studio 17 2022"'
        } else {
          throw new Error(`Target version ${vsVersion} is not supported.`)
        }

        if (arch === 'ia32') {
          platform = '-A Win32'
        } else if (arch === 'x64') {
          platform = '-A x64'
        } else if (arch === 'arm') {
          platform = '-A ARM'
        } else if (arch === 'arm64') {
          platform = '-A ARM64'
        } else {
          throw new Error(`Target platform ${arch} is not supported.`)
        }

        return await exec(
          `cmake ${CCACHE_CONFIGURE_OPTIONS} ${generator} ${platform} -S . -B build`,
          [],
          { cwd: this.workdir }
        )
      }
    } else {
      if (await this.ninjaCheck()) {
        return await exec(
          `cmake ${CCACHE_CONFIGURE_OPTIONS} -G "Ninja" -S . -B build`,
          [],
          { cwd: this.workdir }
        )
      } else {
        return await exec(
          `cmake ${CCACHE_CONFIGURE_OPTIONS} -G "Unix Makefiles" -S . -B build`,
          [],
          { cwd: this.workdir }
        )
      }
    }
  }

  public async build(): Promise<number> {
    await this.cmakeCheck()

    if (process.platform === 'win32') {
      if (process.env['MSYSTEM']) {
        return await exec(
          'msys2 -c',
          [`cmake --build build -j ${os.availableParallelism()}`],
          { cwd: this.workdir }
        )
      } else {
        return await exec(
          `cmake --build build --config Release -j ${os.availableParallelism()}`,
          [],
          { cwd: this.workdir }
        )
      }
    } else {
      return await exec(
        `cmake --build build -j ${os.availableParallelism()}`,
        [],
        { cwd: this.workdir }
      )
    }
  }

  public async install(installPrefix: string): Promise<number> {
    await this.cmakeCheck()

    if (process.platform === 'win32') {
      if (process.env['MSYSTEM']) {
        return await exec(
          'msys2 -c',
          [`cmake --install build --prefix ${installPrefix}`],
          { cwd: this.workdir }
        )
      } else {
        return await exec(
          `cmake --install build --config Release --prefix ${installPrefix}`,
          [],
          { cwd: this.workdir }
        )
      }
    } else {
      return await exec(`cmake --install build --prefix ${installPrefix}`, [], {
        cwd: this.workdir
      })
    }
  }

  private async cmakeCheck(): Promise<string> {
    if (process.platform === 'win32' && process.env['MSYSTEM']) {
      const output = await getExecOutput('msys2 -c', ['which cmake'], {
        silent: true,
        ignoreReturnCode: true
      })

      if (output.exitCode !== 0) {
        throw new Error(
          'Unable to locate executable file: cmake. Please verify either the file path exists or the file can be found within a directory specified by the PATH environment variable. Also verify the file has a valid extension for an executable file.'
        )
      }

      return output.stdout.trim()
    }

    return await io.which('cmake', true)
  }

  private async ninjaCheck(): Promise<string> {
    if (process.platform === 'win32' && process.env['MSYSTEM']) {
      const output = await getExecOutput('msys2 -c', ['which ninja'], {
        silent: true,
        ignoreReturnCode: true
      })

      return output.exitCode === 0 ? output.stdout.trim() : ''
    }

    return await io.which('ninja', false)
  }

  private async getLatestVisualStudioVersion(): Promise<string> {
    if (process.platform !== 'win32') return ''

    const output = await getExecOutput(
      '"C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe"',
      ['-latest', '-property', 'catalog_productLineVersion'],
      { silent: true, ignoreReturnCode: true }
    )

    return output.exitCode === 0 ? output.stdout.trim() : ''
  }
}
