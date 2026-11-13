import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import type { ReactElement } from 'react'
import { GAME_CONFIG } from '../../config/gameConfig'
import { tipoReto } from '../../game/challenges'
import { useGame } from '../../state/GameContext'
import { Leaderboard } from '../game/Leaderboard'
import { OrnateFrame } from '../ui/OrnateFrame'
import { IconAdmin, IconClasificacion, IconInicio, IconPerfil } from './icons'

interface NavItem {
  to: string
  label: string
  icon: () => ReactElement
}

const NAV: NavItem[] = [
  { to: '/', label: 'Inicio', icon: IconInicio },
  { to: '/clasificacion', label: 'Clasificación', icon: IconClasificacion },
  { to: '/perfil', label: 'Perfil', icon: IconPerfil },
]

const NAV_ADMIN: NavItem = { to: '/admin', label: 'Admin', icon: IconAdmin }

/** Estructura de la app: cabecera, contenido y clasificación en vivo (PC) o navegación inferior (móvil). */
export function AppShell() {
  const { group, day, seasonOver, standings, uid, myRow, isAdmin, myPending, players } = useGame()
  const { pathname } = useLocation()
  const mostrarLateral = pathname !== '/clasificacion'
  const nav = isAdmin ? [...NAV, NAV_ADMIN] : NAV
  const navigate = useNavigate()
  const reto = !seasonOver && !pathname.startsWith('/reto/') ? myPending[0] : undefined

  // Al terminar la semana, llevar una vez a la ceremonia (por grupo y temporada).
  const claveCeremonia = group ? `trivia:ceremonia:${group.code}:${group.temporada}` : null
  useEffect(() => {
    if (!seasonOver || !claveCeremonia || pathname === '/ceremonia') return
    try {
      if (sessionStorage.getItem(claveCeremonia)) return
      sessionStorage.setItem(claveCeremonia, '1')
    } catch {
      // Sin almacenamiento: igual se muestra el botón en el inicio.
    }
    navigate('/ceremonia')
  }, [seasonOver, claveCeremonia, pathname, navigate])
  const nombre = (u: string) => players.find((p) => p.uid === u)?.apodo ?? 'Alguien'
  const avisoReto = !reto
    ? null
    : {
        reto: <><strong className="text-oro-claro">{nombre(reto.de)}</strong> te lanzó un reto.</>,
        devuelto: <><strong className="text-oro-claro">{nombre(reto.para)}</strong> te devolvió tu reto.</>,
        doble: <>Tienes un <strong className="text-oro-claro">doble reto</strong> pendiente.</>,
        extra: <>Te falta la 2.ª pregunta de tu <strong className="text-oro-claro">doble reto</strong>.</>,
      }[tipoReto(reto)]

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 pb-24 lg:pb-8">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-oro focus:px-3 focus:py-2 focus:text-noche"
      >
        Saltar al contenido
      </a>
      <header className="flex items-center gap-3 py-4">
        <NavLink to="/" className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-bold text-oro-claro sm:text-xl">Trivia del Destino</p>
          {group && <p className="truncate text-xs text-niebla">{group.nombre}</p>}
        </NavLink>
        <span className="rounded-full border border-oro/30 bg-noche-2/80 px-3 py-1 text-xs whitespace-nowrap text-pergamino">
          {seasonOver ? 'Temporada terminada' : `Día ${day + 1} de ${GAME_CONFIG.diasTemporada}`}
        </span>
        {myRow && (
          <span className="hidden rounded-full bg-oro/15 px-3 py-1 text-xs font-semibold whitespace-nowrap text-oro-claro sm:inline">
            {myRow.puntos} pts
          </span>
        )}
        <nav aria-label="Principal" className="hidden gap-1 lg:flex">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm transition ${isActive ? 'bg-violeta/40 text-oro-claro' : 'text-niebla hover:text-pergamino'}`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <div className={`grid flex-1 gap-6 ${mostrarLateral ? 'lg:grid-cols-[minmax(0,1fr)_360px]' : ''}`}>
        <main id="contenido" tabIndex={-1} className="min-w-0 outline-none">
          {reto && (
            <Link
              to={`/reto/${reto.id}`}
              className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-[#7A1838] bg-[#7A1838]/40 px-4 py-3 text-sm hover:bg-[#7A1838]/60"
            >
              <span>
                {avisoReto} Es obligatorio antes de tu siguiente carta.
              </span>
              <span className="font-display whitespace-nowrap text-oro-claro uppercase">Responder</span>
            </Link>
          )}
          <Outlet />
        </main>
        {mostrarLateral && (
          <aside className="hidden lg:block" aria-label="Clasificación en vivo">
            <div className="sticky top-4">
              <OrnateFrame title="Clasificación en vivo">
                <Leaderboard rows={standings} meUid={uid} limit={10} emptyText="Invita a tu grupo para empezar." />
              </OrnateFrame>
            </div>
          </aside>
        )}
      </div>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-oro/25 bg-noche/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto flex max-w-md">
          {nav.map((n) => (
            <li key={n.to} className="flex-1">
              <NavLink
                to={n.to}
                end
                className={({ isActive }) =>
                  `flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs transition ${
                    isActive ? 'text-oro-claro' : 'text-niebla'
                  }`
                }
              >
                <n.icon />
                {n.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
