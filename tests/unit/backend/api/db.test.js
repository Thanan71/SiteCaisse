import { createRequire } from 'node:module'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const requireFromTest = createRequire(import.meta.url)
const dbModuleId = requireFromTest.resolve('../../../../api/db.cjs')
const supabaseModuleId = requireFromTest.resolve('@supabase/supabase-js')

let previousDbCache
let previousSupabaseCache
let previousEnv

function loadDb({ createClient = vi.fn(() => createClient.client) } = {}) {
  previousDbCache = requireFromTest.cache[dbModuleId]
  previousSupabaseCache = requireFromTest.cache[supabaseModuleId]

  requireFromTest.cache[supabaseModuleId] = {
    id: supabaseModuleId,
    filename: supabaseModuleId,
    loaded: true,
    exports: { createClient },
  }
  delete requireFromTest.cache[dbModuleId]

  return requireFromTest('../../../../api/db.cjs')
}

function createQueryResponse(response) {
  return {
    select: vi.fn(function select() {
      return this
    }),
    eq: vi.fn(function eq() {
      return this
    }),
    limit: vi.fn(function limit() {
      return this
    }),
    single: vi.fn(() => Promise.resolve(response)),
  }
}

function createAwaitableQuery(response) {
  return {
    select: vi.fn(function select() {
      return this
    }),
    order: vi.fn(function order() {
      return this
    }),
    // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are awaitable thenables.
    then(resolve, reject) {
      return Promise.resolve(response).then(resolve, reject)
    },
  }
}

beforeEach(() => {
  previousEnv = { ...process.env }
  delete process.env.VITE_PUBLIC_SUPABASE_URL
  delete process.env.VITE_PUBLIC_SUPABASE_ANON_KEY
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
})

afterEach(() => {
  delete requireFromTest.cache[dbModuleId]
  delete requireFromTest.cache[supabaseModuleId]

  if (previousDbCache) requireFromTest.cache[dbModuleId] = previousDbCache
  if (previousSupabaseCache) requireFromTest.cache[supabaseModuleId] = previousSupabaseCache

  process.env = previousEnv
})

describe('db', () => {
  it('initialise un client Supabase singleton avec la cle service role', () => {
    const client = { from: vi.fn() }
    const createClient = vi.fn(() => client)
    const db = loadDb({ createClient })

    process.env.VITE_PUBLIC_SUPABASE_URL = 'https://sitecaisse.supabase.co'
    process.env.VITE_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'

    expect(db.getSupabase()).toBe(client)
    expect(db.getSupabase()).toBe(client)
    expect(createClient).toHaveBeenCalledTimes(1)
    expect(createClient).toHaveBeenCalledWith(
      'https://sitecaisse.supabase.co',
      'service-role-key',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    )
  })

  it('utilise la cle anon si aucune cle service role n est disponible', () => {
    const client = { from: vi.fn() }
    const createClient = vi.fn(() => client)
    const db = loadDb({ createClient })

    process.env.VITE_PUBLIC_SUPABASE_URL = 'https://sitecaisse.supabase.co'
    process.env.VITE_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'

    expect(db.getSupabase()).toBe(client)
    expect(createClient).toHaveBeenCalledWith(
      'https://sitecaisse.supabase.co',
      'anon-key',
      expect.any(Object),
    )
  })

  it('refuse de demarrer sans les variables Supabase publiques', () => {
    const db = loadDb()

    expect(() => db.getSupabase()).toThrow(
      'Variables VITE_PUBLIC_SUPABASE_URL et VITE_PUBLIC_SUPABASE_ANON_KEY requises',
    )
  })

  it('recupere la premiere ligne correspondant aux filtres', async () => {
    const query = createQueryResponse({ data: { id: 1, nom: 'Alice' }, error: null })
    const client = { from: vi.fn(() => query) }
    const createClient = vi.fn(() => client)
    const db = loadDb({ createClient })

    process.env.VITE_PUBLIC_SUPABASE_URL = 'https://sitecaisse.supabase.co'
    process.env.VITE_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'

    await expect(db.getFirst('users', { role: 'admin', est_actif: true })).resolves.toEqual({
      id: 1,
      nom: 'Alice',
    })
    expect(client.from).toHaveBeenCalledWith('users')
    expect(query.select).toHaveBeenCalledWith('*')
    expect(query.eq).toHaveBeenNthCalledWith(1, 'role', 'admin')
    expect(query.eq).toHaveBeenNthCalledWith(2, 'est_actif', true)
    expect(query.limit).toHaveBeenCalledWith(1)
    expect(query.single).toHaveBeenCalledTimes(1)
  })

  it('retourne null quand Supabase signale une ligne absente', async () => {
    const query = createQueryResponse({ data: null, error: { code: 'PGRST116' } })
    const client = { from: vi.fn(() => query) }
    const db = loadDb({ createClient: vi.fn(() => client) })

    process.env.VITE_PUBLIC_SUPABASE_URL = 'https://sitecaisse.supabase.co'
    process.env.VITE_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'

    await expect(db.getFirst('users')).resolves.toBeNull()
  })

  it('propage les erreurs Supabase de getFirst', async () => {
    const error = new Error('Supabase unavailable')
    const query = createQueryResponse({ data: null, error })
    const client = { from: vi.fn(() => query) }
    const db = loadDb({ createClient: vi.fn(() => client) })

    process.env.VITE_PUBLIC_SUPABASE_URL = 'https://sitecaisse.supabase.co'
    process.env.VITE_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'

    await expect(db.getFirst('users')).rejects.toThrow('Supabase unavailable')
  })

  it('recupere toutes les lignes avec tri optionnel', async () => {
    const query = createAwaitableQuery({
      data: [
        { id: 2, nom: 'Bruno' },
        { id: 1, nom: 'Alice' },
      ],
      error: null,
    })
    const client = { from: vi.fn(() => query) }
    const db = loadDb({ createClient: vi.fn(() => client) })

    process.env.VITE_PUBLIC_SUPABASE_URL = 'https://sitecaisse.supabase.co'
    process.env.VITE_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'

    await expect(
      db.getAll('users', 'id, nom', { order: { column: 'nom', ascending: true } }),
    ).resolves.toEqual([
      { id: 2, nom: 'Bruno' },
      { id: 1, nom: 'Alice' },
    ])
    expect(query.select).toHaveBeenCalledWith('id, nom')
    expect(query.order).toHaveBeenCalledWith('nom', { ascending: true })
  })

  it('retourne un tableau vide pour getAll sans donnees et propage les erreurs', async () => {
    const emptyQuery = createAwaitableQuery({ data: null, error: null })
    const errorQuery = createAwaitableQuery({ data: null, error: new Error('select failed') })
    const client = { from: vi.fn().mockReturnValueOnce(emptyQuery).mockReturnValueOnce(errorQuery) }
    const db = loadDb({ createClient: vi.fn(() => client) })

    process.env.VITE_PUBLIC_SUPABASE_URL = 'https://sitecaisse.supabase.co'
    process.env.VITE_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'

    await expect(db.getAll('users')).resolves.toEqual([])
    await expect(db.getAll('users')).rejects.toThrow('select failed')
  })
})
