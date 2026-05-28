'use client'

import { useReducer, useRef } from 'react'
import type { Grade, Phase, Shot } from '@/types/eval'

const DEAD_SAMPLE = `async function getUserData(userId) {
  try {
    // Call the API to get user data
    const response = await fetch('/api/users/' + userId)
    // Parse the response
    const data = await response.json()
    // Return data to caller
    return data
  } catch (error) {
    // Log error to console
    console.log('Error occurred:', error)
    return null
  }
}`

type State =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'done'; shot: Shot }
  | { phase: 'err'; msg: string }

type Action =
  | { type: 'fire' }
  | { type: 'land'; shot: Shot }
  | { type: 'explode'; msg: string }
  | { type: 'reset' }

const smash = (_: State, a: Action): State => (({
  fire:    { phase: 'loading' },
  land:    { phase: 'done', shot: (a as Extract<Action, { type: 'land' }>).shot },
  explode: { phase: 'err', msg: (a as Extract<Action, { type: 'explode' }>).msg },
  reset:   { phase: 'idle' },
} satisfies Record<Action['type'], State>)[a.type])

const gradeRing: Record<Grade, string> = {
  S: 'text-violet-400 border-violet-500',
  A: 'text-emerald-400 border-emerald-500',
  B: 'text-sky-400 border-sky-500',
  C: 'text-amber-400 border-amber-500',
  F: 'text-red-400 border-red-500',
}

const meterFill = (n: number, invert = false) => {
  const v = invert ? 10 - n : n
  return v >= 8 ? 'bg-emerald-500' : v >= 5 ? 'bg-amber-500' : 'bg-red-500'
}

function Meter({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  const display = invert ? 10 - value : value
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className="tabular-nums text-zinc-300">{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${meterFill(value, invert)}`}
          style={{ width: `${display * 10}%` }}
        />
      </div>
    </div>
  )
}

export default function Bench() {
  const [state, dispatch] = useReducer(smash, { phase: 'idle' })
  const pad = useRef<HTMLTextAreaElement>(null)

  const fire = async () => {
    const code = pad.current?.value.trim()
    if (!code || state.phase === 'loading') return

    dispatch({ type: 'fire' })

    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const shot = await res.json() as Shot
      dispatch({ type: 'land', shot })
    } catch (e) {
      dispatch({ type: 'explode', msg: String(e) })
    }
  }

  const phase = state.phase as Phase

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-mono flex flex-col">
      <header className="border-b border-zinc-800/60 px-6 py-3.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          <span className="text-xs font-semibold tracking-[0.15em] uppercase text-zinc-300">
            AI Code Pattern Evaluator
          </span>
        </div>
        {phase !== 'idle' && (
          <button
            onClick={() => dispatch({ type: 'reset' })}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            ← reset
          </button>
        )}
      </header>

      <div className="flex-1 grid grid-cols-2 min-h-0">
        <div className="border-r border-zinc-800/60 flex flex-col min-h-0">
          <div className="flex-1 flex flex-col p-5 gap-3 min-h-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Input</span>
              <button
                onClick={() => { if (pad.current) pad.current.value = DEAD_SAMPLE }}
                className="text-[10px] text-zinc-700 hover:text-zinc-400 transition-colors"
              >
                load slop sample ↓
              </button>
            </div>
            <textarea
              ref={pad}
              spellCheck={false}
              placeholder="Paste code here…"
              className="flex-1 bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 text-xs text-zinc-200 placeholder:text-zinc-700 resize-none focus:outline-none focus:border-zinc-700 leading-[1.7]"
              onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') fire() }}
            />
          </div>

          <div className="p-5 pt-0 shrink-0">
            <button
              onClick={fire}
              disabled={phase === 'loading'}
              className="w-full py-2.5 text-xs font-semibold tracking-widest uppercase bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg transition-all"
            >
              {phase === 'loading' ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3 h-3 border border-zinc-500 border-t-zinc-300 rounded-full animate-spin" />
                  Evaluating
                </span>
              ) : 'Run Evaluation'}
            </button>
            <p className="text-center text-[10px] text-zinc-700 mt-2">⌘ + Enter</p>
          </div>
        </div>

        <div className="flex flex-col p-5 gap-5 overflow-y-auto">
          {phase === 'idle' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
              <p className="text-xs text-zinc-700">Drop your code in, get a verdict.</p>
              <p className="text-[10px] text-zinc-800">No mercy. No hedging.</p>
            </div>
          )}

          {phase === 'loading' && (
            <div className="flex-1 flex items-center justify-center">
              <div className="space-y-3 w-full max-w-xs">
                {['Parsing patterns…', 'Checking for slop…', 'Calibrating ruthlessness…'].map(t => (
                  <div key={t} className="flex items-center gap-3">
                    <div className="w-1 h-1 rounded-full bg-zinc-700 animate-pulse" />
                    <span className="text-xs text-zinc-700">{t}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {phase === 'done' && state.phase === 'done' && (() => {
            const { shot } = state
            return (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className={`w-16 h-16 rounded-xl border-2 flex items-center justify-center shrink-0 ${gradeRing[shot.grade]}`}>
                    <span className="text-2xl font-black">{shot.grade}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-300 leading-relaxed">{shot.summary}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="text-[10px] text-zinc-700">composite</span>
                      <span className={`text-lg font-bold tabular-nums ${gradeRing[shot.grade].split(' ')[0]}`}>
                        {shot.composite.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-zinc-700">/ 10</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 border border-zinc-800/60 rounded-lg p-4">
                  <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Scores</span>
                  <Meter label="Scannability" value={shot.scores.scannability} />
                  <Meter label="Pragmatic Cleverness" value={shot.scores.pragmaticCleverness} />
                  <Meter label="Redundancy Penalty" value={shot.scores.redundancyPenalty} invert />
                </div>

                {shot.callouts.length > 0 && (
                  <div className="space-y-2 border border-zinc-800/60 rounded-lg p-4">
                    <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Callouts</span>
                    {shot.callouts.map((c, i) => (
                      <div key={i} className="flex gap-2.5 items-start">
                        <span className="text-[10px] text-zinc-700 mt-0.5 tabular-nums shrink-0">{String(i + 1).padStart(2, '0')}</span>
                        <p className="text-xs text-zinc-400 leading-relaxed font-mono">{c}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )
          })()}

          {phase === 'err' && state.phase === 'err' && (
            <div className="border border-red-900/50 bg-red-950/20 rounded-lg p-4 text-xs text-red-400">
              {state.msg}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}