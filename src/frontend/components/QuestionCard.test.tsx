import { render, screen, fireEvent } from '@testing-library/react'
import QuestionCard from './QuestionCard'

const mockQuestion = {
  word: 'anxious', question: 'What does anxious mean?',
  choices: ['feeling worried', 'very happy', 'very tired', 'feeling angry'],
  correct_answer: 'feeling worried',
  explanation: 'Anxious means feeling worried.',
  pronunciation: 'ANGK-shuhs'
}

test('renders question text', () => {
  render(<QuestionCard question={mockQuestion} onAnswer={jest.fn()} />)
  expect(screen.getByText('What does anxious mean?')).toBeInTheDocument()
})

test('renders 4 choices', () => {
  render(<QuestionCard question={mockQuestion} onAnswer={jest.fn()} />)
  expect(screen.getAllByRole('button')).toHaveLength(4)
})

test('calls onAnswer with correct boolean when choice selected', () => {
  const onAnswer = jest.fn()
  render(<QuestionCard question={mockQuestion} onAnswer={onAnswer} />)
  fireEvent.click(screen.getByText('feeling worried'))
  expect(onAnswer).toHaveBeenCalledWith('feeling worried', true)
})
