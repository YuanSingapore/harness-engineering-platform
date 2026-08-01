import { QuizQuestion } from '@/lib/api'
interface Props { question: QuizQuestion; onAnswer: (choice: string, isCorrect: boolean) => void }
export default function ConversationCard({ question, onAnswer }: Props) {
  return (
    <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-6 max-w-xl mx-auto">
      <p className="text-purple-600 font-semibold mb-3">Read this conversation 💬</p>
      <div className="bg-white rounded-xl p-4 mb-4 text-gray-700 whitespace-pre-line">{question.question}</div>
      <p className="font-semibold text-gray-700 mb-3">What does the bold word mean?</p>
      <div className="grid grid-cols-1 gap-2">
        {question.choices.map((choice) => (
          <button key={choice} onClick={() => onAnswer(choice, choice === question.correct_answer)}
            className="text-left px-4 py-3 rounded-xl border-2 border-purple-200 hover:border-purple-400 hover:bg-purple-50 transition-colors text-gray-700">
            {choice}
          </button>
        ))}
      </div>
    </div>
  )
}
