import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import type { Rule, Verdict } from '@/types/eval'

export const runtime = 'edge'

const inbound = z.object({
  code: z.string().min(1).max(50_000),
  rules: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        probe: z.string(),
        weight: z.number().int().min(1).max(10),
      })
    )
    .min(1)
    .max(15),
})

const verdictSchema = {
  type: 'object' as const,
  required: ['verdicts'],
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        required: ['ruleId', 'score', 'severity', 'rationale'],
        properties: {
          ruleId: { type: 'string' },
          score: { type: 'number', minimum: 0, maximum: 10 },
          severity: { type: 'string', enum: ['pass', 'warn', 'fail'] },
          rationale: { type: 'string', maxLength: 180 },
        },
      },
    },
  },
}

export async function POST(req: Request) {
  const raw = await req.json().catch(() => null)
  const payload = inbound.safeParse(raw)
  if (!payload.success) return Response.json({ issues: payload.error.issues }, { status: 422 })

  const { code, rules } = payload.data
  const ant = new Anthropic()

  const msg = await ant.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    tools: [{ name: 'emit_verdicts', description: 'Emit structured per-rule verdicts', input_schema: verdictSchema }],
    tool_choice: { type: 'tool', name: 'emit_verdicts' },
    messages: [{ role: 'user', content: forge(code, rules) }],
  })

  const toolBlock = msg.content.find(b => b.type === 'tool_use')
  if (!toolBlock || !('input' in toolBlock)) return Response.json({ error: 'oracle_silent' }, { status: 502 })

  const { verdicts } = toolBlock.input as { verdicts: Verdict[] }
  const enc = new TextEncoder()

  return new Response(
    new ReadableStream({
      async start(ctrl) {
        for (const v of verdicts) {
          ctrl.enqueue(enc.encode(`data: ${JSON.stringify(v)}\n\n`))
          await new Promise(r => setTimeout(r, 90))
        }
        ctrl.enqueue(enc.encode('data: [DONE]\n\n'))
        ctrl.close()
      },
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    }
  )
}

function forge(code: string, rules: Rule[]): string {
  return `You are a ruthless senior engineer auditing AI-generated code. Score each rule 0–10. Penalize cargo-cult patterns, AI verbosity, and lazy error handling.

RUBRIC:
${rules.map(r => `[${r.id}] ${r.label} (weight ${r.weight}/10)\n  — ${r.probe}`).join('\n')}

TARGET:
\`\`\`
${code}
\`\`\`

Rationale ≤ 180 chars. Score 0 = catastrophic, 10 = exemplary.`
}