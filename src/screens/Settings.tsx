import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import { BackLink, Kicker, Switch } from '../components/ui'
import { themeById } from '../theme/themes'
import { PERSONALITIES, PersonalityPicker } from './Onboarding'
import { formatMoney, peso } from '../lib/money'
import { Field } from '../components/fields'
import type { Route } from '../nav/routes'
import type { ChatStatus } from '../../shared/chat'

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
        <Kicker tone="faint">Bes</Kicker>
        <BesServerField />
      </section>

      <section className="stack" style={{ gap: 8 }}>
        <Kicker tone="faint">Start over</Kicker>
        <button
          type="button"
          className="btn-quiet"
          onClick={() => {
            if (
              window.confirm(
                'Set up again from scratch? Your accounts, bills and everything you have logged will be deleted. Hindi ito maibabalik.',
              )
            ) {
              dispatch({ type: 'data/restart' })
            }
          }}
        >
          Set up my money again
        </button>
        <button
          type="button"
          className="btn-quiet"
          onClick={() => {
            if (
              window.confirm(
                'Replace everything with the demo persona? Mawawala ang sarili mong datos.',
              )
            ) {
              dispatch({ type: 'data/reset' })
            }
          }}
        >
          Load the demo persona instead
        </button>
        <div className="muted" style={{ fontSize: 11, lineHeight: 1.5 }}>
          Both wipe what is here now. The demo is Dafhnee — an invented person the app was
          designed around, useful for looking around and nothing else.
        </div>
      </section>
    </div>
  )
}

/** Settings → personality, reusing the onboarding picker verbatim. */
export function PersonalitySettings({ onBack }: { onBack: () => void }) {
  const [data] = useStore()
  const [status, setStatus] = useState<ChatStatus | null>(null)
  const base = data.profile.besServer ?? ''

  useEffect(() => {
    fetch(`${base}/api/chat/status`)
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [base])

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

      {status && (
        <div className="stack" style={{ gap: 4 }}>
          <Kicker tone="faint">Answering via</Kicker>
          <div className="muted" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
            {status.provider === 'offline'
              ? 'the built-in response library — no model configured on the server'
              : `${status.provider} · ${status.model}`}
            {status.endpoint && status.provider !== 'offline' ? ` · ${status.endpoint}` : ''}
            {status.note ? ` — ${status.note}` : ''}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Where Bes's server lives.
 *
 * On a desktop the app and the server share an origin and this stays empty.
 * Installed on a phone there is no server at all, so this is how you reach the
 * PC your Ollama runs on — and when it is unreachable, the chat answers from
 * the canned library in the browser rather than failing.
 */
function BesServerField() {
  const [data, dispatch] = useStore()
  const [text, setText] = useState(data.profile.besServer ?? '')
  const [probe, setProbe] = useState<'idle' | 'checking' | 'ok' | 'bad'>('idle')

  async function check(url: string) {
    setProbe('checking')
    try {
      const base = url.trim().replace(/\/+$/, '')
      const response = await fetch(`${base}/api/chat/status`, {
        signal: AbortSignal.timeout(4_000),
      })
      setProbe(response.ok ? 'ok' : 'bad')
    } catch {
      setProbe('bad')
    }
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <Field
        label="Server address"
        hint={
          probe === 'ok'
            ? 'Abot ko siya. Ito na ang tatanungin ni Bes.'
            : probe === 'bad'
              ? 'Hindi ko maabot. Canned na sagot muna si Bes — gagana pa rin ang app.'
              : 'Iwanan mong blangko kung dito rin sa PC tumatakbo ang server. Sa phone: http://<ip-ng-pc>:8787'
        }
      >
        <input
          className="input"
          value={text}
          inputMode="url"
          placeholder="http://192.168.1.20:8787"
          onChange={(e) => {
            setText(e.target.value)
            setProbe('idle')
          }}
          onBlur={() => dispatch({ type: 'profile/besServer', url: text })}
        />
      </Field>
      <button
        type="button"
        className="btn-quiet"
        disabled={probe === 'checking'}
        onClick={() => {
          dispatch({ type: 'profile/besServer', url: text })
          void check(text)
        }}
      >
        {probe === 'checking' ? 'Tinitingnan…' : 'Subukan ang koneksyon'}
      </button>
    </div>
  )
}
