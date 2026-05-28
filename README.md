# AI Code Pattern Evaluator

Rules-based LLM code review with edge-streamed verdicts. Paste AI-generated code, define your rubric, get per-rule scores streamed back in real time.

Built as a portfolio project for the Supabase AI Tooling Engineer application.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS
- Anthropic Claude API (`claude-sonnet-4-6`)

## How it works

1. You paste code into the bench
2. The rubric (editable, weighted rules) is sent with the code to `/api/evaluate`
3. The route handler forces Claude to emit structured verdicts via `tool_choice` binding
4. Verdicts stream back as SSE and render one-by-one with a weighted aggregate score

## Key architecture decisions

| Choice | Why |
|---|---|
| `export const runtime = 'edge'` | Zero cold start, globally distributed |
| `tool_choice: { type: 'tool' }` | Forces structured output — no prompt-coercing, no JSON parse gambling |
| `ReadableStream` + staggered emit | Verdict-by-verdict UX without actual streaming complexity |
| `drainSSE` async generator | SSE consumption without blocking the event loop |
| `useReducer` + discriminated union | Phase transitions (idle → running → done → errored) stay type-safe |

## Setup

```bash
npm install
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).