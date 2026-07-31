import { useStore } from '../state/store'
import { BackLink, Kicker, Switch } from '../components/ui'
import { themeById } from '../theme/themes'
import { PERSONALITIES, PersonalityPicker } from './Onboarding'
import { formatMoney, peso } from '../lib/money'
import type { Route } from '../nav/routes'

const BUFFERS = [peso(500), peso(1_500), peso(2_500), peso(5_000)]

export function Settings({
  onNavigate,
  onBack,
}: {
  onNavigate: (route: Route) => void
  onBack: () => void
}) {
  const [data, dispatch] = useStore()
  const { profile } = data
  const theme = themeById(profile.theme)
  const personality = PERSONALITIES.find((p) => p.key === profile.personality)

  return (
    <div className="screen screen--pad-bottom" style={{ gap: 16 }}>
      <BackLink onClick={onBack}>Money</BackLink>

      <h1 className="h-page" style={{ margin: 0 }}>
        Settings
      </h1>

      <section className="stack" style={{ gap: 8 }}>
        <button
          type="button"
          className="settings-row"
          onClick={() => onNavigate({ name: 'appearance' })}
        >
          <span className="stack" style={{ flex: 1, alignItems: 'flex-start', gap: 1 }}>
            <span style={{ fontSize: 13.5 }}>Appearance</span>
            <span className="muted" style={{ fontSize: 10.5 }}>
              {profile.matchSystemTheme ? 'Match system light/dark' : theme.name}
            </span>
          </span>
          <span className="settings-row__chevron">›</span>
        </button>

        <button
          type="button"
          className="settings-row"
          onClick={() => onNavigate({ name: 'personality' })}
        >
          <span className="stack" style={{ flex: 1, alignItems: 'flex-start', gap: 1 }}>
            <span style={{ fontSize: 13.5 }}>How honest should Bes be?</span>
            <span className="muted" style={{ fontSize: 10.5 }}>
              {personality?.name}
            </span>
          </span>
          <span className="settings-row__chevron">›</span>
        </button>

        <button
          type="button"
          className="toggle-row"
          aria-pressed={profile.reactionsOn}
          onClick={() => dispatch({ type: 'profile/reactions', on: !profile.reactionsOn })}
        >
          <span className="stack" style={{ alignItems: 'flex-start' }}>
            <span className="toggle-row__label">Reactions</span>
            <span className="toggle-row__sub">
              {profile.reactionsOn ? 'Bes comments on your screens' : 'numbers only, no commentary'}
            </span>
          </span>
          <Switch on={profile.reactionsOn} label="Reactions" />
        </button>
      </section>

      <section className="stack" style={{ gap: 8 }}>
        <Kicker>Safe-to-spend cushion</Kicker>
        <div className="muted" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
          Held back from safe-to-spend so the number understates rather than overstates.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {BUFFERS.map((buffer) => (
            <button
              key={buffer}
              type="button"
              className="pill"
              aria-pressed={profile.safeToSpendBuffer === buffer}
              onClick={() => dispatch({ type: 'profile/buffer', buffer })}
            >
              {formatMoney(buffer)}
            </button>
          ))}
        </div>
      </section>

      <section className="stack" style={{ gap: 8 }}>
        <Kicker tone="faint">Demo data</Kicker>
        <button
          type="button"
          className="btn-quiet"
          onClick={() => {
            if (window.confirm('Reset Dafhnee’s data back to the seeded persona?')) {
              dispatch({ type: 'data/reset' })
            }
          }}
        >
          Reset to the seeded persona
        </button>
      </section>
    </div>
  )
}

/** Settings → personality, reusing the onboarding picker verbatim. */
export function PersonalitySettings({ onBack }: { onBack: () => void }) {
  const [data] = useStore()

  return (
    <div className="screen screen--pad-bottom" style={{ gap: 16 }}>
      <BackLink onClick={onBack}>Settings</BackLink>
      <div>
        <h1 className="h-page" style={{ margin: 0, fontSize: 26, lineHeight: 1.15 }}>
          How honest should I be about your spending?
        </h1>
        <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
          Change it whenever. Health, family and emergency expenses are never joked about — that's a
          hard rule, not a setting.
        </div>
      </div>
      <PersonalityPicker />
      <p className="quote">
        Currently: {PERSONALITIES.find((p) => p.key === data.profile.personality)?.name}
      </p>
    </div>
  )
}
