import Anthropic from '@anthropic-ai/sdk'
import type { ChatEvent, ChatRequest, ChatTurn } from '../../shared/chat'
import { BES_PERSONA, DRAFT_TOOL, contextBlock } from '../bes'
import { coerceDraft, type Provider } from './types'

const MODEL = process.env.PISO_MODEL ?? 'claude-opus-5'

export function createAnthropicProvider(): Provider {
  // A bare client also picks up ANTHROPIC_AUTH_TOKEN or an `ant auth login`
  // profile — "no key in env" doesn't necessarily mean "no credentials".
  let client: Anthropic | null = null
  try {
    client = new Anthropic()
  } catch {
    client = null
  }

  const available = Boolean(
    process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || client?.apiKey,
  )

  return {
    id: 'anthropic',
    model: MODEL,
    endpoint: process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com',
    available,
    reason: available ? undefined : 'no ANTHROPIC_API_KEY',

    async stream(request: ChatRequest, send: (event: ChatEvent) => void) {
      if (!client) throw new Error('Anthropic client unavailable')

      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: 1200,
        // Thinking stays on (adaptive) with low effort: on Opus 5 disabling it
        // can make the model write a tool call as plain text instead of calling
        // the tool, which would silently drop the draft card.
        thinking: { type: 'adaptive' },
        output_config: { effort: 'low' },
        system: [
          { type: 'text', text: BES_PERSONA, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: contextBlock(request.context) },
        ],
        tools: [
          {
            name: DRAFT_TOOL.name,
            description: DRAFT_TOOL.description,
            input_schema: DRAFT_TOOL.parameters,
            strict: true,
          },
        ],
        messages: toAnthropicMessages(request.turns),
      })

      stream.on('text', (delta) => send({ type: 'text', text: delta }))

      const message = await stream.finalMessage()

      if (message.stop_reason === 'refusal') {
        send({ type: 'error', message: 'Bes declined that one. Try asking a different way.' })
      }

      for (const block of message.content) {
        if (block.type === 'tool_use' && block.name === DRAFT_TOOL.name) {
          const draft = coerceDraft(block.input)
          if (draft) send({ type: 'draft', draft, toolUseId: block.id })
        }
      }
    },
  }
}

/**
 * Map the visible conversation onto Messages API shapes. Any assistant turn
 * that called the tool must be answered by a tool_result — if the user moved
 * on without confirming, we synthesise one so the request stays valid.
 */
function toAnthropicMessages(turns: ChatTurn[]): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = []

  turns.forEach((turn, index) => {
    if (turn.role === 'user') {
      messages.push({ role: 'user', content: turn.text })
      return
    }

    if (turn.role === 'assistant') {
      if (turn.draft && turn.toolUseId) {
        const content: Anthropic.ContentBlockParam[] = []
        if (turn.text.trim()) content.push({ type: 'text', text: turn.text })
        content.push({
          type: 'tool_use',
          id: turn.toolUseId,
          name: DRAFT_TOOL.name,
          input: turn.draft as unknown as Record<string, unknown>,
        })
        messages.push({ role: 'assistant', content })

        const answered =
          turns[index + 1]?.role === 'tool_result' &&
          (turns[index + 1] as Extract<ChatTurn, { role: 'tool_result' }>).toolUseId ===
            turn.toolUseId
        if (!answered) {
          messages.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: turn.toolUseId,
                content: 'The draft is still on screen; the user has not confirmed it yet.',
              },
            ],
          })
        }
        return
      }

      if (turn.text.trim()) messages.push({ role: 'assistant', content: turn.text })
      return
    }

    messages.push({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: turn.toolUseId, content: turn.result }],
    })
  })

  return messages
}
