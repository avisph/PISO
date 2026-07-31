/**
 * Exercises the `<think>` stripper the way a token stream actually arrives:
 * a character or two at a time, with tags split across chunk boundaries.
 *
 * Reasoning models (qwen3, deepseek-r1) narrate before they answer, and that
 * narration must never reach the chat bubble. The single-chunk case is easy;
 * the ones worth testing are the splits.
 *
 *   npx tsx scripts/check-think-filter.ts
 */
import { createThinkFilter } from '../server/providers/ollama'

const run = (chunks: string[]): string => {
  const filter = createThinkFilter()
  let out = ''
  for (const chunk of chunks) out += filter.push(chunk)
  return out + filter.flush()
}

const split = (text: string, size: number): string[] =>
  text.match(new RegExp(`.{1,${size}}`, 'gs')) ?? []

const cases: [label: string, chunks: string[], expected: string][] = [
  ['plain text passes through', ['hello there'], 'hello there'],
  ['whole block in one chunk', ['<think>reasoning</think>answer'], 'answer'],
  ['text either side', ['hi <think>x</think> there'], 'hi  there'],
  ['tag split across chunks', ['<thi', 'nk>hidden</thi', 'nk>shown'], 'shown'],
  ['one character at a time', split('<think>secret</think>₱5,851 left', 1), '₱5,851 left'],
  ['two characters at a time', split('a<think>b</think>c', 2), 'ac'],
  ['several blocks', ['<think>a</think>X<think>b</think>Y'], 'XY'],
  ['unterminated block stays hidden', ['<think>still going'], ''],
  ['a lone < is not a tag', ['3 < 5 pesos'], '3 < 5 pesos'],
  // A stream that ends mid-tag never had a tag: emit the text as written
  // rather than swallow something the model actually said.
  ['fragment at end of stream is text', ['done <thi'], 'done <thi'],
  ['newlines inside the block', ['<think>line1\nline2</think>out'], 'out'],
]

let failed = 0
for (const [label, chunks, expected] of cases) {
  const got = run(chunks)
  const ok = got === expected
  if (!ok) failed += 1
  console.log(
    `  ${ok ? '✓' : '✗'} ${label}` +
      (ok ? '' : `\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(expected)}`),
  )
}

console.log(failed ? `\n✗ ${failed} failed` : `\n✓ ${cases.length} passed`)
process.exit(failed ? 1 : 0)
