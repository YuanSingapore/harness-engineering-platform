'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import ScoreDisplay from '@/components/ScoreDisplay'
import ProgressBar from '@/components/ProgressBar'
import QuestionCard from '@/components/QuestionCard'
import ExplanationCard from '@/components/ExplanationCard'
import ReviewCard from '@/components/ReviewCard'
import ConversationCard from '@/components/ConversationCard'
import SentenceInput from '@/components/SentenceInput'
import SessionSummary from '@/components/SessionSummary'
import {
  getDailyWords, getRecentWrongWords, generateQuiz, submitAnswer, completeSession,
  WordOut, QuizQuestion, WrongWordEntry
} from '@/lib/api'

type Phase = 'round1' | 'explain' | 'review1' | 'round2' | 'review2_explain' | 'review2_write' | 'round3' | 'summary'

export default function QuizPage() {
  const router = useRouter()
  const [score, setScore] = useState(0)
  const [phase, setPhase] = useState<Phase>('round1')
  const [dailyWords, setDailyWords] = useState<WordOut[]>([])
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [questionIndex, setQuestionIndex] = useState(0)
  const [wrongWords, setWrongWords] = useState<{ r1: string[], r2: string[], r3: string[] }>({ r1: [], r2: [], r3: [] })
  const [r2WordNames, setR2WordNames] = useState<string[]>([])
  const [reviewIndex, setReviewIndex] = useState(0)
  const [previousQuestions, setPreviousQuestions] = useState<string[]>([])
  const [pendingExplain, setPendingExplain] = useState<QuizQuestion | null>(null)
  const [reviewWords, setReviewWords] = useState<WordOut[]>([])
  const [recentWrong, setRecentWrong] = useState<WrongWordEntry[]>([])
  // Track which round triggered the explain phase so onContinue can return to the correct round
  const explainOriginPhase = useRef<Phase>('round1')
  const previousQuestionsRef = useRef<string[]>([])

  const getWordObj = useCallback((word: string) =>
    dailyWords.find(w => w.word === word) ?? { id: 0, word, part_of_speech: '', category: '', meaning: '', synonym: '', example_sentence: '' },
    [dailyWords])

  const loadRound = useCallback(async (round: number, wordList: WordOut[]) => {
    const qs = await generateQuiz({ words: wordList, round, previous_questions: previousQuestionsRef.current })
    setQuestions(qs.questions)
    setQuestionIndex(0)
    setPreviousQuestions(prev => {
      const updated = [...prev, ...qs.questions.map(q => q.question)]
      previousQuestionsRef.current = updated
      return updated
    })
  }, [])

  useEffect(() => {
    Promise.all([getDailyWords(), getRecentWrongWords()]).then(([daily, recent]) => {
      setDailyWords(daily.words)
      setRecentWrong(recent)
      generateQuiz({ words: daily.words, round: 1, previous_questions: [] }).then(qs => {
        setQuestions(qs.questions)
        const initialQuestions = qs.questions.map(q => q.question)
        previousQuestionsRef.current = initialQuestions
        setPreviousQuestions(initialQuestions)
      })
    })
  }, [])

  const endRound = useCallback(async (roundPhase: Phase, currentWrongWords: { r1: string[], r2: string[], r3: string[] }, currentQuestionIndex: number, currentQuestions: QuizQuestion[]) => {
    if (roundPhase === 'round1') {
      const r1Wrong = currentWrongWords.r1
      const topupWords = recentWrong
        .filter(w => !r1Wrong.includes(w.word))
        .slice(0, r1Wrong.length < 5 ? 3 : 0)
        .map(w => w.word)
      const r2WordNamesList = [...r1Wrong, ...topupWords]
      setR2WordNames(r2WordNamesList)
      const r2Words = r2WordNamesList.map(getWordObj)
      setReviewWords(r1Wrong.map(getWordObj))
      setReviewIndex(0)
      setPhase('review1')
      await loadRound(2, r2Words)
    } else if (roundPhase === 'round2') {
      const r2Wrong = currentWrongWords.r2
      const topupWords = recentWrong
        .filter(w => !r2Wrong.includes(w.word) && !r2WordNames.includes(w.word))
        .slice(0, r2Wrong.length < 5 ? 3 : 0)
        .map(w => w.word)
      const r3WordNames = [...r2Wrong, ...topupWords]
      const r3Words = r3WordNames.map(getWordObj)
      setReviewWords(r2Wrong.map(getWordObj))
      setReviewIndex(0)
      setPhase('review2_explain')
      await loadRound(3, r3Words)
    } else if (roundPhase === 'round3') {
      const allWrong = [...new Set([...currentWrongWords.r1, ...currentWrongWords.r2, ...currentWrongWords.r3])]
      await completeSession({ wrong_words: allWrong, date: new Date().toISOString().split('T')[0] })
      setPhase('summary')
    }
  }, [recentWrong, getWordObj, loadRound, r2WordNames])

  // Use refs to always have fresh state in callbacks
  const phaseRef = useRef(phase)
  const wrongWordsRef = useRef(wrongWords)
  const questionIndexRef = useRef(questionIndex)
  const questionsRef = useRef(questions)
  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { wrongWordsRef.current = wrongWords }, [wrongWords])
  useEffect(() => { questionIndexRef.current = questionIndex }, [questionIndex])
  useEffect(() => { questionsRef.current = questions }, [questions])

  const advanceQuestion = useCallback((currentPhase: Phase, currentIndex: number, currentQuestions: QuizQuestion[], currentWrongWords: { r1: string[], r2: string[], r3: string[] }) => {
    if (currentIndex + 1 < currentQuestions.length) {
      setQuestionIndex(currentIndex + 1)
    } else {
      endRound(currentPhase, currentWrongWords, currentIndex, currentQuestions)
    }
  }, [endRound])

  const handleAnswer = async (choice: string, isCorrect: boolean) => {
    const currentPhase = phaseRef.current
    const currentIndex = questionIndexRef.current
    const currentQuestions = questionsRef.current
    const q = currentQuestions[currentIndex]
    const res = await submitAnswer({ word: q.word, chosen_answer: choice, correct_answer: q.correct_answer, is_correct: isCorrect, round: currentPhase === 'round1' ? 1 : currentPhase === 'round2' ? 2 : 3 })
    setScore(res.total_score)
    if (!isCorrect) {
      let updatedWrongWords = wrongWordsRef.current
      if (currentPhase === 'round1') {
        updatedWrongWords = { ...updatedWrongWords, r1: [...updatedWrongWords.r1, q.word] }
      } else if (currentPhase === 'round2') {
        updatedWrongWords = { ...updatedWrongWords, r2: [...updatedWrongWords.r2, q.word] }
      } else if (currentPhase === 'round3') {
        updatedWrongWords = { ...updatedWrongWords, r3: [...updatedWrongWords.r3, q.word] }
      }
      setWrongWords(updatedWrongWords)
      wrongWordsRef.current = updatedWrongWords
      explainOriginPhase.current = currentPhase
      setPendingExplain(q)
      setPhase('explain')
    } else {
      advanceQuestion(currentPhase, currentIndex, currentQuestions, wrongWordsRef.current)
    }
  }

  const handleExplainContinue = useCallback(() => {
    const originPhase = explainOriginPhase.current
    const currentIndex = questionIndexRef.current
    const currentQuestions = questionsRef.current
    const currentWrongWords = wrongWordsRef.current
    setPendingExplain(null)
    setPhase(originPhase)
    phaseRef.current = originPhase
    advanceQuestion(originPhase, currentIndex, currentQuestions, currentWrongWords)
  }, [advanceQuestion])

  const progressStep = { round1: 0, explain: 0, review1: 1, round2: 2, review2_explain: 3, review2_write: 3, round3: 4, summary: 5 }[phase]

  if (phase === 'summary') {
    const allWrong = [...new Set([...wrongWords.r1, ...wrongWords.r2, ...wrongWords.r3])]
    return (
      <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-8">
        <SessionSummary score={score} wordsCorrect={dailyWords.length - allWrong.length} wordsToReview={allWrong} />
        <button onClick={() => router.push('/')} className="mt-6 w-full max-w-xl mx-auto block text-center text-blue-500 underline">Back to home</button>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-8">
      <ScoreDisplay score={score} />
      <ProgressBar step={progressStep} />
      <div className="mt-8">
        {(phase === 'round1' || phase === 'round2') && questions[questionIndex] && (
          <QuestionCard question={questions[questionIndex]} onAnswer={handleAnswer} />
        )}
        {phase === 'explain' && pendingExplain && (
          <ExplanationCard question={pendingExplain} onContinue={handleExplainContinue} />
        )}
        {phase === 'review1' && reviewWords[reviewIndex] && (
          <ReviewCard word={reviewWords[reviewIndex]} onNext={() => reviewIndex + 1 < reviewWords.length ? setReviewIndex(i => i + 1) : setPhase('round2')} />
        )}
        {phase === 'review2_explain' && reviewWords[reviewIndex] && (
          <ReviewCard word={reviewWords[reviewIndex]} onNext={() => reviewIndex + 1 < reviewWords.length ? setReviewIndex(i => i + 1) : (setReviewIndex(0), setPhase('review2_write'))} />
        )}
        {phase === 'review2_write' && reviewWords[reviewIndex] && (
          <SentenceInput word={reviewWords[reviewIndex].word} onSubmit={() => reviewIndex + 1 < reviewWords.length ? setReviewIndex(i => i + 1) : setPhase('round3')} />
        )}
        {phase === 'round3' && questions[questionIndex] && (
          <ConversationCard question={questions[questionIndex]} onAnswer={handleAnswer} />
        )}
      </div>
    </main>
  )
}
