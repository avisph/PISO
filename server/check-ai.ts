/**
 * `npm run ai:check` — point this at your Ollama (the same base URL you use in
 * n8n) and it reports what Bes can actually run: is the host reachable, which
 * models are installed, and which of them support tool calling.
 *
 *   npm run ai:check
 *   OLLAMA_HOST=http://192.168.1.20:11434 npm run ai:check
 */

const HOST = (process.env.OLLAMA_HOST ?? 'http://localhost:11434').replace(/\/+$/, '')
const KEY = process.env.OLLAMA_API_KEY ?? ''
const WANTED = process.env.OLLAMA_MODEL

const auth = KEY ? { Authorization: `Bearer ${KEY}` } : {}

/** Models Ollama reports as tool-capable, plus a name-based fallback. */
const KNOWN_TOOL_FAMILIES =
  /^(llama3\.[123]|llama4|qwen2\.5|qwen3|mistral|mixtral|mistral-nemo|firefunction|command-r|hermes3|granite3|gpt-oss|deepseek-v3|glm-4|smollm2)/i

interface ModelInfo {
  name: string
  tools: boolean | null
  size?: number
}

async function listModels(): Promise<{ name: string; size?: number }[]> {
  const response = await fetch(`${HOST}/api/tags`, {
    headers: auth,
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok) throw new Error(`${HOST}/api/tags answered ${response.status}`)
  const body = (await response.json()) as { models?: { name?: string; model?: string; size?: number }[] }
  return (body.models ?? [])
    .map((m) => ({ name: m.name ?? m.model ?? '', size: m.size }))
    .filter((m) => m.name)
}

/** /api/show reports capabilities on recent Ollama builds. */
async function supportsTools(name: string): Promise<boolean | null> {
  try {
    const response = await fetch(`${HOST}/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ model: name }),
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) return null
    const body = (await response.json()) as { capabilities?: string[]; template?: string }
    if (Array.isArray(body.capabilities)) return body.capabilities.includes('tools')
    // Older builds: the chat template mentions tools when the model supports them.
    if (typeof body.template === 'string') return /\.tools\b|ToolCalls|tool_calls/i.test(body.template)
    return null
  } catch {
    return null
  }
}

const gb = (bytes?: number) => (bytes ? `${(bytes / 1e9).toFixed(1)} GB` : '')

async function main() {
  console.log(`\nChecking Ollama at ${HOST}${KEY ? ' (with API key)' : ''}…\n`)

  let models: { name: string; size?: number }[]
  try {
    models = await listModels()
  } catch (error) {
    console.log(`✗ Cannot reach it — ${error instanceof Error ? error.message : 'unknown error'}\n`)
    console.log('Things worth checking:')
    console.log('  · Is the daemon up?            curl ' + HOST + '/api/tags')
    console.log('  · Right URL? Use the same base URL as your n8n Ollama credential.')
    console.log('  · Ollama in Docker, Piso on the host? Use http://localhost:11434.')
    console.log('  · Piso in Docker, Ollama on the host? Use http://host.docker.internal:11434')
    console.log('  · Remote box? Ollama only listens on localhost unless you set')
    console.log('    OLLAMA_HOST=0.0.0.0 on the daemon itself.\n')
    process.exitCode = 1
    return
  }

  if (models.length === 0) {
    console.log('✓ Host is up, but no models are installed. Pull one:\n')
    console.log('    ollama pull qwen2.5:7b        # good tool calling, ~5 GB')
    console.log('    ollama pull llama3.1:8b       # also fine, ~5 GB\n')
    process.exitCode = 1
    return
  }

  const infos: ModelInfo[] = []
  for (const model of models) {
    infos.push({ ...model, tools: await supportsTools(model.name) })
  }

  console.log(`✓ Host is up with ${infos.length} model${infos.length === 1 ? '' : 's'}:\n`)
  for (const info of infos) {
    const capable = info.tools ?? KNOWN_TOOL_FAMILIES.test(info.name)
    const mark = info.tools === true ? 'tools ✓' : info.tools === false ? 'no tools' : capable ? 'tools (likely)' : 'tools unknown'
    console.log(`   ${info.name.padEnd(28)} ${gb(info.size).padStart(8)}   ${mark}`)
  }

  const best =
    infos.find((i) => i.tools === true) ??
    infos.find((i) => i.tools === null && KNOWN_TOOL_FAMILIES.test(i.name)) ??
    infos[0]

  console.log('\nPut this in your .env:\n')
  console.log(`    OLLAMA_HOST=${HOST}`)
  console.log(`    OLLAMA_MODEL=${best.name}`)
  if (KEY) console.log('    OLLAMA_API_KEY=…   (keep the one you already set)')
  console.log('\nThen: npm run dev\n')

  if (WANTED && !infos.some((i) => i.name === WANTED || i.name.replace(/:latest$/, '') === WANTED)) {
    console.log(`! OLLAMA_MODEL is set to "${WANTED}", which is not installed here.\n`)
    process.exitCode = 1
  }

  if (best.tools === false) {
    console.log(
      '! None of the installed models advertise tool calling. Bes will still work —\n' +
        '  she falls back to a local text parser for the draft card — but a tool-capable\n' +
        '  model is noticeably better. Try: ollama pull qwen2.5:7b\n',
    )
  }
}

main()
