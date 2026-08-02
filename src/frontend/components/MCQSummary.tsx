interface Props {
  score: number
  wordsCorrect: number
  wordsToReview: string[]
  onDone: () => void
}

export default function MCQSummary({ score, wordsCorrect, wordsToReview, onDone }: Props) {
  const messages = ['Well done on Section 2! 🌟', 'You completed both sections! ⭐', 'Amazing effort today! 🚀']
  const msg = messages[wordsCorrect % messages.length]
  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 max-w-xl mx-auto text-center">
      <p className="text-sm font-semibold text-purple-500 uppercase tracking-wide mb-2">Section 2 Complete</p>
      <h2 className="text-3xl font-bold text-purple-600 mb-2">{msg}</h2>
      <p className="text-5xl font-bold text-yellow-500 my-4">{score} pts</p>
      <p className="text-gray-600 mb-6">{wordsCorrect} workbook words mastered!</p>
      {wordsToReview.length > 0 && (
        <div className="bg-purple-50 rounded-xl p-4 text-left mb-6">
          <p className="font-semibold text-purple-700 mb-2">Words to keep practising:</p>
          <ul className="list-disc list-inside text-gray-600">
            {wordsToReview.map(w => <li key={w}>{w}</li>)}
          </ul>
        </div>
      )}
      <button
        onClick={onDone}
        className="w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 rounded-xl transition-colors"
      >
        Back to Home
      </button>
    </div>
  )
}
