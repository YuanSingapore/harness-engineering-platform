import { getDailyWords, submitAnswer } from './api'

global.fetch = jest.fn()

const mockFetch = (data: unknown) => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => data,
  })
}

describe('api client', () => {
  beforeEach(() => jest.clearAllMocks())

  test('getDailyWords calls correct endpoint', async () => {
    mockFetch({ words: [], date: '2026-08-01' })
    const result = await getDailyWords()
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/api/words/daily')
    expect(result.date).toBe('2026-08-01')
  })

  test('submitAnswer posts to correct endpoint', async () => {
    mockFetch({ is_correct: true, score_delta: 5, total_score: 5 })
    const result = await submitAnswer({
      word: 'anxious', chosen_answer: 'feeling worried',
      correct_answer: 'feeling worried', is_correct: true, round: 1
    })
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/quiz/answer',
      expect.objectContaining({ method: 'POST' })
    )
    expect(result.score_delta).toBe(5)
  })
})
