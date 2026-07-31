import type { CapacitorConfig } from '@capacitor/cli'

/**
 * The APK wraps the same `dist/` the web build produces — no second codebase.
 *
 * Two things matter here. `webDir` points at the Vite output, which is why
 * `base: './'` in vite.config.ts is load-bearing: inside the APK the app is
 * served from the filesystem, and absolute asset paths would resolve to
 * nothing. And `cleartext` is on because the only http:// the app ever talks to
 * is the Bes server on your own wifi — an address you typed in Settings.
 * Everything else, including the whole ledger, stays on the device.
 */
const config: CapacitorConfig = {
  appId: 'ph.piso.app',
  appName: 'Piso',
  webDir: 'dist',
  android: {
    // Bes's server is a LAN address over plain http. Android blocks that by
    // default; the ledger never leaves the phone either way.
    allowMixedContent: true,
  },
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
}

export default config
