import { vi } from 'vitest'

export async function invokeRoute(router, method, path, request = {}) {
  const handlers = collectHandlers(router, method, path)
  const req = {
    body: {},
    headers: {},
    params: {},
    query: {},
    ...request,
  }
  const res = createResponse()

  await runHandlers(handlers, req, res)

  return { req, res }
}

function collectHandlers(router, method, path) {
  const routeLayer = router.stack.find(
    (layer) => layer.route?.path === path && layer.route.methods[method],
  )

  if (!routeLayer) {
    throw new Error(`Route ${method.toUpperCase()} ${path} introuvable`)
  }

  const handlers = []

  for (const layer of router.stack) {
    if (layer === routeLayer) {
      handlers.push(...layer.route.stack.map((routeStack) => routeStack.handle))
      break
    }

    if (!layer.route) {
      handlers.push(layer.handle)
    }
  }

  return handlers
}

function createResponse() {
  const res = {
    body: undefined,
    finished: false,
    statusCode: 200,
  }

  res.status = vi.fn((statusCode) => {
    res.statusCode = statusCode
    return res
  })
  res.json = vi.fn((body) => {
    res.body = body
    res.finished = true
    return res
  })
  res.send = vi.fn((body) => {
    res.body = body
    res.finished = true
    return res
  })

  return res
}

async function runHandlers(handlers, req, res, index = 0) {
  if (index >= handlers.length || res.finished) return

  const handler = handlers[index]
  let nextCalled = false

  await new Promise((resolve, reject) => {
    const next = (err) => {
      nextCalled = true
      if (err) {
        reject(err)
        return
      }

      runHandlers(handlers, req, res, index + 1).then(resolve, reject)
    }

    Promise.resolve(handler(req, res, next)).then(() => {
      if (!nextCalled) resolve()
    }, reject)
  })
}
