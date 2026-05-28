'use client'

import { useCallback, useReducer, useRef, useState } from 'react'
import type { EvalAction, EvalState, Rule, Verdict } from '@/types/eval'

const SCROLLS: Rule[] = [
  { id: 'r1', label: 'No lazy comments', probe: 'No inline comments explaining self-evident code. Comments only for WHY, never WHAT.', weight: 8 },
  { id: 'r2', label: 'Real error handling', probe: 'catch blocks must act — no bare console.log, no silent swallows, no returning null as a cop-out.', weight: 9 },
  { id: 'r3', label: 'No magic numbers', probe: 'All numeric literals except 0 and 1 must be named constants.', weight: 7 },
  { id: 'r4', label: 'Edge-case aware', probe: 'null, undefined, empty arrays, and boundary values are explicitly handled or rejected.', weight: 9 },
  { id: 'r5', label: 'Tight scope', probe: 'Functions stay under ~20 lines and own exactly one responsibility.', weight: 7 },
]

const SAMPLE = `async function fetchUserData(userId) {
  try {
    // Make the API call to get user data
    const response = await fetch(\`/api/users/\${userId}\`)
    const data = await response.json()
    // Return the user
    return data
  } catch (e) {
    console.log('Error:', e)
    return null
  }
}`

const ZERO_STATE: EvalState = { phase: 'idle', verdicts: [], elapsed: 0, error: null }

function reduce(s: EvalState, a: EvalAction): EvalState {
  switch (a.type) {
    case 'run/start':   return { ...ZERO_STATE, phase: 'running' }
    case 'run/verdict': return { ...s, verdicts: [...s.verdicts, a.verdict] }
    case 'run/done':    return { ...s, phase: 'done', elapsed: a.elapsed }
    case 'run/error':   return { ...s, phase: 'errored', error: a.message }
    case 'run/reset':   return ZERO_STATE
  }
}

async function* drainSSE(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const dec = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const parts = buf.split('\n\n')
    buf = parts.pop() ?? ''
    for (const p of parts) {
      if (p.startsWith('data: ')) yield p.slice(6)
    }
  }
}

function tally(verdicts: Verdict[], rules: Rule[]) {
  if (!verdicts.length) return 0
  const wmap = new Map(rules.map(r => [r.id, r.weight]))
  const { n, d } = verdicts.reduce(
    ({ n, d }, v) => {
      const w = wmap.get(v.ruleId) ?? 1
      return { n: n + v.score * w, d: d + w }
    },
    { n: 0, d: 0 }
  )
  return d ? +(n / d).toFixed(1) : 0
}

const chip = (s: Verdict['severity']) =>
  s === 'pass' ? 'border-emerald-700 bg-emerald-950/40 text-emerald-300'
  : s === 'warn' ? 'border-amber-700 bg-amber-950/40 text-amber-300'
  : 'border-red-700 bg-red-950/40 text-red-300'

const bar = (s: Verdict['severity']) =>
  s === 'pass' ? 'bg-emerald-500' : s === 'warn' ? 'bg-amber-500' : 'bg-red-500'

export default function Dashboard() {
  const [state, dispatch] = useReducer(reduce, ZERO_STATE)
  const [rules, setRules] = useState<Rule[]>(SCROLLS)
  const bench = useRef<HTMLTextAreaElement>(null)

  const run = useCallback(async () => {
    const code = bench.current?.value?.trim()
    if (!code || state.phase === 'running') return

    dispatch({ type: 'run/start' })
    const t0 = Date.now()

    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, rules }),
      })

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      for await (const token of drainSSE(res.body.getReader())) {
        if (token === '[DONE]') {
          dispatch({ type: 'run/done', elapsed: Date.now() - t0 })
          break
        }
        try { dispatch({ type: 'run/verdict', verdict: JSON.parse(token) }) } catch {}
      }
    } catch (e) {
      dispatch({ type: 'run/error', message: String(e) })
    }
  }, [rules, state.phase])

  const score = tally(state.verdicts, rules)
  const scoreHue = score >= 8 ? 'text-emerald-400' : score >= 5 ? 'text-amber-400' : 'text-red-400'

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold tracking-widest uppercase text-zinc-300">
            AI Code Pattern Evaluator
          </h1>
          <p className="text-xs text-zinc-600 mt-0.5">Rules-based LLM code review · Edge-streamed verdicts</p>
        </div>
        {state.phase !== 'idle' && (
          <button
            onClick={() => dispatch({ type: 'run/reset' })}
            className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            ← reset
          </button>
        )}
      </header>

      <div className="grid grid-cols-2 h-[calc(100vh-57px)]">
        <div className="border-r border-zinc-800 flex flex-col">
          <div className="flex-1 flex flex-col p-4 gap-3 min-h-0">
            <div className="flex items-center justify-between shrink-0">
              <span className="text-xs text-zinc-500 uppercase tracking-wider">Bench</span>
              <button
                onClick={() => { if (bench.current) bench.current.value = SAMPLE }}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                load sample ↓
              </button>
            </div>
            <textarea
              ref={bench}
              placeholder="Paste AI-generated code here…"
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-sm text-zinc-200 placeholder:text-zinc-700 resize-none focus:outline-none focus:border-zinc-600 leading-relaxed"
              onKeyDown={e => { if (e.metaKey && e.key === 'Enter') run() }}
            />
          </div>

          <div className="border-t border-zinc-800 p-4 flex flex-col gap-3 max-h-64 overflow-y-auto shrink-0">
            <span className="text-xs text-zinc-500 uppercase tracking-wider">Rubric</span>
            {rules.map((rule, i) => (
              <div key={rule.id} className="grid grid-cols-[1fr_auto] gap-2 items-start">
                <div className="space-y-1 min-w-0">
                  <input
                    value={rule.label}
                    onChange={e => setRules(r => r.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                    className="w-full bg-transparent text-xs text-zinc-300 border-b border-zinc-800 pb-0.5 focus:outline-none focus:border-zinc-600 truncate"
                  />
                  <input
                    value={rule.probe}
                    onChange={e => setRules(r => r.map((x, j) => j === i ? { ...x, probe: e.target.value } : x))}
                    className="w-full bg-transparent text-xs text-zinc-600 focus:outline-none truncate"
                  />
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-zinc-600 w-3 text-right tabular-nums">{rule.weight}</span>
                  <input
                    type="range" min="1" max="10" value={rule.weight}
                    onChange={e => setRules(r => r.map((x, j) => j === i ? { ...x, weight: +e.target.value } : x))}
                    className="w-14 accent-indigo-500"
                  />
                  <button
                    onClick={() => setRules(r => r.filter((_, j) => j !== i))}
                    className="text-zinc-700 hover:text-red-500 transition-colors text-xs leading-none"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={() =>
                setRules(r => [...r, { id: `r${Date.now()}`, label: 'New rule', probe: 'Describe what to check for', weight: 5 }])
              }
              className="text-xs text-zinc-700 hover:text-zinc-400 transition-colors text-left"
            >
              + add rule
            </button>
          </div>

          <div className="p-4 border-t border-zinc-800 shrink-0">
            <button
              onClick={run}
              disabled={state.phase === 'running'}
              className="w-full py-2.5 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg transition-colors font-medium tracking-wide"
            >
              {state.phase === 'running' ? 'Evaluating…' : 'Run Evaluation'}
            </button>
            <p className="text-center text-xs text-zinc-700 mt-2">⌘ + Enter</p>
          </div>
        </div>

        <div className="flex flex-col p-4 gap-4 overflow-y-auto">
          {state.phase === 'idle' && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-zinc-700 text-sm">Paste code → run evaluation</p>
            </div>
          )}

          {(state.phase === 'running' || state.phase === 'done') && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 uppercase tracking-wider">
                  {state.phase === 'running'
                    ? `Evaluating ${state.verdicts.length}/${rules.length}…`
                    : `Done · ${state.elapsed}ms`}
                </span>
                {state.verdicts.length > 0 && (
                  <span className={`text-2xl font-bold tabular-nums ${scoreHue}`}>
                    {score}
                    <span className="text-xs text-zinc-600 font-normal">/10</span>
                  </span>
                )}
              </div>

              {state.phase === 'running' && (
                <div className="h-0.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${(state.verdicts.length / rules.length) * 100}%` }}
                  />
                </div>
              )}

              <div className="space-y-3">
                {state.verdicts.map(v => {
                  const rule = rules.find(r => r.id === v.ruleId)
                  return (
                    <div key={v.ruleId} className={`border rounded-lg p-3 space-y-2 ${chip(v.severity)}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{rule?.label ?? v.ruleId}</span>
                        <span className="text-sm font-bold tabular-nums">{v.score}/10</span>
                      </div>
                      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${bar(v.severity)}`}
                          style={{ width: `${v.score * 10}%` }}
                        />
                      </div>
                      <p className="text-xs opacity-60 leading-relaxed">{v.rationale}</p>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {state.phase === 'errored' && (
            <div className="border border-red-800 bg-red-950/30 rounded-lg p-4 text-sm text-red-400">
              {state.error}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}