/**
 * Reads `.env` from the project root into `process.env`.
 *
 * Node does not do this on its own, and neither does tsx — so without this the
 * `.env` the README asks you to write is read by nobody, and the server starts
 * offline no matter what you put in it. Import this module first, before
 * anything reads `process.env`.
 *
 * Real environment variables always win: exporting `OLLAMA_HOST=…` in the shell
 * overrides the file, which is what you want when testing another host.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Strips one layer of matching quotes, the way every .env parser does. */
function unquote(value: string): string {
  const first = value[0]
  if ((first === '"' || first === "'") && value.endsWith(first) && value.length > 1) {
    return value.slice(1, -1)
  }
  return value
}

export function loadEnv(file = path.join(ROOT, '.env')): string[] {
  let text: string
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    return []
  }

  const applied: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue

    // `export FOO=bar` is common in hand-written .env files.
    const body = line.startsWith('export ') ? line.slice(7).trim() : line
    const eq = body.indexOf('=')
    if (eq < 1) continue

    const key = body.slice(0, eq).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    if (key in process.env) continue // a real env var beats the file

    process.env[key] = unquote(body.slice(eq + 1).trim())
    applied.push(key)
  }
  return applied
}

loadEnv()
