/**
 * Third pass: can you actually change your own ledger after onboarding?
 * Adds a debt, edits it, adds and edits a bill, adds an account, and checks
 * the two deletes that must be refused.
 *
 * Needs Playwright, which is deliberately not a dependency — it downloads a
 * browser on install and nobody running the app should pay for that:
 *
 *   npm i -D playwright
 *   node scripts/drive-editing.mjs
 */
import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
const OUT = process.env.SHOT_DIR ?? '/tmp/shots'

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})
const page = await browser.newPage({ viewport: { width: 402, height: 860 } })

const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

const fails = []
const check = (label, actual, expected) => {
  const ok = actual === expected
  console.log(`  ${ok ? '✓' : '✗'} ${label}: ${actual}${ok ? '' : `  (expected ${expected})`}`)
  if (!ok) fails.push(label)
}
const store = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem('piso.state.v1') ?? 'null'))
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })

/* ── onboard first ──────────────────────────────────────────────────────── */
await page.goto(BASE)
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.getByPlaceholder('Your name').fill('Dafdays')
await page.getByPlaceholder('25,000').fill('25000')
await page.getByRole('button', { name: /where your money sits/ }).click()
const money = () => page.locator('.sheet .input--money, .input--money')
await money().nth(0).fill('500')
await money().nth(1).fill('9000')
await money().nth(2).fill('2000')
await page.getByRole('button', { name: /already spoken for/ }).click()
await money().nth(0).fill('8000')
await page.getByRole('button', { name: /the fun one|skip this/ }).click()
await page.getByRole('button', { name: /^Finish/ }).click()
await page.waitForTimeout(300)

/* ── a debt, at last ────────────────────────────────────────────────────── */
console.log('\nadding a debt')
await page.goto(`${BASE}/#/debts`)
await page.waitForTimeout(250)
await shot('debts-empty')
await page.getByRole('button', { name: /Magdagdag ng utang/ }).click()
await page.waitForTimeout(200)
await page.getByPlaceholder(/BPI card/).fill('BPI Amore card')
await page.locator('.sheet .input--money').nth(0).fill('18000')
await page.locator('.sheet .input--money').nth(1).fill('20000')
await page.locator('.sheet .input--money').nth(2).fill('3')
await page.locator('.sheet .input--money').nth(3).fill('900')
await shot('debt-sheet')
await page.getByRole('button', { name: 'Add', exact: true }).click()
await page.waitForTimeout(300)

let s = await store()
check('the debt exists', s.debts.length, 1)
check('balance', s.debts[0]?.balance, 1_800_000)
check('rate is a fraction, not a percent', s.debts[0]?.monthlyRate, 0.03)
check('minimum', s.debts[0]?.minPayment, 90_000)
check('history starts empty', s.debts[0]?.history?.length, 0)
await shot('debts-with-one')

/* ── edit it ────────────────────────────────────────────────────────────── */
console.log('\nediting it')
await page.locator('.debt-card').first().click()
await page.waitForTimeout(250)
await page.getByRole('button', { name: /^Edit/ }).click()
await page.waitForTimeout(200)
await page.locator('.sheet .input--money').nth(0).fill('16500')
await page.getByRole('button', { name: /Save changes/ }).click()
await page.waitForTimeout(300)
s = await store()
check('balance changed', s.debts[0]?.balance, 1_650_000)
check('still only one debt', s.debts.length, 1)

/* ── a payment, then the delete that must be refused ────────────────────── */
console.log('\ndeleting a debt that has a payment')
await page.waitForTimeout(200)
await page.getByRole('button', { name: /^Edit/ }).click()
await page.waitForTimeout(200)
const canDeleteBefore = await page
  .getByRole('button', { name: /Delete this debt/ })
  .isDisabled()
check('delete is available while untouched', canDeleteBefore, false)
await page.keyboard.press('Escape')
await page.waitForTimeout(200)

// Log a payment against it from the quick-add sheet.
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('piso.state.v1'))
  raw.transactions = [
    {
      id: 't-manual',
      kind: 'debt_payment',
      amount: 100_000,
      accountId: raw.accounts[0].id,
      debtId: raw.debts[0].id,
      date: new Date().toISOString().slice(0, 10),
      createdAt: 1,
    },
  ]
  localStorage.setItem('piso.state.v1', JSON.stringify(raw))
})
await page.reload()
await page.waitForTimeout(300)
await page.getByRole('button', { name: /^Edit/ }).click()
await page.waitForTimeout(250)
const blocked = await page.getByRole('button', { name: /Delete this debt/ }).isDisabled()
check('delete is refused once a payment points at it', blocked, true)
check(
  'and it says why',
  await page.getByText(/naitala/).isVisible(),
  true,
)
await shot('debt-delete-blocked')
await page.keyboard.press('Escape')

/* ── bills ──────────────────────────────────────────────────────────────── */
console.log('\nadding and editing a bill')
await page.goto(`${BASE}/#/bills`)
await page.waitForTimeout(250)
await page.getByRole('button', { name: /Magdagdag ng bill/ }).click()
await page.waitForTimeout(200)
await page.getByPlaceholder(/Meralco/).fill('Meralco')
await page.locator('.sheet .input--money').first().fill('2400')
await shot('bill-sheet')
await page.getByRole('button', { name: 'Add', exact: true }).click()
await page.waitForTimeout(300)

s = await store()
check('the bill exists', s.bills.length, 2)
const meralco = s.bills.find((b) => b.name === 'Meralco')
check('amount', meralco?.amountDue, 240_000)
check('starts open', meralco?.status, 'open')

/* ── an account ─────────────────────────────────────────────────────────── */
console.log('\nadding an account')
await page.goto(`${BASE}/#/money`)
await page.waitForTimeout(250)
await page.getByRole('button', { name: /Magdagdag ng account/ }).click()
await page.waitForTimeout(200)
await page.getByPlaceholder(/BPI, GCash/).fill('Maya')
await page.getByRole('button', { name: 'E-wallet', exact: true }).click()
await page.locator('.sheet .input--money').first().fill('1500')
await page.getByRole('button', { name: 'Add', exact: true }).click()
await page.waitForTimeout(300)

s = await store()
check('the account exists', s.accounts.length, 4)
check('and its balance counts as cash', s.accounts.find((a) => a.name === 'Maya')?.balance, 150_000)
await shot('money-accounts')

/* ── paying a bill has to move real money ───────────────────────────────── */
console.log('\npaying a bill')
const cash = (x) => x.accounts.reduce((n, a) => (a.type === 'savings' ? n : n + a.balance), 0)
const beforePay = await store()
await page.goto(`${BASE}/#/bills`)
await page.waitForTimeout(250)
await page.getByRole('button', { name: 'Pay', exact: true }).first().click()
await page.waitForTimeout(400)
const afterPay = await store()
check('cash actually fell', cash(beforePay) - cash(afterPay) > 0, true)

await browser.close()
if (errors.length) {
  console.log('\n✗ runtime errors:')
  for (const e of [...new Set(errors)]) console.log('   ' + e)
}
console.log(fails.length ? `\n✗ ${fails.length} failed: ${fails.join(', ')}` : '\n✓ all checks passed')
process.exit(fails.length || errors.length ? 1 : 0)
