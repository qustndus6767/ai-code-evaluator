import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import type { Shot } from '@/types/eval'

export const runtime = 'edge'

const wire = z.object({ code: z.string().min(1).max(40_000) })

const shotSchema = {
  type: 'object' as const,
  required: ['scores', 'composite', 'grade', 'summary', 'callouts'],
  properties: {
    scores: {
      type: 'object',
      required: ['scannability', 'pragmaticCleverness', 'redundancyPenalty'],
      properties: {
        scannability:        { type: 'number', minimum: 0, maximum: 10 },
        pragmaticCleverness: { type: 'number', minimum: 0, maximum: 10 },
        redundancyPenalty:   { type: 'number', minimum: 0, maximum: 10 },
      },
    },
    composite: { type: 'number', minimum: 0, maximum: 10 },
    grade:     { type: 'string', enum: ['S', 'A', 'B', 'C', 'F'] },
    summary:   { type: 'string', maxLength: 220 },
    callouts:  { type: 'array', items: { type: 'string', maxLength: 120 }, maxItems: 5 },
  },
}

const PERSONA = `You are a brutal principal engineer who has zero tolerance for textbook bloat and AI slop.
Your job: dissect the submitted code and verdict it across three axes.

scannability (0–10)
  10 = a senior can parse intent in <5s. penalize: wall-of-text functions, ambiguous names, over-abstraction.

pragmaticCleverness (0–10)
  10 = the code uses production-grade tricks — short-circuit guards, destructuring collapses, lookup maps over switch chains, etc.
  0 = naive loops, unnecessary state, cargo-cult try/catch, tutorial-style step-by-step decomposition.

redundancyPenalty (0–10, inverted — 10 is worst)
  10 = every other line is a comment restating what the variable name already says, or dead code, or wrapper functions that add zero value.
  0 = zero fat. each token earns its place.

composite = (scannability * 0.35) + (pragmaticCleverness * 0.45) + ((10 - redundancyPenalty) * 0.20), rounded to 1 decimal.

grade: S ≥ 9 | A ≥ 7.5 | B ≥ 6 | C ≥ 4 | F < 4

summary: one brutal sentence. no hedging.
callouts: up to 5 specific lines/patterns that most influenced the verdict (quote the actual code, keep it short).`

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = wire.safeParse(body)
  if (!parsed.success) return Response.json({ error: 'bad_input' }, { status: 422 })

  const ant = new Anthropic()

  const msg = await ant.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: PERSONA,
    tools: [{ name: 'verdict', description: 'Emit the structured evaluation', input_schema: shotSchema }],
    tool_choice: { type: 'tool', name: 'verdict' },
    messages: [{ role: 'user', content: `\`\`\`\n${parsed.data.code}\n\`\`\`` }],
  })

  const hit = msg.content.find(b => b.type === 'tool_use')
  if (!hit || !('input' in hit)) return Response.json({ error: 'model_misfired' }, { status: 502 })

  return Response.json(hit.input as Shot)
}