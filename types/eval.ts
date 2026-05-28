export type Severity = 'pass' | 'warn' | 'fail'

export interface Rule {
  id: string
  label: string
  probe: string
  weight: number
}

export interface Verdict {
  ruleId: string
  score: number
  severity: Severity
  rationale: string
}

export type EvalPhase = 'idle' | 'running' | 'done' | 'errored'

export interface EvalState {
  phase: EvalPhase
  verdicts: Verdict[]
  elapsed: number
  error: string | null
}

export type EvalAction =
  | { type: 'run/start' }
  | { type: 'run/verdict'; verdict: Verdict }
  | { type: 'run/done'; elapsed: number }
  | { type: 'run/error'; message: string }
  | { type: 'run/reset' }