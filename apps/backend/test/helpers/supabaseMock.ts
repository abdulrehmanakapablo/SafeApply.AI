// Fake supabase-js client. `from(table)` returns a chain where every builder
// method records itself and returns the chain; awaiting it (or .single() /
// .maybeSingle()) resolves to the next result queued for that table.
import { vi } from 'vitest'

type Result = { data: unknown; error: unknown }
type Call = { table: string; method: string; args: unknown[] }

const EMPTY: Result = { data: null, error: null }

export function createSupabaseMock() {
  const queues = new Map<string, Result[]>()
  const calls: Call[] = []
  const next = (table: string) => queues.get(table)?.shift() ?? EMPTY

  function chain(table: string) {
    let result: Result | undefined
    const take = () => (result ??= next(table))
    const target: Record<string, unknown> = {}
    const proxy: any = new Proxy(target, {
      get(_t, prop: string) {
        if (prop === 'then') {
          return (ok: (r: Result) => unknown, fail?: (e: unknown) => unknown) => Promise.resolve(take()).then(ok, fail)
        }
        if (prop === 'single' || prop === 'maybeSingle') {
          return (...args: unknown[]) => {
            calls.push({ table, method: prop, args })
            return Promise.resolve(take())
          }
        }
        return (...args: unknown[]) => {
          calls.push({ table, method: prop, args })
          return proxy
        }
      },
    })
    return proxy
  }

  const ok = () => vi.fn().mockResolvedValue({ data: {}, error: null })
  const client = {
    from: vi.fn((table: string) => {
      calls.push({ table, method: 'from', args: [table] })
      return chain(table)
    }),
    auth: {
      signInWithPassword: ok(),
      getUser: ok(),
      resetPasswordForEmail: ok(),
      admin: { deleteUser: ok(), updateUserById: ok(), createUser: ok() },
    },
    storage: { from: vi.fn(() => ({ upload: ok() })) },
  }

  return {
    client,
    calls,
    queue(table: string, result: Result) {
      if (!queues.has(table)) queues.set(table, [])
      queues.get(table)!.push(result)
    },
  }
}
