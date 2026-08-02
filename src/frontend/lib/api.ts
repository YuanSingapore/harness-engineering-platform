const API_BASE = 'http://localhost:8000'

export interface WordOut {
  id: number; word: string; part_of_speech: string; category: string
  meaning: string; synonym: string; example_sentence: string
}
export interface DailyWordsResponse { words: WordOut[]; date: string }
export interface SessionState {
  date: string; current_round: number; total_score: number; completed: boolean
  round1_words: string[]; round2_words: string[]; round3_words: string[]
}
export interface QuizQuestion {
  word: string; question: string; choices: string[]
  correct_answer: string; explanation: string; pronunciation?: string
}
export interface GenerateQuizRequest {
  words: WordOut[]; round: number; previous_questions: string[]
}
export interface GenerateQuizResponse { questions: QuizQuestion[] }
export interface AnswerRequest {
  word: string; chosen_answer: string; correct_answer: string
  is_correct: boolean; round: number
}
export interface AnswerResponse { is_correct: boolean; score_delta: number; total_score: number }
export interface CompleteSessionRequest { wrong_words: string[]; date: string }
export interface WrongWordEntry { word: string; last_wrong_date: string; wrong_count: number }

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  return res.json()
}

export const getDailyWords = () => get<DailyWordsResponse>('/api/words/daily')
export const getSessionToday = () => get<SessionState>('/api/quiz/session/today')
export const getRecentWrongWords = () => get<WrongWordEntry[]>('/api/wrongwords/recent')
export const generateQuiz = (req: GenerateQuizRequest) => post<GenerateQuizResponse>('/api/quiz/generate', req)
export const submitAnswer = (req: AnswerRequest) => post<AnswerResponse>('/api/quiz/answer', req)
export const completeSession = (req: CompleteSessionRequest) => post<{ ok: boolean }>('/api/session/complete', req)

export interface MCQQuestion {
  word: string; question: string; choices: string[]
  correct_answer: string; explanation: string
}
export interface MCQSessionState {
  date: string; current_round: number; total_score: number; completed: boolean
  round1_words: string[]; round2_words: string[]; round3_words: string[]
}
export interface MCQAnswerRequest {
  word: string; is_correct: boolean; round: number; date: string
}
export interface MCQAnswerResponse { score_delta: number; total_score: number }
export interface MCQCompleteRequest { wrong_words: string[]; date: string }
export interface MCQGenerateRequest { words: WordOut[]; previous_questions: string[] }
export interface MCQGenerateResponse { questions: MCQQuestion[] }

export const getMCQSessionToday = () => get<MCQSessionState>('/api/mcq/session/today')
export const getMCQQuestionsToday = () => get<MCQGenerateResponse>('/api/mcq/questions/today')
export const generateMCQRound = (req: MCQGenerateRequest) => post<MCQGenerateResponse>('/api/mcq/generate', req)
export const submitMCQAnswer = (req: MCQAnswerRequest) => post<MCQAnswerResponse>('/api/mcq/answer', req)
export const completeMCQSession = (req: MCQCompleteRequest) => post<{ ok: boolean }>('/api/mcq/session/complete', req)

export interface BonusSessionState {
  date: string; total_score: number; completed: boolean
}
export interface BonusWordsResponse { words: WordOut[] }
export interface BonusAnswerRequest { word: string; is_correct: boolean; date: string }
export interface BonusAnswerResponse { score_delta: number; total_score: number }
export interface BonusCompleteRequest { correct_words: string[]; date: string }

export const getBonusSession = () => get<BonusSessionState>('/api/bonus/session/today')
export const getBonusWords = () => get<BonusWordsResponse>('/api/bonus/words')
export const submitBonusAnswer = (req: BonusAnswerRequest) => post<BonusAnswerResponse>('/api/bonus/answer', req)
export const completeBonusSession = (req: BonusCompleteRequest) => post<{ ok: boolean }>('/api/bonus/session/complete', req)
