# Ccache for GH Actions

![CI](https://github.com/jianmingyong/ccache-action/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/jianmingyong/ccache-action/actions/workflows/check-dist.yml/badge.svg)](https://github.com/jianmingyong/ccache-action/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/jianmingyong/ccache-action/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/actions/typescript-action/actions/workflows/codeql-analysis.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

A GitHub action to speed up building using [Ccache](https://ccache.dev/) for
C/C++ projects.

This action will install Ccache, setup environment variables, save the cache,
and restore after the next workflow.

## Usage

```yaml
runs-on: ${{ matrix.os }}

strategy:
  fail-fast: false

  matrix:
    os: ['windows-latest', 'ubuntu-latest', 'macos-13']

# Ensure to set up concurrency per ref per matrix to avoid using the same cache in parallel when pushing multiple commits.
concurrency:
  group: build_${{ github.ref }}_${{ matrix.os }}

steps:
  - uses: actions/checkout@v4

  # Install the latest CMake and Ninja. (This should be placed on top of ccache-action)
  - uses: lukka/get-cmake@latest

  # You are required to set the ccache-key-prefix to be unique per matrix. If you are not building for multiple platform, that will not be required.
  - uses: jianmingyong/ccache-action@main
    with:
      ccache-key-prefix: ccache_cache_${{ matrix.os }}
      max-size: 150M
```

This action should preferably by used after installing all system dependencies
including your preferred compiler.

By default, this action will download the Ccache from GitHub Release and test
for functionality.

However if the installation results in a failure or is not supported by the
target system, it will fall back to compiling Ccache from source.

Hence you should ensure that you have installed a proper `CMake` and a compiler
like `gcc` or `clang`. `MSVC` compilation is also supported if you are using
Windows.

## Action inputs

You can visit
[action.yml](https://github.com/jianmingyong/ccache-action/blob/main/action.yml)
for all possible inputs.

## Why use this action?

This action works similarly like
[hendrikmuhs/ccache-action](https://github.com/hendrikmuhs/ccache-action).
However this does not support `Sccache` or any other caching tools.

The difference in this action is the ability to support incremental cache and
only store **one** copy of the cache per ref per matrix.

Each incremental cache is hashed to check for updates and will delete the old
cache before uploading the new one resulting in only a single copy of cache.

Incremental cache only works for commits coming from your own Repository. Pull
requests are not supported and will result in creating multiple copies which
will flood your cache.
