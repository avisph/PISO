import { useCallback, useEffect, useState } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'money' }
  | { name: 'planner' }
  | { name: 'bills' }
  | { name: 'transactions' }
  | { name: 'debts' }
  | { name: 'debt'; id: string }
  | { name: 'chat' }
  | { name: 'reports' }
  | { name: 'settings' }
  | { name: 'appearance' }
  | { name: 'personality' }

export const HOME: Route = { name: 'home' }

export function toHash(route: Route): string {
  return route.name === 'debt' ? `#/debts/${route.id}` : `#/${route.name}`
}

export function fromHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const [head, id] = path
  switch (head) {
    case 'money':
      return { name: 'money' }
    case 'planner':
      return { name: 'planner' }
    case 'bills':
      return { name: 'bills' }
    case 'transactions':
      return { name: 'transactions' }
    case 'debts':
      return id ? { name: 'debt', id } : { name: 'debts' }
    case 'chat':
      return { name: 'chat' }
    case 'reports':
      return { name: 'reports' }
    case 'settings':
      return { name: 'settings' }
    case 'appearance':
      return { name: 'appearance' }
    case 'personality':
      return { name: 'personality' }
    default:
      return HOME
  }
}

/** Which tab lights up for a given route. */
export function tabFor(route: Route): 'home' | 'money' | 'debts' | 'chat' | null {
  switch (route.name) {
    case 'home':
      return 'home'
    case 'money':
    case 'planner':
    case 'bills':
    case 'reports':
    case 'transactions':
      return 'money'
    case 'debts':
    case 'debt':
      return 'debts'
    case 'chat':
      return 'chat'
    default:
      return null
  }
}

export function useRoute(): {
  route: Route
  navigate: (route: Route) => void
  back: () => void
} {
  const [route, setRoute] = useState<Route>(() => fromHash(window.location.hash))

  useEffect(() => {
    const onChange = () => setRoute(fromHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = useCallback((next: Route) => {
    const hash = toHash(next)
    if (window.location.hash === hash) return
    window.location.hash = hash
  }, [])

  const back = useCallback(() => {
    if (window.history.length > 1) window.history.back()
    else window.location.hash = toHash(HOME)
  }, [])

  return { route, navigate, back }
}
