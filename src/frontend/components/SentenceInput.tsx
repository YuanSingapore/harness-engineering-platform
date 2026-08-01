import { useState } from 'react'
interface Props { word: string; onSubmit: (sentence: string) => void }
export default function SentenceInput({ word, onSubmit }: Props) {
  const [value, setValue] = useState('')
  return (
    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-6 max-w-xl mx-auto">
      <p className="text-yellow-700 font-semibold mb-2">Write a sentence using:</p>
      <h3 className="text-2xl font-bold text-yellow-800 mb-4">{word}</h3>
      <textarea value={value} onChange={e => setValue(e.target.value)}
        className="w-full border-2 border-yellow-300 rounded-xl p-3 text-gray-700 min-h-[80px] focus:outline-none focus:border-yellow-500"
        placeholder={`Write a sentence with "${word}"...`} />
      <button onClick={() => value.trim() && onSubmit(value.trim())} disabled={!value.trim()}
        className="mt-3 w-full bg-yellow-500 text-white py-3 rounded-xl font-semibold hover:bg-yellow-600 disabled:opacity-50 transition-colors">
        Submit →
      </button>
    </div>
  )
}
