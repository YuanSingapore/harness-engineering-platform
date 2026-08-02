import { QuizQuestion } from '@/lib/api'
interface Props { question: QuizQuestion; onContinue: () => void; chosenAnswer?: string; chosenMeaning?: string }
export default function ExplanationCard({ question, onContinue, chosenAnswer, chosenMeaning }: Props) {
  return (
    <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 max-w-xl mx-auto">
      <p className="text-blue-600 font-semibold mb-3">Good try! Let&#39;s learn this word 📖</p>
      {chosenAnswer && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
          <p className="text-red-500 text-sm font-semibold mb-1">You chose: {chosenAnswer}</p>
          {chosenMeaning && <p className="text-gray-600 text-sm">{chosenMeaning}</p>}
        </div>
      )}
      <h3 className="text-2xl font-bold text-blue-800 mb-1">{question.word}</h3>
      {question.pronunciation && <p className="text-gray-500 text-sm mb-3">/{question.pronunciation}/</p>}
      <p className="text-gray-700 mb-2"><span className="font-semibold">Meaning:</span> {question.explanation}</p>
      <button onClick={onContinue}
        className="mt-4 w-full bg-blue-500 text-white py-3 rounded-xl font-semibold hover:bg-blue-600 transition-colors">
        Got it! Continue →
      </button>
    </div>
  )
}
