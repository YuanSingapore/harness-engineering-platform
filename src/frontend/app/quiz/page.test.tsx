import { render, screen } from '@testing-library/react'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

// Mock all API calls
jest.mock('@/lib/api', () => ({
  getDailyWords: jest.fn().mockResolvedValue({ words: [], date: '2026-08-01' }),
  getRecentWrongWords: jest.fn().mockResolvedValue([]),
  generateQuiz: jest.fn().mockResolvedValue({ questions: [] }),
  submitAnswer: jest.fn().mockResolvedValue({ is_correct: true, score_delta: 5, total_score: 5 }),
  completeSession: jest.fn().mockResolvedValue({ ok: true }),
}))

// Mock all components to isolate the page logic
jest.mock('@/components/ScoreDisplay', () => ({ score }: { score: number }) => <div data-testid="score-display">{score}</div>)
jest.mock('@/components/ProgressBar', () => ({ step }: { step: number }) => <div data-testid="progress-bar">{step}</div>)
jest.mock('@/components/QuestionCard', () => () => <div data-testid="question-card" />)
jest.mock('@/components/ExplanationCard', () => () => <div data-testid="explanation-card" />)
jest.mock('@/components/ReviewCard', () => () => <div data-testid="review-card" />)
jest.mock('@/components/ConversationCard', () => () => <div data-testid="conversation-card" />)
jest.mock('@/components/SentenceInput', () => () => <div data-testid="sentence-input" />)
jest.mock('@/components/SessionSummary', () => () => <div data-testid="session-summary" />)

import QuizPage from './page'

describe('QuizPage', () => {
  it('renders without crashing', () => {
    render(<QuizPage />)
    // ScoreDisplay and ProgressBar are always rendered during quiz
    expect(screen.getByTestId('score-display')).toBeInTheDocument()
    expect(screen.getByTestId('progress-bar')).toBeInTheDocument()
  })
})
