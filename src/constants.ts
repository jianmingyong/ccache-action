export interface CCacheBinaryMatrix {
  [os: string]: CCacheBinaryVersionMatrix | undefined
  win32: CCacheBinaryVersionMatrix
  linux: CCacheBinaryVersionMatrix
  darwin: CCacheBinaryVersionMatrix
}

export interface CCacheBinaryVersionMatrix {
  [version: string]: CCacheBinaryMetadata
}

export interface CCacheBinaryMetadata {
  url: (version: string) => string
  fileType: 'zip' | 'tar'
  pathToBinary: (version: string) => string
}

export const CCACHE_REPOSITORY = 'https://github.com/ccache/ccache'

export const CCACHE_BINARY_SUPPORTED_URL: CCacheBinaryMatrix = {
  win32: {
    '>=4.6.1': {
      url: (version: string) =>
        `https://github.com/ccache/ccache/releases/download/v${version}/ccache-${version}-windows-x86_64.zip`,
      fileType: 'zip',
      pathToBinary: (version: string) => `ccache-${version}-windows-x86_64`
    },

    '>=3.7.8 <4.6.1': {
      url: (version: string) =>
        `https://github.com/ccache/ccache/releases/download/v${version}/ccache-${version}-windows-64.zip`,
      fileType: 'zip',
      pathToBinary: (version: string) => `ccache-${version}-windows-64`
    }
  },

  linux: {
    '>=4.6.1': {
      url: (version: string) =>
        `https://github.com/ccache/ccache/releases/download/v${version}/ccache-${version}-linux-x86_64.tar.xz`,
      fileType: 'tar',
      pathToBinary: (version: string) => `ccache-${version}-linux-x86_64`
    }
  },

  darwin: {
    '>=4.8': {
      url: (version: string) =>
        `https://github.com/ccache/ccache/releases/download/v${version}/ccache-${version}-darwin.tar.gz`,
      fileType: 'tar',
      pathToBinary: (version: string) => `ccache-${version}-darwin`
    }
  }
}

export const CCACHE_CONFIGURE_OPTIONS =
  '-D CMAKE_BUILD_TYPE=Release -D ENABLE_TESTING=OFF -D REDIS_STORAGE_BACKEND=ON'
