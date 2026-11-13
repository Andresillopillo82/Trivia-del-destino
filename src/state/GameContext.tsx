import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { GAME_CONFIG } from '../config/gameConfig'
import { firebaseConfigured } from '../config/firebase'
import { answersOfDay, pendingChallengesFor } from '../game/challenges'
import { isSeasonOver, msUntilNextDay, seasonDay } from '../game/day'
import { isExpired, timeoutResult } from '../game/scoring'
import { computeStandings } from '../game/standings'
import type { PlayerInfo, StandingRow } from '../game/types'
import { closeDaily, watchAnswers } from '../services/answers'
import { ensureAnonymousUser } from '../services/auth'
import { resolveChallenge, watchChallenges } from '../services/challenges'
import { serverNow } from '../services/clock'
import { watchOnline } from '../services/connectivity'
import { friendlyError, isPermissionDenied } from '../services/errors'
import { watchCoAdmin, watchGroup } from '../services/groups'
import { watchPlayers } from '../services/players'
import { touchProfile, watchProfile } from '../services/users'
import type { Group, LiveAnswer, LiveChallenge, UserProfile } from '../services/types'

export type SessionStatus = 'sin-configurar' | 'conectando' | 'error' | 'listo'

export interface GameContextValue {
  status: SessionStatus
  sessionError: string | null
  retrySession: () => void
  online: boolean

  uid: string | null
  /** undefined mientras carga; null si aún no eligió apodo. */
  profile: UserProfile | null | undefined

  /** undefined mientras carga; null si no tiene grupo. */
  group: Group | null | undefined
  /** Mensaje si el grupo dejó de estar disponible (borrado, expulsión…). */
  groupError: string | null
  groupLoaded: boolean
  players: PlayerInfo[]
  answers: LiveAnswer[]
  challenges: LiveChallenge[]

  day: number
  seasonOver: boolean
  standings: StandingRow[]
  isAdmin: boolean
  /** Si el usuario participa como jugador en el grupo actual. */
  isPlayer: boolean
  myRow: StandingRow | undefined
  /** Mis respuestas de hoy, en orden (0, 1, 2). */
  myTodayAnswers: LiveAnswer[]
  /** La carta en juego (volteada o con la pregunta abierta), o la última respondida hoy. */
  myToday: LiveAnswer | undefined
  /** Preguntas de reto que me toca responder (obligatorias antes de sacar otra carta). */
  myPending: LiveChallenge[]
  /** Puede sacar la siguiente carta: quedan cartas hoy, la anterior está respondida y no debe retos. */
  canDrawCard: boolean
  /** El comodín de hoy sigue sin usar. */
  comodinDisponible: boolean
}

const GameContext = createContext<GameContextValue | null>(null)

/** Reintentos ante "permiso denegado" transitorio (token o ficha recién creados). */
const MAX_REINTENTOS = 3

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame debe usarse dentro de <GameProvider>')
  return ctx
}

/** Día de temporada que se recalcula solo al llegar la medianoche del grupo. */
function useSeasonDay(group: Group | null | undefined): number {
  const [, setTick] = useState(0)
  const inicio = group?.fechaInicioMs
  useEffect(() => {
    if (inicio === undefined) return
    let t: number
    const programar = () => {
      t = window.setTimeout(() => {
        setTick((n) => n + 1)
        programar()
      }, Math.min(msUntilNextDay(inicio, serverNow()) + 500, 60_000))
    }
    programar()
    return () => window.clearTimeout(t)
  }, [inicio])
  return group ? seasonDay(group.fechaInicioMs, group.dayOffset, serverNow()) : 0
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>(firebaseConfigured ? 'conectando' : 'sin-configurar')
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)
  const [online, setOnline] = useState(true)
  const [uid, setUid] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined)
  const [group, setGroup] = useState<Group | null | undefined>(undefined)
  const [groupError, setGroupError] = useState<string | null>(null)
  const [players, setPlayers] = useState<PlayerInfo[] | null>(null)
  const [answers, setAnswers] = useState<LiveAnswer[] | null>(null)
  const [challenges, setChallenges] = useState<LiveChallenge[] | null>(null)
  /** Código del grupo según el perfil confirmado por el servidor. */
  const [code, setCode] = useState<string | null | undefined>(undefined)

  useEffect(() => watchOnline(setOnline), [])

  // Sesión anónima.
  useEffect(() => {
    if (!firebaseConfigured) return
    let cancelado = false
    setStatus('conectando')
    ensureAnonymousUser()
      .then((id) => {
        if (cancelado) return
        setUid(id)
        setStatus('listo')
      })
      .catch((e: unknown) => {
        if (cancelado) return
        setSessionError(friendlyError(e, 'No se pudo iniciar la sesión.'))
        setStatus('error')
      })
    return () => {
      cancelado = true
    }
  }, [intento])

  const retrySession = useCallback(() => setIntento((n) => n + 1), [])

  // Perfil. Justo tras el login anónimo, Firestore puede hacer la primera lectura sin el token
  // nuevo y recibir "permiso denegado": se reintenta unas veces antes de mostrar error.
  const [reintentoPerfil, setReintentoPerfil] = useState(0)
  useEffect(() => {
    if (!uid) return
    let t: number | undefined
    const un = watchProfile(
      uid,
      (p, confirmado) => {
        setProfile(p)
        // El grupo solo cambia con datos confirmados por el servidor: si no, los listeners
        // del grupo nuevo podrían arrancar antes de que exista la ficha del jugador.
        if (confirmado) setCode(p?.grupoActual ?? null)
      },
      (e) => {
        if (isPermissionDenied(e) && reintentoPerfil < MAX_REINTENTOS) {
          t = window.setTimeout(() => setReintentoPerfil((n) => n + 1), 400 * (reintentoPerfil + 1))
          return
        }
        setSessionError(friendlyError(e, 'No se pudo cargar tu perfil.'))
        setStatus('error')
      },
    )
    return () => {
      un()
      window.clearTimeout(t)
    }
  }, [uid, reintentoPerfil])

  // Al abrir la app: marca la visita y sincroniza el reloj con el servidor.
  const perfilListo = !!profile
  useEffect(() => {
    if (profile && online) void touchProfile(profile).catch(() => {})
    // Solo una vez por sesión o al volver la conexión.
  }, [perfilListo, online])

  // Grupo y sus colecciones (según el perfil confirmado por el servidor).
  const [reintentoGrupo, setReintentoGrupo] = useState(0)
  const intentosGrupo = useRef(new Map<string, number>())
  useEffect(() => {
    setGroupError(null)
    setPlayers(null)
    setAnswers(null)
    setChallenges(null)
    if (code === undefined) return
    if (code === null) {
      setGroup(null)
      return
    }
    setGroup(undefined)
    let reprogramado = false
    let t: number | undefined
    const alFallar = (e: unknown) => {
      const intentos = intentosGrupo.current.get(code) ?? 0
      if (isPermissionDenied(e) && intentos < MAX_REINTENTOS) {
        // Puede ser transitorio (la ficha de jugador recién creada aún no es visible): reintentar.
        if (!reprogramado) {
          reprogramado = true
          intentosGrupo.current.set(code, intentos + 1)
          t = window.setTimeout(() => setReintentoGrupo((n) => n + 1), 600 * (intentos + 1))
        }
        return
      }
      setGroupError(
        isPermissionDenied(e)
          ? 'Ya no formas parte de este grupo (pudo ser reiniciado o borrado).'
          : friendlyError(e, 'No se pudo cargar el grupo.'),
      )
    }
    const subs = [
      watchGroup(
        code,
        (g) => {
          setGroup(g)
          if (g) intentosGrupo.current.set(code, 0)
          else setGroupError('Este grupo ya no existe.')
        },
        alFallar,
      ),
      watchPlayers(code, setPlayers, alFallar),
      watchAnswers(code, setAnswers, alFallar),
      watchChallenges(code, setChallenges, alFallar),
    ]
    return () => {
      subs.forEach((un) => un())
      window.clearTimeout(t)
    }
  }, [code, reintentoGrupo])

  const day = useSeasonDay(group)
  const seasonOver = isSeasonOver(day)

  const standings = useMemo(
    () =>
      computeStandings({
        players: players ?? [],
        answers: answers ?? [],
        challenges: challenges ?? [],
        seasonClosed: seasonOver || group?.estado === 'finalizado',
      }),
    [players, answers, challenges, seasonOver, group?.estado],
  )

  // Co-administrador: se sumó con la clave desde otro dispositivo (no juega).
  const [coAdmin, setCoAdmin] = useState(false)
  useEffect(() => {
    setCoAdmin(false)
    if (!code || !uid) return
    return watchCoAdmin(code, uid, setCoAdmin)
  }, [code, uid])

  const isAdmin = !!group && !!uid && (group.adminUid === uid || coAdmin)
  const isPlayer = !!uid && !!players?.some((p) => p.uid === uid)
  const myRow = standings.find((r) => r.uid === uid)
  const myTodayAnswers = useMemo(
    () => (uid && answers ? (answersOfDay(uid, day, answers) as LiveAnswer[]) : []),
    [uid, day, answers],
  )
  const myToday = myTodayAnswers.find((a) => a.estado !== 'cerrada') ?? myTodayAnswers.at(-1)
  const myPending = useMemo(
    () => (uid && challenges ? pendingChallengesFor(uid, challenges) : []) as LiveChallenge[],
    [uid, challenges],
  )
  const canDrawCard =
    isPlayer &&
    !seasonOver &&
    myPending.length === 0 &&
    myTodayAnswers.length < GAME_CONFIG.preguntasPorDia &&
    myTodayAnswers.every((a) => a.estado === 'cerrada')
  const comodinDisponible = !myTodayAnswers.some((a) => a.comodin)

  // Una respuesta que quedó abierta y cuyo tiempo expiró (cerró la app, perdió conexión…)
  // se cierra como tiempo agotado.
  useEffect(() => {
    if (!code || !uid || !myToday || myToday.estado !== 'abierta' || myToday.reveladoEnMs === null) return
    const cerrar = () => {
      if (!online) return
      void closeDaily(code, uid, myToday.dia, myToday.n, timeoutResult()).catch(() => {})
    }
    if (isExpired(myToday.reveladoEnMs, serverNow())) {
      // Margen para no pisar una respuesta que se está enviando en este momento.
      const t = window.setTimeout(cerrar, 2_000)
      return () => window.clearTimeout(t)
    }
    const espera = myToday.reveladoEnMs + GAME_CONFIG.pausaRevelacionMs + GAME_CONFIG.tiempoPreguntaMs - serverNow()
    const t = window.setTimeout(cerrar, espera + 4_000)
    return () => window.clearTimeout(t)
  }, [code, uid, myToday, online])

  // Lo mismo para un reto que el retado abrió y dejó sin responder: cuenta como fallo.
  useEffect(() => {
    if (!code || !online) return
    const abiertos = myPending.filter((c) => c.estado === 'abierto' && c.abiertoEnMs !== null)
    if (abiertos.length === 0) return
    const timers = abiertos.map((c) => {
      const fin = c.abiertoEnMs! + GAME_CONFIG.pausaRevelacionMs + GAME_CONFIG.tiempoPreguntaMs
      const espera = Math.max(2_000, fin - serverNow() + 4_000)
      return window.setTimeout(() => void resolveChallenge(code, c.id, timeoutResult()).catch(() => {}), espera)
    })
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [code, myPending, online])

  const value: GameContextValue = {
    status,
    sessionError,
    retrySession,
    online,
    uid,
    profile,
    group,
    groupError,
    groupLoaded:
      code === (profile?.grupoActual ?? null) &&
      group !== undefined &&
      players !== null &&
      answers !== null &&
      challenges !== null,
    players: players ?? [],
    answers: answers ?? [],
    challenges: challenges ?? [],
    day,
    seasonOver,
    standings,
    isAdmin,
    isPlayer,
    myRow,
    myTodayAnswers,
    myToday,
    canDrawCard,
    comodinDisponible,
    myPending,
  }

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}
