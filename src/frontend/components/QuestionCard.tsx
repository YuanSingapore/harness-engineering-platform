import { QuizQuestion } from '@/lib/api'
interface Props { question: QuizQuestion; onAnswer: (choice: string, isCorrect: boolean) => void }
export default function QuestionCard({ question, onAnswer }: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-6 max-w-xl mx-auto">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">{question.question}</h2>
      <div className="grid grid-cols-1 gap-3">
        {question.choices.map((choice) => (
          <button key={choice} onClick={() => onAnswer(choice, choice === question.correct_answer)}
            className="w-full text-left px-4 py-3 rounded-xl border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-gray-700 font-medium">
            {choice}
          </button>
        ))}
      </div>
    </div>
  )
}
