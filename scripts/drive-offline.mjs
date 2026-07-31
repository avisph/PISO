/**
 * Does the app survive with no server at all? That is the normal case for the
 * installed PWA: the ledger is on the device, but /api is somewhere else.
 *
 * Needs Playwright, which is deliberately not a dependency — it downloads a
 * browser on install and nobody running the app should pay for that:
 *
 *   npm i -D playwright
 *   node scripts/drive-offline.mjs
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE ?? 'http://localhost:4173'
const OUT = process.env.SHOT_DIR ?? '/tmp/shots'

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})
const page = await browser.newPage({ viewport: { width: 402, height: 860 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

const fails = []
const check = (label, actual, expected) => {
  const ok = actual === expected
  console.log(`  ${ok ? '✓' : '✗'} ${label}: ${actual}${ok ? '' : `  (expected ${expected})`}`)
  if (!ok) fails.push(label)
}

// No API server is running on this origin at all — every /api call will fail.
await page.goto(BASE)
await page.evaluate(() => localStorage.clear())
await page.reload()

console.log('\nonboarding with no server')
await page.getByPlaceholder('Your name').fill('Dafdays')
await page.getByPlaceholder('25,000').fill('25000')
await page.getByRole('button', { name: /where your money sits/ }).click()
const money = () => page.locator('.input--money')
await money().nth(0).fill('500')
await money().nth(1).fill('9000')
await money().nth(2).fill('2000')
await page.getByRole('button', { name: /already spoken for/ }).click()
await money().nth(0).fill('8000')
await page.getByRole('button', { name: /the fun one|skip this/ }).click()
await page.getByRole('button', { name: /^Finish/ }).click()
await page.waitForTimeout(400)

const store = () => page.evaluate(() => JSON.parse(localStorage.getItem('piso.state.v1') ?? 'null'))
let s = await store()
check('the ledger was written', s.accounts.length, 3)

console.log('\nchat with no server')
await page.goto(`${BASE}/#/chat`)
await page.waitForTimeout(600)
await page.locator('.composer input').fill('can I afford a 3000 keyboard?')
await page.keyboard.press('Enter')
await page.waitForTimeout(900)
const reply = await page.locator('.bubble-bes').last().innerText()
console.log(`  bes: ${reply}`)
check('Bes answered anyway', reply.length > 10, true)
check('and it is her voice, not an error', /kasya|safe to spend|₱/.test(reply), true)
await page.screenshot({ path: `${OUT}/offline-chat.png`, fullPage: true })

console.log('\ndrafting with no server')
await page.locator('.composer input').fill('spent 350 on grab kanina')
await page.keyboard.press('Enter')
await page.waitForTimeout(900)
const hasCard = await page.getByRole('button', { name: /Confirm/i }).count()
check('the draft card still appears', hasCard > 0, true)
await page.getByRole('button', { name: /Confirm/i }).first().click()
await page.waitForTimeout(400)
s = await store()
check('confirming wrote one transaction', s.transactions.length, 1)
check('and it hit a real account', s.accounts.some((a) => a.id === s.transactions[0].accountId), true)

console.log('\nservice worker + manifest')
const sw = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration()
  return Boolean(reg?.active || reg?.installing || reg?.waiting)
})
check('service worker registered', sw, true)
const manifest = await page.evaluate(() => document.querySelector('link[rel=manifest]')?.getAttribute('href'))
check('manifest linked', manifest, '/manifest.webmanifest')

console.log('\nfully offline reload')
await page.context().setOffline(true)
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(800)
const stillThere = await page.locator('.tabbar, .app').count()
check('the app still opens with the network off', stillThere > 0, true)
s = await store()
check('the ledger is still there', s.transactions.length, 1)
await page.screenshot({ path: `${OUT}/offline-home.png`, fullPage: true })
await page.context().setOffline(false)

await browser.close()
if (errors.length) {
  console.log('\n✗ runtime errors:')
  for (const e of [...new Set(errors)]) console.log('   ' + e)
}
console.log(fails.length ? `\n✗ ${fails.length} failed: ${fails.join(', ')}` : '\n✓ all checks passed')
process.exit(fails.length ? 1 : 0)
