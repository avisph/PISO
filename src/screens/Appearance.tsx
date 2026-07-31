import { useStore } from '../state/store'
import { BackLink, RadioDot, Switch } from '../components/ui'
import { THEMES } from '../theme/themes'

/**
 * 2e — Settings → Appearance. Four cards, mini previews painted from each
 * theme's own tokens, Sorbetes marked Default.
 */
export function Appearance({ onBack }: { onBack: () => void }) {
  const [data, dispatch] = useStore()
  const { profile } = data
  const activeId = profile.matchSystemTheme ? null : profile.theme

  return (
    <div className="stack" style={{ gap: 16, padding: '22px 20px 24px', minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <BackLink onClick={onBack}>Settings</BackLink>
      </div>

      <div>
        <h1 className="h-page" style={{ margin: 0 }}>
          Appearance
        </h1>
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          Same app, different sorbetes flavor. Bes stays sarcastic in all of them.
        </div>
      </div>

      <div className="theme-grid">
        {THEMES.map((theme) => {
          const selected = activeId === theme.id
          return (
            <button
              key={theme.id}
              type="button"
              className="theme-card"
              aria-pressed={selected}
              onClick={() => {
                dispatch({ type: 'profile/matchSystem', on: false })
                dispatch({ type: 'profile/theme', theme: theme.id })
              }}
            >
              <span
                className="theme-card__preview"
                style={{
                  background: theme.preview.bg,
                  border: `1px solid ${theme.preview.border}`,
                }}
              >
                <span
                  className="theme-card__accentbar"
                  style={{ background: theme.preview.accent }}
                />
                <span
                  className="theme-card__mini"
                  style={{
                    background: theme.preview.surface,
                    boxShadow: theme.preview.surfaceShadow
                      ? '0 1px 2px rgba(43,36,51,.08)'
                      : undefined,
                  }}
                >
                  <span
                    className="theme-card__line"
                    style={{ width: '68%', background: theme.preview.text }}
                  />
                  <span
                    className="theme-card__line"
                    style={{ width: '42%', background: theme.preview.line }}
                  />
                </span>
              </span>

              <span className="theme-card__foot">
                <RadioDot on={selected} />
                <span className="stack" style={{ alignItems: 'flex-start' }}>
                  <span className="theme-card__name">{theme.name}</span>
                  <span className="theme-card__desc">{theme.description}</span>
                </span>
                {theme.isDefault && <span className="theme-card__default">Default</span>}
              </span>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        className="toggle-row toggle-row--outlined"
        aria-pressed={profile.matchSystemTheme}
        onClick={() => dispatch({ type: 'profile/matchSystem', on: !profile.matchSystemTheme })}
      >
        <span className="stack" style={{ alignItems: 'flex-start' }}>
          <span className="toggle-row__label">Match system light/dark</span>
          <span className="toggle-row__sub">Sorbetes by day, Ube Latte by night</span>
        </span>
        <Switch on={profile.matchSystemTheme} label="Match system light and dark" />
      </button>
    </div>
  )
}
