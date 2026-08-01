import { WordOut } from '@/lib/api'
interface Props { word: WordOut; onNext: () => void }
export default function ReviewCard({ word, onNext }: Props) {
  return (
    <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6 max-w-xl mx-auto">
      <p className="text-green-600 font-semibold mb-2">Let&#39;s review this word 🌟</p>
      <h3 className="text-2xl font-bold text-green-800 mb-2">{word.word}</h3>
      <p className="text-gray-700 mb-1"><span className="font-semibold">Meaning:</span> {word.meaning}</p>
      <p className="text-gray-600 text-sm italic mb-4">&quot;{word.example_sentence}&quot;</p>
      <button onClick={onNext}
        className="w-full bg-green-500 text-white py-3 rounded-xl font-semibold hover:bg-green-600 transition-colors">
        Next →
      </button>
    </div>
  )
}
