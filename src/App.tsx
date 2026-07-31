import { useEffect, useState } from 'react'
import { useData } from './state/store'
import { useRoute, type Route } from './nav/routes'
import { TabBar } from './components/TabBar'
import { Dashboard } from './screens/Dashboard'
import { DesktopDashboard } from './screens/DesktopDashboard'
import { Money } from './screens/Money'
import { Planner } from './screens/Planner'
import { Bills } from './screens/Bills'
import { Debts } from './screens/Debts'
import { DebtDetail } from './screens/DebtDetail'
import { Chat } from './screens/Chat'
import { Reports } from './screens/Reports'
import { Appearance } from './screens/Appearance'
import { Settings, PersonalitySettings } from './screens/Settings'
import { Onboarding } from './screens/Onboarding'
import { QuickAdd } from './screens/QuickAdd'

const DESKTOP_QUERY = '(min-width: 900px)'

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia?.(DESKTOP_QUERY).matches ?? false,
  )
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY)
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return isDesktop
}

export function App() {
  const data = useData()
  const { route, navigate, back } = useRoute()
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const isDesktop = useIsDesktop()

  // Leaving the screen dismisses the sheet — it is an overlay on a screen, not
  // a destination of its own.
  useEffect(() => {
    setQuickAddOpen(false)
  }, [route.name, route.name === 'debt' ? route.id : null])

  // Global "N" shortcut for quick add — the desktop rail advertises it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA'
      if (!typing && (e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setQuickAddOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!data.profile.onboarded) {
    return (
      <div className="app app-mobile">
        <div className="screen-scroll">
          <Onboarding onFinish={() => navigate({ name: 'home' })} />
        </div>
      </div>
    )
  }

  const screen = renderScreen(route, navigate, back, isDesktop)

  if (isDesktop) {
    // Home gets the wide translation (1j); every other screen keeps its
    // phone-width design, centred on the board.
    if (route.name === 'home') {
      return (
        <div className="app">
          <div className="desktop-shell">
            <DesktopRail route={route} onNavigate={navigate} onQuickAdd={() => setQuickAddOpen(true)} />
            <DesktopDashboard onNavigate={navigate} />
          </div>
          {quickAddOpen && <QuickAddOverlay onClose={() => setQuickAddOpen(false)} />}
        </div>
      )
    }

    return (
      <div className="app app-desktop-board">
        <DesktopRail route={route} onNavigate={navigate} onQuickAdd={() => setQuickAddOpen(true)} />
        <div className="phone">
          <div className="screen-scroll">{screen}</div>
          <TabBar route={route} onNavigate={navigate} onQuickAdd={() => setQuickAddOpen(true)} />
          {quickAddOpen && <QuickAdd onClose={() => setQuickAddOpen(false)} />}
        </div>
      </div>
    )
  }

  return (
    <div className="app app-mobile" style={{ position: 'relative' }}>
      <div className="screen-scroll">{screen}</div>
      <TabBar route={route} onNavigate={navigate} onQuickAdd={() => setQuickAddOpen(true)} />
      {quickAddOpen && <QuickAdd onClose={() => setQuickAddOpen(false)} />}
    </div>
  )
}

function renderScreen(
  route: Route,
  navigate: (route: Route) => void,
  back: () => void,
  isDesktop: boolean,
) {
  switch (route.name) {
    case 'home':
      return isDesktop ? (
        <DesktopDashboard onNavigate={navigate} />
      ) : (
        <Dashboard onNavigate={navigate} />
      )
    case 'money':
      return <Money onNavigate={navigate} />
    case 'planner':
      return <Planner onBack={back} />
    case 'bills':
      return <Bills />
    case 'debts':
      return <Debts onNavigate={navigate} />
    case 'debt':
      return <DebtDetail debtId={route.id} onBack={back} />
    case 'chat':
      return <Chat />
    case 'reports':
      return <Reports />
    case 'settings':
      return <Settings onNavigate={navigate} onBack={back} />
    case 'appearance':
      return <Appearance onBack={back} />
    case 'personality':
      return <PersonalitySettings onBack={back} />
    default:
      return <Dashboard onNavigate={navigate} />
  }
}

const RAIL: { label: string; route: Route }[] = [
  { label: 'Home', route: { name: 'home' } },
  { label: 'Money', route: { name: 'money' } },
  { label: 'Debts', route: { name: 'debts' } },
  { label: 'Chat', route: { name: 'chat' } },
  { label: 'More', route: { name: 'settings' } },
]

function DesktopRail({
  route,
  onNavigate,
  onQuickAdd,
}: {
  route: Route
  onNavigate: (route: Route) => void
  onQuickAdd: () => void
}) {
  const isCurrent = (item: Route) =>
    item.name === route.name ||
    (item.name === 'money' && ['planner', 'bills', 'reports'].includes(route.name)) ||
    (item.name === 'debts' && route.name === 'debt') ||
    (item.name === 'settings' && ['appearance', 'personality'].includes(route.name))

  return (
    <nav className="rail" aria-label="Main">
      <div className="rail__brand">₱ piso</div>
      {RAIL.map((item) => (
        <button
          key={item.label}
          type="button"
          className="rail__item"
          aria-current={isCurrent(item.route) ? 'page' : undefined}
          onClick={() => onNavigate(item.route)}
        >
          {item.label}
        </button>
      ))}
      <button type="button" className="rail__cta" onClick={onQuickAdd}>
        + Quick add <span className="rail__key">N</span>
      </button>
    </nav>
  )
}

/** On the wide dashboard the sheet needs its own full-screen positioner. */
function QuickAddOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'grid', placeItems: 'end center' }}>
      <div style={{ position: 'relative', width: 390, height: '100%' }}>
        <QuickAdd onClose={onClose} />
      </div>
    </div>
  )
}
