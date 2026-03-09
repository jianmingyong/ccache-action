import { SemVer } from "semver"

export interface CCacheBinaryMatrix {
  [os: string]: CCacheBinaryVersionMatrix | undefined
  win32: CCacheBinaryVersionMatrix
  linux: CCacheBinaryVersionMatrix
  darwin: CCacheBinaryVersionMatrix
}

export type CCacheBinaryVersionMatrix = Record<string, CCacheBinaryMetadata>

export interface CCacheBinaryMetadata {
  url: (version: SemVer) => string
  fileType: 'zip' | 'tar'
  pathToBinary: (version: SemVer) => string
}

export const CCACHE_REPOSITORY = 'https://github.com/ccache/ccache'

export const CCACHE_BINARY_SUPPORTED_URL: CCacheBinaryMatrix = {
  win32: {
    '>=4.6.1': {
      url: (version: SemVer) =>
        `https://github.com/ccache/ccache/releases/download/v${version.patch == 0 ? version.major + '.' + version.minor : version.version}/ccache-${version.patch == 0 ? version.major + '.' + version.minor : version.version}-windows-x86_64.zip`,
      fileType: 'zip',
      pathToBinary: (version: SemVer) => `ccache-${version.patch == 0 ? version.major + '.' + version.minor : version.version}-windows-x86_64`
    },

    '>=3.7.8 <4.6.1': {
      url: (version: SemVer) =>
        `https://github.com/ccache/ccache/releases/download/v${version.patch == 0 ? version.major + '.' + version.minor : version.version}/ccache-${version.patch == 0 ? version.major + '.' + version.minor : version.version}-windows-64.zip`,
      fileType: 'zip',
      pathToBinary: (version: SemVer) => `ccache-${version.patch == 0 ? version.major + '.' + version.minor : version.version}-windows-64`
    }
  },

  linux: {
    '>=4.13': {
      url: (version: SemVer) =>
        `https://github.com/ccache/ccache/releases/download/v${version.patch == 0 ? version.major + '.' + version.minor : version.version}/ccache-${version.patch == 0 ? version.major + '.' + version.minor : version.version}-linux-x86_64-glibc.tar.xz`,
      fileType: 'tar',
      pathToBinary: (version: SemVer) => `ccache-${version.patch == 0 ? version.major + '.' + version.minor : version.version}-linux-x86_64-glibc`
    },

    '>=4.6.1 <4.13': {
      url: (version: SemVer) =>
        `https://github.com/ccache/ccache/releases/download/v${version.patch == 0 ? version.major + '.' + version.minor : version.version}/ccache-${version.patch == 0 ? version.major + '.' + version.minor : version.version}-linux-x86_64.tar.xz`,
      fileType: 'tar',
      pathToBinary: (version: SemVer) => `ccache-${version.patch == 0 ? version.major + '.' + version.minor : version.version}-linux-x86_64`
    }
  },

  darwin: {
    '>=4.8': {
      url: (version: SemVer) =>
        `https://github.com/ccache/ccache/releases/download/v${version.patch == 0 ? version.major + '.' + version.minor : version.version}/ccache-${version.patch == 0 ? version.major + '.' + version.minor : version.version}-darwin.tar.gz`,
      fileType: 'tar',
      pathToBinary: (version: SemVer) => `ccache-${version.patch == 0 ? version.major + '.' + version.minor : version.version}-darwin`
    }
  }
}

export const CCACHE_CONFIGURE_OPTIONS =
  '-D CMAKE_BUILD_TYPE=Release -D ENABLE_TESTING=OFF -D REDIS_STORAGE_BACKEND=ON'
