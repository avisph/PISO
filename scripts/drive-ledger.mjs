/**
 * Second pass: does the ledger built by onboarding actually work? Adds a
 * transaction, pays a bill, reloads, and checks the numbers moved together.
 * Also walks the semi-monthly path and the demo escape hatch.
 *
 * Needs Playwright, which is deliberately not a dependency — it downloads a
 * browser on install and nobody running the app should pay for that:
 *
 *   npm i -D playwright
 *   node scripts/drive-ledger.mjs
 */
import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
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

/** Reads the store straight out of localStorage. */
const store = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem('piso.state.v1') ?? 'null'))

async function onboard({ cadence, salary, accounts, bills }) {
  await page.goto(BASE)
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await page.getByPlaceholder('Your name').fill('Test')
  if (cadence === 'monthly') await page.getByRole('button', { name: 'Once a month' }).click()
  await page.getByPlaceholder('25,000').fill(salary)
  await page.getByRole('button', { name: /where your money sits/ }).click()

  const money = () => page.locator('.input--money')
  for (const [i, v] of accounts.entries()) await money().nth(i).fill(v)
  await page.getByRole('button', { name: /already spoken for/ }).click()

  for (const [i, v] of bills.entries()) await money().nth(i).fill(v)
  await page.getByRole('button', { name: /the fun one|skip this/ }).click()
  await page.getByRole('button', { name: /^Finish/ }).click()
  await page.waitForTimeout(300)
}

console.log('\nsemi-monthly onboarding')
await onboard({
  cadence: 'semi-monthly',
  salary: '25000',
  accounts: ['500', '9000', '2000'],
  bills: ['8000', '0', '0', '1500'],
})

let s = await store()
check('accounts kept', s.accounts.length, 3)
check('bills kept (₱0 ones dropped)', s.bills.length, 2)
check('salary in centavos', s.profile.salary, 2_500_000)
check('cadence', s.profile.payCadence, 'semi-monthly')
check('no invented transactions', s.transactions.length, 0)
check('no invented debts', s.debts.length, 0)
check('plan total = salary', s.plan.total, 2_500_000)
check(
  'bills funded and locked in the plan',
  s.plan.items.filter((i) => i.locked).length,
  2,
)
check(
  'envelopes are steppable (not "suggested")',
  s.plan.items.filter((i) => i.suggested).length,
  0,
)

console.log('\nlogging an expense')
const cashBefore = s.accounts.reduce((n, a) => (a.type === 'savings' ? n : n + a.balance), 0)
await page.goto(BASE + '/#/home')
await page.locator('.tabbar__fab, .fab').first().click()
await page.waitForTimeout(200)
for (const d of ['3', '4', '0']) await page.getByRole('button', { name: d, exact: true }).click()
await page.getByRole('button', { name: /Food/ }).first().click()
await page.getByRole('button', { name: /^(Save|Add|Log)/ }).first().click()
await page.waitForTimeout(300)

s = await store()
const cashAfter = s.accounts.reduce((n, a) => (a.type === 'savings' ? n : n + a.balance), 0)
check('one transaction recorded', s.transactions.length, 1)
check('amount', s.transactions[0]?.amount, 34_000)
check('cash fell by the same amount', cashBefore - cashAfter, 34_000)
check('the food envelope absorbed it', s.plan.items.find((i) => i.id === 'food')?.spent, 34_000)

console.log('\nreload')
await page.reload()
await page.waitForTimeout(300)
s = await store()
check('transaction survived', s.transactions.length, 1)
check('balances survived', s.accounts.reduce((n, a) => n + a.balance, 0) !== 0, true)

console.log('\npaying a bill')
const before = await store()
await page.goto(BASE + '/#/bills')
await page.getByRole('button', { name: 'Pay', exact: true }).first().click()
await page.waitForTimeout(400)
s = await store()
const paid = s.bills.find((b) => b.status !== 'open')
check('a bill moved off "open"', Boolean(paid), true)
check('it produced a transaction', s.transactions.length, before.transactions.length + 1)

console.log('\ndemo escape hatch')
await page.goto(BASE)
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.getByRole('button', { name: /demo instead/ }).click()
await page.waitForTimeout(300)
s = await store()
check('persona loaded', s.profile.name, 'Dafhnee')
check('onboarding is done', s.profile.onboarded, true)

await browser.close()

if (errors.length) {
  console.log('\n✗ runtime errors:')
  for (const e of [...new Set(errors)]) console.log('   ' + e)
}
console.log(fails.length ? `\n✗ ${fails.length} failed: ${fails.join(', ')}` : '\n✓ all checks passed')
process.exit(fails.length || errors.length ? 1 : 0)
