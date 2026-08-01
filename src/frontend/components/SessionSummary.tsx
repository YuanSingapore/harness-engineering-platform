interface Props { score: number; wordsCorrect: number; wordsToReview: string[] }
export default function SessionSummary({ score, wordsCorrect, wordsToReview }: Props) {
  const messages = ['Great work today! 🌟', "You're doing amazing! ⭐", 'Keep it up! 🚀']
  const msg = messages[Math.floor(wordsCorrect % messages.length)]
  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 max-w-xl mx-auto text-center">
      <h2 className="text-3xl font-bold text-blue-600 mb-2">{msg}</h2>
      <p className="text-5xl font-bold text-yellow-500 my-4">{score} pts</p>
      <p className="text-gray-600 mb-6">{wordsCorrect} words mastered today!</p>
      {wordsToReview.length > 0 && (
        <div className="bg-blue-50 rounded-xl p-4 text-left">
          <p className="font-semibold text-blue-700 mb-2">Words to keep practising:</p>
          <ul className="list-disc list-inside text-gray-600">
            {wordsToReview.map(w => <li key={w}>{w}</li>)}
          </ul>
        </div>
      )}
      <p className="text-gray-500 mt-6 text-sm">See you tomorrow! 👋</p>
    </div>
  )
}
