interface Props { score: number }
export default function ScoreDisplay({ score }: Props) {
  return (
    <div className="fixed top-4 right-4 bg-yellow-400 text-yellow-900 font-bold px-4 py-2 rounded-full text-lg shadow">
      ⭐ {score} pts
    </div>
  )
}
