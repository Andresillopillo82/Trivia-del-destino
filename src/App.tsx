import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { OfflineBanner } from './components/ui/OfflineBanner'
import { Starfield } from './components/ui/Starfield'
import { LoadingScreen, StatusScreen } from './components/ui/StatusScreen'
import { ChallengePlay } from './screens/ChallengePlay'
import { Gate, SessionGate } from './screens/Gate'
import { Home } from './screens/Home'
import { JoinLink } from './screens/JoinLink'
import { LeaderboardScreen } from './screens/LeaderboardScreen'
import { Play } from './screens/Play'
import { Profile } from './screens/Profile'
import { SendChallenge } from './screens/SendChallenge'
import { GameProvider } from './state/GameContext'

// Partida Rápida: independiente de los grupos (solo pide la sesión y el apodo).
const QuickMenu = lazy(() => import('./screens/quick/QuickMenu').then((m) => ({ default: m.QuickMenu })))
const QuickRoomScreen = lazy(() => import('./screens/quick/QuickRoomScreen').then((m) => ({ default: m.QuickRoomScreen })))
const QuickScreenPC = lazy(() => import('./screens/quick/QuickScreenPC').then((m) => ({ default: m.QuickScreenPC })))

// Pantallas que solo usa el administrador o que aparecen una vez por semana: se cargan bajo demanda.
const AdminPanel = lazy(() => import('./screens/AdminPanel').then((m) => ({ default: m.AdminPanel })))
const Presentation = lazy(() => import('./screens/Presentation').then((m) => ({ default: m.Presentation })))
const Ceremony = lazy(() => import('./screens/Ceremony').then((m) => ({ default: m.Ceremony })))
const DevGallery = import.meta.env.DEV
  ? lazy(() => import('./screens/DevGallery').then((m) => ({ default: m.DevGallery })))
  : null

function Diferida({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingScreen text="Invocando la pantalla…" />}>{children}</Suspense>
}

export function App() {
  return (
    <BrowserRouter>
      <GameProvider>
        <Starfield />
        <OfflineBanner />
        <Routes>
          <Route path="/unirse/:code" element={<JoinLink />} />
          {DevGallery && (
            <Route
              path="/galeria"
              element={
                <Diferida>
                  <DevGallery />
                </Diferida>
              }
            />
          )}
          <Route element={<SessionGate />}>
            <Route
              path="/rapida"
              element={
                <Diferida>
                  <QuickMenu />
                </Diferida>
              }
            />
            <Route
              path="/rapida/:code"
              element={
                <Diferida>
                  <QuickRoomScreen />
                </Diferida>
              }
            />
          </Route>
          <Route element={<SessionGate requireProfile={false} />}>
            <Route
              path="/sala/:code/pantalla"
              element={
                <Diferida>
                  <QuickScreenPC />
                </Diferida>
              }
            />
          </Route>
          <Route element={<Gate />}>
            <Route element={<AppShell />}>
              <Route index element={<Home />} />
              <Route path="jugar" element={<Play />} />
              <Route path="clasificacion" element={<LeaderboardScreen />} />
              <Route path="perfil" element={<Profile />} />
              <Route path="retar" element={<SendChallenge />} />
              <Route path="reto/:id" element={<ChallengePlay />} />
              <Route
                path="ceremonia"
                element={
                  <Diferida>
                    <Ceremony />
                  </Diferida>
                }
              />
              <Route
                path="admin"
                element={
                  <Diferida>
                    <AdminPanel />
                  </Diferida>
                }
              />
            </Route>
            <Route
              path="presentacion"
              element={
                <Diferida>
                  <Presentation />
                </Diferida>
              }
            />
          </Route>
          <Route
            path="*"
            element={
              <StatusScreen title="Esta carta no existe">
                <Link to="/" className="text-oro-claro underline underline-offset-4">
                  Volver al inicio
                </Link>
              </StatusScreen>
            }
          />
        </Routes>
      </GameProvider>
    </BrowserRouter>
  )
}
