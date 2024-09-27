import * as crypto from 'crypto'
import * as fs from 'fs'

import * as glob from '@actions/glob'

/**
 * Calculates a SHA-256 hash for the set of files that match the given path pattern(s).
 * @param patterns - A single path pattern or multiple patterns.
 * @returns A SHA-256 hash for the set of files, or an empty string if no files are matched.
 */
export async function hashFiles(...patterns: string[]): Promise<string> {
  const globber = await glob.create(patterns.join('\n'), {
    matchDirectories: false
  })

  const files = await globber.glob()

  if (files.length === 0) {
    return ''
  }

  // helper function to limit concurrency
  function concurrent<V>(
    concurrency: number,
    funcs: (() => Promise<V>)[]
  ): Promise<V[]> {
    return new Promise((resolve, reject) => {
      let index = -1
      const p: Promise<V>[] = []
      for (let i = 0; i < Math.max(1, Math.min(concurrency, funcs.length)); i++)
        runPromise()
      function runPromise() {
        if (++index < funcs.length)
          (p[p.length] = funcs[index]()).then(runPromise).catch(reject)
        else if (index === funcs.length)
          Promise.all(p).then(resolve).catch(reject)
      }
    })
  }

  // Helper function to calculate SHA-256 hash of a file
  async function hashFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256')
      const stream = fs.createReadStream(filePath)

      stream.on('data', data => hash.update(data))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', err => reject(err))
    })
  }

  // Calculate hashes for each file
  const fileHashes = await concurrent(
    16,
    files.map(file => () => hashFile(file))
  )

  // Combine all file hashes and calculate a final hash
  const combinedHash = crypto.createHash('sha256')
  fileHashes.forEach(hash => combinedHash.update(hash))

  return combinedHash.digest('hex')
}
