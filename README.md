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

<!-- prettier-ignore-start -->
```yaml
on:
  pull_request:
    branches:
      - main
  push:
    branches:
      - main

# You must set the actions permission to write in order for incremental
# cache to work.
#
# Pull request will always be set to read for public repository.
permissions:
  contents: read
  actions: write

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        os: ['windows-latest', 'ubuntu-latest', 'macos-13']

    # Ensure to set up concurrency per ref per matrix to avoid using the same
    # cache in parallel when pushing multiple commits.
    concurrency:
      group: build_${{ github.ref }}_${{ matrix.os }}

    runs-on: ${{ matrix.os }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          submodules: recursive

      # Install the latest CMake and Ninja.
      - name: Install CMake
        uses: lukka/get-cmake@latest

      # You are required to set the ccache-key-prefix to be unique per matrix.
      # If you are not building for multiple platform, that will not be required.
      - name: Setup Ccache
        uses: jianmingyong/ccache-action@v1
        with:
          ccache-key-prefix: ccache_cache_${{ matrix.os }}
          max-size: 150M

      # This is optional if your project uses vcpkg as a submodule.
      - name: run-vcpkg
        uses: lukka/run-vcpkg@v11.5

      # This will run cmake using CMake presets.
      - uses: lukka/run-cmake@v10
        with:
          configurePreset: 'your-configure-preset'
          configurePresetAdditionalArgs:
            "['-DCMAKE_C_COMPILER_LAUNCHER=ccache', '-DCMAKE_CXX_COMPILER_LAUNCHER=ccache']"
          buildPreset: 'your-build-preset'

      # Alternative way to run CMake with Ccache.
      - run: |
          cmake -D CMAKE_C_COMPILER_LAUNCHER=ccache -D CMAKE_CXX_COMPILER_LAUNCHER=ccache ...
```
<!-- prettier-ignore-end -->

This action should preferably by used after installing all system dependencies
including your preferred compiler.

By default, this action will download the Ccache from GitHub Release and test
for functionality.

However if the installation results in a failure or is not supported by the
target system, it will fall back to compiling Ccache from source.

Hence you should ensure that you have installed a proper `CMake` and a compiler
like `gcc` or `clang`. `MSVC` compilation is also supported if you are using
Windows.

`msys2` is also supported by setting `MSYSTEM` environment variable or using
[msys2/setup-msys2](https://github.com/msys2/setup-msys2) action before
`ccache-action`.

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

## Telling CMake how to use Ccache

Example:

```sh
cmake -D CMAKE_C_COMPILER_LAUNCHER=ccache -D CMAKE_CXX_COMPILER_LAUNCHER=ccache ...
```

Read more from https://github.com/ccache/ccache/wiki/CMake

For MSVC, you can refer to
https://github.com/ccache/ccache/wiki/MS-Visual-Studio#usage-with-cmake
