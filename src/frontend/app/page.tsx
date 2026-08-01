'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSessionToday, SessionState } from '@/lib/api'

export default function HomePage() {
  const [session, setSession] = useState<SessionState | null>(null)
  const router = useRouter()

  useEffect(() => {
    getSessionToday().then(setSession)
  }, [])

  const roundLabel = session?.completed ? 'Completed!' :
    session ? `Round ${session.current_round}` : 'Loading...'

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold text-blue-600 mb-2">English Buddy</h1>
      <p className="text-gray-500 mb-8">Hi Xiaowei! Ready to practise today?</p>
      {session && (
        <div className="bg-white rounded-2xl shadow p-6 mb-8 text-center w-full max-w-sm">
          <p className="text-gray-500 text-sm mb-1">Today's progress</p>
          <p className="text-2xl font-bold text-blue-500">{roundLabel}</p>
          <p className="text-yellow-500 font-semibold mt-2">⭐ {session.total_score} pts</p>
        </div>
      )}
      <button onClick={() => router.push('/quiz')} disabled={session?.completed}
        className="bg-blue-500 text-white px-8 py-4 rounded-2xl text-xl font-bold hover:bg-blue-600 disabled:opacity-50 transition-colors shadow-lg">
        {session?.completed ? 'Done for today! 🎉' : 'Start Practice →'}
      </button>
    </main>
  )
}
