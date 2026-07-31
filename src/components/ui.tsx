import type { ReactNode } from 'react'
import { formatMoney, type Centavos, type FormatOptions } from '../lib/money'

/* ── Icons (Phosphor, inlined — the system's icon set) ───────────────────── */

export function BellIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
      <path d="M221.8 175.94c-5.55-9.56-13.8-36.61-13.8-71.94a80 80 0 0 0-160 0c0 35.34-8.26 62.38-13.81 71.94A16 16 0 0 0 48 200h40.81a40 40 0 0 0 78.38 0H208a16 16 0 0 0 13.8-24.06ZM128 216a24 24 0 0 1-22.62-16h45.24A24 24 0 0 1 128 216Z" />
    </svg>
  )
}

export function CardIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
      <path d="M224 48H32a16 16 0 0 0-16 16v128a16 16 0 0 0 16 16h192a16 16 0 0 0 16-16V64a16 16 0 0 0-16-16Zm0 16v24H32V64Zm0 128H32v-88h192v88Z" />
    </svg>
  )
}

/* ── Money ───────────────────────────────────────────────────────────────── */

/**
 * The single money renderer. Colour semantics never travel alone — a caller
 * that tints an amount also passes the ▾ / + / − glyph, so the meaning
 * survives for colour-blind readers (blueprint §8).
 */
export function Money({
  value,
  className,
  ...opts
}: { value: Centavos; className?: string } & FormatOptions) {
  return <span className={className}>{formatMoney(value, opts)}</span>
}

/* ── Progress bars ───────────────────────────────────────────────────────── */

export function Bar({
  value,
  max,
  variant = 'plan',
  size = 'md',
  label,
}: {
  value: number
  max: number
  variant?: 'plan' | 'accent' | 'warn' | 'positive' | 'dim'
  size?: 'md' | 'sm' | 'xs' | 'hair'
  label?: string
}) {
  const pct = max <= 0 ? 0 : Math.min(1, Math.max(0, value / max))
  const sizeClass =
    size === 'sm' ? ' bar--sm' : size === 'xs' ? ' bar--xs' : size === 'hair' ? ' bar--hair' : ''
  const fillClass =
    variant === 'accent'
      ? ' bar__fill--accent'
      : variant === 'warn'
        ? ' bar__fill--warn'
        : variant === 'positive'
          ? ' bar__fill--positive'
          : variant === 'dim'
            ? ' bar__fill--dim'
            : ''

  return (
    <div
      className={`bar${sizeClass}`}
      role="progressbar"
      aria-valuenow={Math.round(pct * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={`bar__fill${fillClass}`} style={{ width: `${pct * 100}%` }} />
    </div>
  )
}

/* ── Progress ring (debt detail 1e, health score 1i) ─────────────────────── */

export function Ring({
  size,
  stroke,
  percent,
  value,
  sublabel,
  valueSize,
}: {
  size: number
  stroke: number
  percent: number
  value: string
  sublabel?: string
  valueSize: number
}) {
  const radius = (size - stroke) / 2 - 0.5
  const circumference = 2 * Math.PI * radius
  const dash = Math.min(1, Math.max(0, percent)) * circumference
  const center = size / 2

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${value}${sublabel ? ` ${sublabel}` : ''}`}
      style={{ flex: 'none' }}
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="var(--p-track)"
        strokeWidth={stroke}
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="var(--p-accent)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference - dash}`}
        transform={`rotate(-90 ${center} ${center})`}
      />
      <text
        x={center}
        y={sublabel ? center - 3 : center + valueSize / 3}
        textAnchor="middle"
        fill="var(--p-text)"
        fontSize={valueSize}
        fontFamily="Inter"
        fontWeight="500"
      >
        {value}
      </text>
      {sublabel && (
        <text
          x={center}
          y={center + 13}
          textAnchor="middle"
          fill="var(--p-muted)"
          fontSize="9"
          fontFamily="Inter"
        >
          {sublabel}
        </text>
      )}
    </svg>
  )
}

/* ── Small building blocks ───────────────────────────────────────────────── */

export function Kicker({
  children,
  tone = 'muted',
}: {
  children: ReactNode
  tone?: 'muted' | 'accent' | 'faint'
}) {
  const cls =
    tone === 'accent' ? 'kicker kicker--accent' : tone === 'faint' ? 'kicker kicker--faint' : 'kicker'
  return <div className={cls}>{children}</div>
}

export function Switch({ on, label }: { on: boolean; label?: string }) {
  return (
    <span className={`switch${on ? ' switch--on' : ''}`} role="presentation" aria-label={label}>
      <span className="switch__knob" />
    </span>
  )
}

export function RadioDot({ on }: { on: boolean }) {
  return <span className={`radio-dot${on ? ' radio-dot--on' : ''}`} />
}

export function BackLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="back-link" onClick={onClick}>
      ← {children}
    </button>
  )
}
