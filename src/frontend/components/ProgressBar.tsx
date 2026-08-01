const STEPS = ['Round 1', 'Review', 'Round 2', 'Review', 'Round 3', 'Done']
interface Props { step: number }
export default function ProgressBar({ step }: Props) {
  return (
    <div className="flex items-center justify-center gap-1 my-4">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            i < step ? 'bg-green-400 text-white' :
            i === step ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
          }`}>{label}</div>
          {i < STEPS.length - 1 && <div className="w-4 h-0.5 bg-gray-300" />}
        </div>
      ))}
    </div>
  )
}
