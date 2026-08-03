'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSessionToday, getMCQSessionToday, getBonusSession, getBonusWords, SessionState, MCQSessionState, BonusSessionState } from '@/lib/api'

export default function HomePage() {
  const [session, setSession] = useState<SessionState | null>(null)
  const [mcqSession, setMcqSession] = useState<MCQSessionState | null>(null)
  const [bonusSession, setBonusSession] = useState<BonusSessionState | null>(null)
  const [hasBonusWords, setHasBonusWords] = useState(false)
  const router = useRouter()

  useEffect(() => {
    Promise.all([getSessionToday(), getMCQSessionToday(), getBonusSession(), getBonusWords()]).then(([s, m, b, bw]) => {
      setSession(s)
      setMcqSession(m)
      setBonusSession(b)
      setHasBonusWords(bw.words.length > 0)
    })
  }, [])

  const s1Done = session?.completed ?? false
  const s2Done = mcqSession?.completed ?? false
  const bonusDone = bonusSession?.completed ?? false
  const allDone = s1Done && s2Done && (!hasBonusWords || bonusDone)

  const statusLabel = !session ? 'Loading...'
    : allDone ? 'All done for today! 🎉'
    : s1Done && s2Done ? 'Bonus ready!'
    : s1Done ? 'Section 2 ready!'
    : `Round ${session.current_round}`

  const totalScore = (session?.total_score ?? 0) + (mcqSession?.total_score ?? 0)

  const handleStart = () => {
    if (s1Done && !s2Done) {
      router.push('/quiz?section=2')
    } else {
      router.push('/quiz')
    }
  }

  const buttonLabel = allDone ? 'Done for today! 🎉'
    : s1Done ? 'Continue to Section 2 →'
    : 'Start Practice →'

  const showBonus = s2Done && hasBonusWords && !bonusDone

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold text-blue-600 mb-2">English Buddy</h1>
      <p className="text-gray-500 mb-8">Hi Xiaowei! Ready to practise today?</p>
      {session && (
        <div className="bg-white rounded-2xl shadow p-6 mb-8 text-center w-full max-w-sm">
          <p className="text-gray-500 text-sm mb-1">Today&#39;s progress</p>
          <p className="text-2xl font-bold text-blue-500">{statusLabel}</p>
          <p className="text-yellow-500 font-semibold mt-2">⭐ {totalScore} pts</p>
        </div>
      )}
      <button onClick={handleStart} disabled={allDone || (s1Done && s2Done)}
        className="bg-blue-500 text-white px-8 py-4 rounded-2xl text-xl font-bold hover:bg-blue-600 disabled:opacity-50 transition-colors shadow-lg mb-4 w-full max-w-sm">
        {buttonLabel}
      </button>
      {showBonus && (
        <button onClick={() => router.push('/quiz?section=bonus')}
          className="bg-yellow-500 text-white px-8 py-4 rounded-2xl text-xl font-bold hover:bg-yellow-600 transition-colors shadow-lg w-full max-w-sm">
          ⭐ Bonus Revision →
        </button>
      )}
    </main>
  )
}
