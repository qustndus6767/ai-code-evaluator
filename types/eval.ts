export interface Scores {
  scannability: number
  pragmaticCleverness: number
  redundancyPenalty: number
}

export type Grade = 'S' | 'A' | 'B' | 'C' | 'F'

export interface Shot {
  scores: Scores
  composite: number
  grade: Grade
  summary: string
  callouts: string[]
}

export type Phase = 'idle' | 'loading' | 'done' | 'err'