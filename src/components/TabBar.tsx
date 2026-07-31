import type { Route } from '../nav/routes'
import { tabFor } from '../nav/routes'

const TABS: { key: 'home' | 'money' | 'debts' | 'chat'; label: string; route: Route }[] = [
  { key: 'home', label: 'Home', route: { name: 'home' } },
  { key: 'money', label: 'Money', route: { name: 'money' } },
  { key: 'debts', label: 'Debts', route: { name: 'debts' } },
  { key: 'chat', label: 'Chat', route: { name: 'chat' } },
]

/**
 * Home · Money · (+) · Debts · Chat — the quick-add FAB sits in the middle and
 * is reachable from every screen (blueprint §8: "the most important component
 * in the app").
 */
export function TabBar({
  route,
  onNavigate,
  onQuickAdd,
}: {
  route: Route
  onNavigate: (route: Route) => void
  onQuickAdd: () => void
}) {
  const active = tabFor(route)
  const [home, money, debts, chat] = TABS

  const tab = (t: (typeof TABS)[number]) => (
    <button
      key={t.key}
      type="button"
      className="tabbar__tab"
      aria-current={active === t.key ? 'page' : undefined}
      onClick={() => onNavigate(t.route)}
    >
      {t.label}
    </button>
  )

  return (
    <nav className="tabbar" aria-label="Main">
      {tab(home)}
      {tab(money)}
      <div className="tabbar__fabwrap">
        <button type="button" className="tabbar__fab" onClick={onQuickAdd} aria-label="Quick add">
          +
        </button>
      </div>
      {tab(debts)}
      {tab(chat)}
    </nav>
  )
}
