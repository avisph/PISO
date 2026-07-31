import { useStore } from '../state/store'
import { Kicker, RadioDot, Switch } from '../components/ui'
import type { Personality } from '../types'

export const PERSONALITIES: {
  key: Personality
  name: string
  sample: string
  recommended?: boolean
}[] = [
  {
    key: 'gentle',
    name: 'Gentle',
    sample: '“Uy, food’s a bit over plan — ₱1,500. Gusto mo i-rebalance natin?”',
  },
  {
    key: 'balanced',
    name: 'Balanced',
    sample:
      '“Food budget exceeded by ₱1,500 na. The meal plan was apparently suggestion lang pala.”',
    recommended: true,
  },
  {
    key: 'savage',
    name: 'Savage',
    sample:
      '“₱1,500 over on food, bes. The budget didn’t fail you — hindi mo lang siya kinonsulta.”',
  },
]

/**
 * The personality picker — step 4 of onboarding (1h), and the same component
 * again under Settings so the choice stays changeable "anytime", as promised.
 */
export function PersonalityPicker() {
  const [data, dispatch] = useStore()

  return (
    <div className="stack" style={{ gap: 10 }}>
      {PERSONALITIES.map((p) => {
        const on = data.profile.personality === p.key
        return (
          <button
            key={p.key}
            type="button"
            className="choice"
            aria-pressed={on}
            onClick={() => dispatch({ type: 'profile/personality', personality: p.key })}
          >
            <span className="choice__head">
              <RadioDot on={on} />
              <span className="choice__name">{p.name}</span>
              {p.recommended && <span className="choice__badge">recommended</span>}
            </span>
            <span className="choice__sample">{p.sample}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * 1h — Onboarding, final step. Payday and accounts are behind us; this is the
 * fun one. The hard rule is stated on the screen, not buried in settings.
 */
export function Onboarding({ onFinish }: { onFinish: () => void }) {
  const [data, dispatch] = useStore()

  return (
    <div className="stack" style={{ gap: 20, padding: '26px 22px 22px', minHeight: '100%' }}>
      <div className="steps" role="progressbar" aria-valuenow={4} aria-valuemin={1} aria-valuemax={4}>
        <span className="steps__seg steps__seg--on" />
        <span className="steps__seg steps__seg--on" />
        <span className="steps__seg steps__seg--on" />
        <span className="steps__seg" />
      </div>

      <div>
        <Kicker tone="accent">Step 4 of 4 — the fun one</Kicker>
        <div
          className="h-page"
          style={{ fontSize: 26, lineHeight: 1.15, marginTop: 6 }}
        >
          How honest should I be about your spending?
        </div>
        <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
          You can change this anytime. Health, family and emergency expenses are never joked about
          — that's a hard rule, not a setting.
        </div>
      </div>

      <PersonalityPicker />

      <button
        type="button"
        className="toggle-row"
        onClick={() => dispatch({ type: 'profile/reactions', on: !data.profile.reactionsOn })}
        aria-pressed={data.profile.reactionsOn}
      >
        <span className="stack">
          <span className="toggle-row__label">
            Reactions {data.profile.reactionsOn ? 'on' : 'off'}
          </span>
          <span className="toggle-row__sub">full opt-out lives in Settings</span>
        </span>
        <Switch on={data.profile.reactionsOn} label="Reactions" />
      </button>

      <div className="stack push-top" style={{ gap: 8 }}>
        <button
          type="button"
          className="btn-outline btn-outline--sm"
          onClick={() => {
            dispatch({ type: 'profile/onboarded' })
            onFinish()
          }}
        >
          Finish — show me my money
        </button>
        <button
          type="button"
          className="skip"
          onClick={() => {
            dispatch({ type: 'profile/onboarded' })
            onFinish()
          }}
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}
