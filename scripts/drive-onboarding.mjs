/**
 * Drives a real browser through the new onboarding and out the other side,
 * shooting every screen. Throwaway verification — not part of the app.
 *
 * Needs Playwright, which is deliberately not a dependency — it downloads a
 * browser on install and nobody running the app should pay for that:
 *
 *   npm i -D playwright
 *   node scripts/drive-onboarding.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const OUT = process.env.SHOT_DIR ?? '/tmp/shots'
const BASE = 'http://localhost:5173'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})
const page = await browser.newPage({ viewport: { width: 402, height: 860 } })

const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`))

const shot = async (name) => {
  await page.waitForTimeout(220)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
  console.log(`  ✓ ${name}`)
}

await page.goto(BASE)
await page.evaluate(() => localStorage.clear())
await page.reload()

console.log('step 1')
await shot('ob-1-payday')
await page.getByPlaceholder('Your name').fill('Dafdays')
await page.getByRole('button', { name: 'Once a month' }).click()
await page.getByPlaceholder('25,000').fill('42,500')
await shot('ob-1-filled')

await page.getByRole('button', { name: /where your money sits/ }).click()
console.log('step 2')
await shot('ob-2-accounts')
const money = page.locator('.input--money')
await money.nth(0).fill('1200')
await money.nth(1).fill('18500')
await money.nth(2).fill('3400')
await page.getByRole('button', { name: '+ Add another account' }).click()
await page.locator('.input--flush').nth(3).fill('Emergency savings')
await page.locator('.entry-row').nth(3).getByRole('button', { name: 'Savings', exact: true }).click()
await page.locator('.input--money').nth(3).fill('25000')
await shot('ob-2-filled')

await page.getByRole('button', { name: /already spoken for/ }).click()
console.log('step 3')
await shot('ob-3-bills')
const billAmounts = page.locator('.input--money')
await billAmounts.nth(0).fill('12000')
await billAmounts.nth(1).fill('2400')
await billAmounts.nth(2).fill('650')
await billAmounts.nth(3).fill('1699')
await shot('ob-3-filled')

await page.getByRole('button', { name: /the fun one/ }).click()
console.log('step 4')
await shot('ob-4-personality')
await page.getByRole('button', { name: /Savage/ }).click()

await page.getByRole('button', { name: /Finish/ }).click()
await page.waitForTimeout(400)

console.log('app')
for (const [name, hash] of [
  ['app-home', '#/home'],
  ['app-money', '#/money'],
  ['app-planner', '#/planner'],
  ['app-bills', '#/bills'],
  ['app-transactions', '#/transactions'],
  ['app-debts', '#/debts'],
  ['app-reports', '#/reports'],
  ['app-chat', '#/chat'],
  ['app-settings', '#/settings'],
]) {
  await page.goto(BASE + '/' + hash)
  await shot(name)
}

// Survives a reload? The ledger lives in localStorage.
await page.goto(BASE + '/#/home')
await page.reload()
await shot('app-home-after-reload')

await browser.close()

if (errors.length) {
  console.log('\n✗ runtime errors:')
  for (const e of [...new Set(errors)]) console.log('   ' + e)
  process.exit(1)
}
console.log('\n✓ no runtime errors')
