import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Firestore simulado en memoria: registra cada lectura y escritura por ruta, para comprobar que la
 * Partida Rápida solo toca quickRooms/** y nunca groups/** (ni users/).
 */
const fake = vi.hoisted(() => {
  const store = new Map<string, Record<string, unknown>>()
  const writes: string[] = []
  const reads: string[] = []
  const ref = (path: string) => ({ path, id: path.split('/').at(-1)! })
  const snap = (path: string) => ({
    id: path.split('/').at(-1)!,
    exists: () => store.has(path),
    data: () => store.get(path),
  })
  const children = (col: string) =>
    [...store.keys()].filter((k) => k.startsWith(col + '/') && k.split('/').length === col.split('/').length + 1)
  const write = (path: string, data: Record<string, unknown> | null, merge = false) => {
    writes.push(path)
    if (data === null) store.delete(path)
    else store.set(path, merge ? { ...store.get(path), ...data } : data)
  }
  return { store, writes, reads, ref, snap, children, write }
})

vi.mock('../../config/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => {
  class Timestamp {
    constructor(private ms: number) {}
    static fromMillis(ms: number) {
      return new Timestamp(ms)
    }
    toMillis() {
      return this.ms
    }
  }
  return {
    Timestamp,
    serverTimestamp: () => Timestamp.fromMillis(1_000),
    doc: (_db: unknown, path: string) => fake.ref(path),
    collection: (_db: unknown, path: string) => fake.ref(path),
    getDocFromServer: async (r: { path: string }) => {
      fake.reads.push(r.path)
      return fake.snap(r.path)
    },
    getDocsFromServer: async (r: { path: string }) => {
      fake.reads.push(r.path)
      return { docs: fake.children(r.path).map((p) => fake.snap(p)) }
    },
    setDoc: async (r: { path: string }, d: Record<string, unknown>) => fake.write(r.path, d),
    updateDoc: async (r: { path: string }, d: Record<string, unknown>) => fake.write(r.path, d, true),
    deleteDoc: async (r: { path: string }) => fake.write(r.path, null),
    runTransaction: async (_db: unknown, fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        get: async (r: { path: string }) => {
          fake.reads.push(r.path)
          return fake.snap(r.path)
        },
        set: (r: { path: string }, d: Record<string, unknown>) => fake.write(r.path, d),
      }),
    writeBatch: () => {
      const ops: (() => void)[] = []
      return {
        delete: (r: { path: string }) => ops.push(() => fake.write(r.path, null)),
        commit: async () => ops.forEach((op) => op()),
      }
    },
    onSnapshot: (r: { path: string }) => {
      fake.reads.push(r.path)
      return () => {}
    },
  }
})

const svc = await import('../quick')
const { readQuickRoom } = await import('../quickDocs')
const { BOT_PROFILES } = await import('../../game/bots')

const host = { uid: 'host', apodo: 'Host', avatar: 'sol' as const }
const ana = { uid: 'ana', apodo: 'Ana', avatar: 'luna' as const }

beforeEach(() => {
  fake.store.clear()
  fake.writes.length = 0
  fake.reads.length = 0
})

describe('servicios de Partida Rápida', () => {
  it('una partida completa solo toca quickRooms/** (nunca groups/ ni users/)', async () => {
    const code = await svc.createQuickRoom(host, true)
    let room = await svc.joinQuickRoom(code, ana)
    expect(room.status).toBe('lobby')
    await svc.addQuickBot(code, BOT_PROFILES[0]!, 1)
    await svc.startQuickRoom(code)
    await svc.syncQuickProgress(code, ana.uid, 1, { correctas: 3, falladas: 1, finished: false })
    expect(await svc.getQuickPlayer(code, ana.uid)).toMatchObject({ correctas: 3, falladas: 1, finished: false, round: 1 })
    await svc.markQuickFinished(code, ana.uid)
    expect((await svc.getQuickPlayer(code, ana.uid))?.finished).toBe(true)
    await svc.finishQuickRoom(code)
    room = readQuickRoom(code, fake.store.get(`quickRooms/${code}`)!)
    expect(room.status).toBe('finished')
    await svc.rematchQuickRoom(room, ['q1'])
    const rev = readQuickRoom(code, fake.store.get(`quickRooms/${code}`)!)
    expect([rev.status, rev.round, rev.evitar]).toEqual(['lobby', 2, ['q1']])
    expect(rev.seed).not.toBe(room.seed)
    await svc.resetQuickPlayer(code, ana.uid, 2)
    await svc.removeQuickPlayer(code, BOT_PROFILES[0]!.uid)
    await svc.leaveQuickRoom(code, ana.uid)
    await svc.closeQuickRoom(code)

    expect(fake.writes.length).toBeGreaterThan(8)
    for (const p of [...fake.writes, ...fake.reads]) expect(p).toMatch(/^quickRooms\/[A-Z2-9]{5}(\/players(\/[\w-]+)?)?$/)
    expect(fake.store.size).toBe(0)
  })

  it('crear con "Solo pantalla" no crea al anfitrión como jugador', async () => {
    const code = await svc.createQuickRoom(host, false)
    expect(fake.store.has(`quickRooms/${code}/players/host`)).toBe(false)
    const d = fake.store.get(`quickRooms/${code}`)!
    expect(d.hostPlays).toBe(false)
    expect(d.status).toBe('lobby')
  })

  it('no se puede entrar a una sala empezada, llena o inexistente', async () => {
    await expect(svc.joinQuickRoom('ZZZZZ', ana)).rejects.toThrow(/No existe/)
    await expect(svc.joinQuickRoom('A1', ana)).rejects.toThrow(/5 caracteres/)
    const code = await svc.createQuickRoom(host, true)
    for (let i = 0; i < 19; i++) await svc.joinQuickRoom(code, { ...ana, uid: `p${i}` })
    await expect(svc.joinQuickRoom(code, ana)).rejects.toThrow(/llena/)
    await svc.startQuickRoom(code)
    await expect(svc.joinQuickRoom(code, { ...ana, uid: 'tarde' })).rejects.toThrow(/empezó/)
    // Quien ya estaba dentro puede volver a entrar (p. ej. recargó la página).
    await expect(svc.joinQuickRoom(code, { ...ana, uid: 'p3' })).resolves.toMatchObject({ code })
  })

  it('reintenta con otro código si el primero ya existe', async () => {
    const primero = await svc.createQuickRoom(host, true)
    const random = vi.spyOn(Math, 'random')
    // Fuerza el mismo código una vez y luego deja el azar normal.
    const letras = primero.split('').map((c) => ('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.indexOf(c) + 0.5) / 32)
    for (const l of letras) random.mockReturnValueOnce(l)
    const segundo = await svc.createQuickRoom(host, true)
    random.mockRestore()
    expect(segundo).not.toBe(primero)
  })
})
