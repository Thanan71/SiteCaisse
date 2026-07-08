import { createRequire } from 'node:module'
import path from 'node:path'

const requireFromHelper = createRequire(import.meta.url)

export function loadCjsWithMocks(modulePathFromRoot, mocksFromRoot = {}) {
  const moduleId = resolveFromRoot(modulePathFromRoot)
  const previousCacheEntries = new Map()

  for (const [mockPathFromRoot, exports] of Object.entries(mocksFromRoot)) {
    const mockId = resolveFromRoot(mockPathFromRoot)
    previousCacheEntries.set(mockId, requireFromHelper.cache[mockId])
    requireFromHelper.cache[mockId] = {
      id: mockId,
      filename: mockId,
      loaded: true,
      exports,
    }
  }

  previousCacheEntries.set(moduleId, requireFromHelper.cache[moduleId])
  delete requireFromHelper.cache[moduleId]

  const loaded = requireFromHelper(moduleId)

  function restore() {
    delete requireFromHelper.cache[moduleId]

    for (const [id, previous] of previousCacheEntries.entries()) {
      if (previous) {
        requireFromHelper.cache[id] = previous
      } else {
        delete requireFromHelper.cache[id]
      }
    }
  }

  return { loaded, restore }
}

function resolveFromRoot(modulePathFromRoot) {
  return requireFromHelper.resolve(path.join(process.cwd(), modulePathFromRoot))
}
