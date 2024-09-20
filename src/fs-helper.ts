import { stat } from 'fs'
import { promisify } from 'util'

export async function directoryExists(path: string): Promise<boolean> {
  try {
    const stats = await promisify(stat)(path)
    return stats.isDirectory()
  } catch {
    return false
  }
}