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
import MCQSummary from '@/components/MCQSummary'
import {
  getDailyWords, getRecentWrongWords, generateQuiz, submitAnswer, completeSession,
  getMCQQuestionsToday, generateMCQRound, submitMCQAnswer, completeMCQSession,
  getBonusWords, submitBonusAnswer, completeBonusSession,
  WordOut, QuizQuestion, WrongWordEntry, MCQQuestion, MCQAnswerRequest, BonusAnswerRequest
} from '@/lib/api'

type Phase = 'round1' | 'explain' | 'review1' | 'round2' | 'review2_explain' | 'review2_write' | 'round3' | 'summary'
  | 'mcq_round1' | 'mcq_explain' | 'mcq_review1' | 'mcq_round2' | 'mcq_review2' | 'mcq_round3' | 'mcq_summary'
  | 'bonus_meaning' | 'bonus_explain' | 'bonus_mcq' | 'bonus_summary'

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

  // MCQ (Section 2) state
  const [mcqQuestions, setMcqQuestions] = useState<MCQQuestion[]>([])
  const [mcqQuestionIndex, setMcqQuestionIndex] = useState(0)
  const [mcqWrongWords, setMcqWrongWords] = useState<{ r1: string[], r2: string[], r3: string[] }>({ r1: [], r2: [], r3: [] })
  const [mcqR2WordNames, setMcqR2WordNames] = useState<string[]>([])
  const [mcqReviewWords, setMcqReviewWords] = useState<WordOut[]>([])
  const [mcqReviewIndex, setMcqReviewIndex] = useState(0)
  const [mcqScore, setMcqScore] = useState(0)
  const [mcqPendingExplain, setMcqPendingExplain] = useState<MCQQuestion | null>(null)
  const [mcqChosenAnswer, setMcqChosenAnswer] = useState<string>('')
  const [mcqPreviousQuestions, setMcqPreviousQuestions] = useState<string[]>([])
  const mcqQuestionsRef = useRef<MCQQuestion[]>([])
  const mcqQuestionIndexRef = useRef(0)
  const mcqWrongWordsRef = useRef<{ r1: string[], r2: string[], r3: string[] }>({ r1: [], r2: [], r3: [] })
  const mcqExplainOriginPhase = useRef<Phase>('mcq_round1')
  const mcqPreviousQuestionsRef = useRef<string[]>([])

  // Bonus session state
  const [bonusWords, setBonusWords] = useState<WordOut[]>([])
  const [bonusQuestions, setBonusQuestions] = useState<QuizQuestion[]>([])
  const [bonusMCQQuestions, setBonusMCQQuestions] = useState<MCQQuestion[]>([])
  const [bonusQuestionIndex, setBonusQuestionIndex] = useState(0)
  const [bonusMCQIndex, setBonusMCQIndex] = useState(0)
  const [bonusScore, setBonusScore] = useState(0)
  const [bonusCorrectWords, setBonusCorrectWords] = useState<string[]>([])
  const [bonusPendingExplain, setBonusPendingExplain] = useState<QuizQuestion | null>(null)
  const [bonusChosenAnswer, setBonusChosenAnswer] = useState('')
  const bonusQuestionsRef = useRef<QuizQuestion[]>([])
  const bonusMCQRef = useRef<MCQQuestion[]>([])
  const bonusQuestionIndexRef = useRef(0)
  const bonusMCQIndexRef = useRef(0)
  const bonusCorrectWordsRef = useRef<string[]>([])

  const getWordObj = useCallback((word: string) =>
    [...dailyWords, ...bonusWords].find(w => w.word.toLowerCase() === word.toLowerCase()) ?? { id: 0, word, part_of_speech: '', category: '', meaning: '', synonym: '', example_sentence: '' },
    [dailyWords, bonusWords])

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
    const section = new URLSearchParams(window.location.search).get('section')
    if (section === '2') {
      setPhase('mcq_round1')
      Promise.all([getDailyWords(), getMCQQuestionsToday()]).then(([daily, mcq]) => {
        setDailyWords(daily.words)
        setMcqQuestions(mcq.questions)
        mcqQuestionsRef.current = mcq.questions
        const initialQs = mcq.questions.map(q => q.question)
        mcqPreviousQuestionsRef.current = initialQs
        setMcqPreviousQuestions(initialQs)
      })
    } else if (section === 'bonus') {
      setPhase('bonus_meaning')
      Promise.all([getDailyWords(), getBonusWords()]).then(async ([daily, bonus]) => {
        setDailyWords(daily.words)
        setBonusWords(bonus.words)
        if (bonus.words.length === 0) {
          setPhase('bonus_summary')
          return
        }
        const [qs, mcqQs] = await Promise.all([
          generateQuiz({ words: bonus.words, round: 1, previous_questions: [] }),
          generateMCQRound({ words: bonus.words, previous_questions: [] }),
        ])
        setBonusQuestions(qs.questions)
        bonusQuestionsRef.current = qs.questions
        setBonusMCQQuestions(mcqQs.questions)
        bonusMCQRef.current = mcqQs.questions
      })
    } else {
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
    }
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
      // Pre-load Section 2 questions while showing Section 1 summary
      getMCQQuestionsToday().then(qs => {
        setMcqQuestions(qs.questions)
        mcqQuestionsRef.current = qs.questions
        const initialQs = qs.questions.map(q => q.question)
        mcqPreviousQuestionsRef.current = initialQs
        setMcqPreviousQuestions(initialQs)
      }).catch(err => console.error('MCQ preload failed:', err))
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

  // MCQ ref sync effects
  useEffect(() => { mcqQuestionsRef.current = mcqQuestions }, [mcqQuestions])
  useEffect(() => { mcqQuestionIndexRef.current = mcqQuestionIndex }, [mcqQuestionIndex])
  useEffect(() => { mcqWrongWordsRef.current = mcqWrongWords }, [mcqWrongWords])

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

  // MCQ helpers
  const loadMCQRound = useCallback(async (wordList: WordOut[]) => {
    const qs = await generateMCQRound({ words: wordList, previous_questions: mcqPreviousQuestionsRef.current })
    setMcqQuestions(qs.questions)
    setMcqQuestionIndex(0)
    mcqQuestionsRef.current = qs.questions
    mcqQuestionIndexRef.current = 0
    setMcqPreviousQuestions(prev => {
      const updated = [...prev, ...qs.questions.map(q => q.question)]
      mcqPreviousQuestionsRef.current = updated
      return updated
    })
  }, [])

  const mcqEndRound = useCallback(async (roundPhase: Phase, currentWrong: { r1: string[], r2: string[], r3: string[] }) => {
    const today = new Date().toISOString().split('T')[0]
    if (roundPhase === 'mcq_round1') {
      const r1Wrong = currentWrong.r1
      setMcqR2WordNames(r1Wrong)
      if (r1Wrong.length === 0) {
        // Perfect round — skip R2 and R3
        await completeMCQSession({ wrong_words: [], date: today })
        setPhase('mcq_summary')
        phaseRef.current = 'mcq_summary'
        return
      }
      const r2Words = r1Wrong.map(getWordObj)
      setMcqReviewWords(r2Words)
      setMcqReviewIndex(0)
      await loadMCQRound(r2Words)
      setPhase('mcq_review1')
      phaseRef.current = 'mcq_review1'
    } else if (roundPhase === 'mcq_round2') {
      const r2Wrong = currentWrong.r2
      if (r2Wrong.length === 0) {
        // Perfect R2 — skip R3
        const allWrong = [...new Set([...currentWrong.r1])]
        await completeMCQSession({ wrong_words: allWrong, date: today })
        setPhase('mcq_summary')
        phaseRef.current = 'mcq_summary'
        return
      }
      const r3Words = r2Wrong.map(getWordObj)
      setMcqReviewWords(r3Words)
      setMcqReviewIndex(0)
      await loadMCQRound(r3Words)
      setPhase('mcq_review2')
      phaseRef.current = 'mcq_review2'
    } else if (roundPhase === 'mcq_round3') {
      const allWrong = [...new Set([...currentWrong.r1, ...currentWrong.r2, ...currentWrong.r3])]
      await completeMCQSession({ wrong_words: allWrong, date: today })
      setPhase('mcq_summary')
      phaseRef.current = 'mcq_summary'
    }
  }, [getWordObj, loadMCQRound])

  const mcqAdvanceQuestion = useCallback((currentPhase: Phase, currentIndex: number, currentQuestions: MCQQuestion[], currentWrong: { r1: string[], r2: string[], r3: string[] }) => {
    if (currentIndex + 1 < currentQuestions.length) {
      setMcqQuestionIndex(currentIndex + 1)
      mcqQuestionIndexRef.current = currentIndex + 1
    } else {
      mcqEndRound(currentPhase, currentWrong)
    }
  }, [mcqEndRound])

  const handleMCQAnswer = async (choice: string, isCorrect: boolean) => {
    const currentPhase = phaseRef.current
    const currentIndex = mcqQuestionIndexRef.current
    const currentQuestions = mcqQuestionsRef.current
    const q = currentQuestions[currentIndex]
    if (!q) return
    const today = new Date().toISOString().split('T')[0]
    const roundNum = currentPhase === 'mcq_round1' ? 1 : currentPhase === 'mcq_round2' ? 2 : 3
    const res = await submitMCQAnswer({ word: q.word, is_correct: isCorrect, round: roundNum, date: today })
    setMcqScore(res.total_score)
    if (!isCorrect) {
      let updated = mcqWrongWordsRef.current
      if (currentPhase === 'mcq_round1') updated = { ...updated, r1: [...updated.r1, q.word] }
      else if (currentPhase === 'mcq_round2') updated = { ...updated, r2: [...updated.r2, q.word] }
      else if (currentPhase === 'mcq_round3') updated = { ...updated, r3: [...updated.r3, q.word] }
      setMcqWrongWords(updated)
      mcqWrongWordsRef.current = updated
      mcqExplainOriginPhase.current = currentPhase
      setMcqPendingExplain(q)
      setMcqChosenAnswer(choice)
      setPhase('mcq_explain')
      phaseRef.current = 'mcq_explain'
    } else {
      mcqAdvanceQuestion(currentPhase, currentIndex, currentQuestions, mcqWrongWordsRef.current)
    }
  }

  const handleMCQExplainContinue = useCallback(() => {
    const originPhase = mcqExplainOriginPhase.current
    const currentIndex = mcqQuestionIndexRef.current
    const currentQuestions = mcqQuestionsRef.current
    const currentWrong = mcqWrongWordsRef.current
    setMcqPendingExplain(null)
    setPhase(originPhase)
    phaseRef.current = originPhase
    mcqAdvanceQuestion(originPhase, currentIndex, currentQuestions, currentWrong)
  }, [mcqAdvanceQuestion])

  const handleBonusMeaningAnswer = async (choice: string, isCorrect: boolean) => {
    const currentIndex = bonusQuestionIndexRef.current
    const currentQuestions = bonusQuestionsRef.current
    const q = currentQuestions[currentIndex]
    if (!q) return
    const today = new Date().toISOString().split('T')[0]
    const res = await submitBonusAnswer({ word: q.word, is_correct: isCorrect, date: today })
    setBonusScore(res.total_score)
    if (isCorrect) {
      const updated = [...bonusCorrectWordsRef.current, q.word]
      bonusCorrectWordsRef.current = updated
      setBonusCorrectWords(updated)
    } else {
      setBonusChosenAnswer(choice)
      setBonusPendingExplain(q)
      setPhase('bonus_explain')
      phaseRef.current = 'bonus_explain'
      return
    }
    if (currentIndex + 1 < currentQuestions.length) {
      setBonusQuestionIndex(currentIndex + 1)
      bonusQuestionIndexRef.current = currentIndex + 1
    } else {
      setPhase('bonus_mcq')
      phaseRef.current = 'bonus_mcq'
      setBonusMCQIndex(0)
      bonusMCQIndexRef.current = 0
    }
  }

  const handleBonusExplainContinue = useCallback(() => {
    const currentIndex = bonusQuestionIndexRef.current
    const currentQuestions = bonusQuestionsRef.current
    setBonusPendingExplain(null)
    setPhase('bonus_meaning')
    phaseRef.current = 'bonus_meaning'
    if (currentIndex + 1 < currentQuestions.length) {
      setBonusQuestionIndex(currentIndex + 1)
      bonusQuestionIndexRef.current = currentIndex + 1
    } else {
      setPhase('bonus_mcq')
      phaseRef.current = 'bonus_mcq'
      setBonusMCQIndex(0)
      bonusMCQIndexRef.current = 0
    }
  }, [])

  const handleBonusMCQAnswer = async (choice: string, isCorrect: boolean) => {
    const currentIndex = bonusMCQIndexRef.current
    const currentQuestions = bonusMCQRef.current
    const q = currentQuestions[currentIndex]
    if (!q) return
    const today = new Date().toISOString().split('T')[0]
    const res = await submitBonusAnswer({ word: q.word, is_correct: isCorrect, date: today })
    setBonusScore(res.total_score)
    if (isCorrect) {
      const updated = [...bonusCorrectWordsRef.current, q.word]
      bonusCorrectWordsRef.current = updated
      setBonusCorrectWords(updated)
    }
    if (currentIndex + 1 < currentQuestions.length) {
      setBonusMCQIndex(currentIndex + 1)
      bonusMCQIndexRef.current = currentIndex + 1
    } else {
      const today2 = new Date().toISOString().split('T')[0]
      await completeBonusSession({ correct_words: bonusCorrectWordsRef.current, date: today2 })
      setPhase('bonus_summary')
      phaseRef.current = 'bonus_summary'
    }
  }

  const progressStep = {
    round1: 0, explain: 0, review1: 1, round2: 2, review2_explain: 3, review2_write: 3, round3: 4, summary: 5,
    mcq_round1: 0, mcq_explain: 0, mcq_review1: 1, mcq_round2: 2, mcq_review2: 3, mcq_round3: 4, mcq_summary: 5,
    bonus_meaning: 0, bonus_explain: 0, bonus_mcq: 1, bonus_summary: 2,
  }[phase] ?? 0

  if (phase === 'bonus_summary') {
    return (
      <main className="min-h-screen bg-gradient-to-b from-yellow-50 to-white p-8">
        <div className="max-w-xl mx-auto text-center mt-16">
          <p className="text-4xl mb-4">⭐</p>
          <h2 className="text-2xl font-bold text-yellow-700 mb-2">Bonus Complete!</h2>
          <p className="text-gray-600 mb-2">Great revision work, Xiaowei!</p>
          <p className="text-yellow-600 font-bold text-xl mb-8">+{bonusScore} bonus pts</p>
          <button onClick={() => router.push('/')}
            className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 px-8 rounded-xl transition-colors">
            Back to Home
          </button>
        </div>
      </main>
    )
  }

  if (phase === 'summary') {
    const allWrong = [...new Set([...wrongWords.r1, ...wrongWords.r2, ...wrongWords.r3])]
    return (
      <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-8">
        <SessionSummary score={score} wordsCorrect={dailyWords.length - allWrong.length} wordsToReview={allWrong} />
        <button
          onClick={() => {
            setPhase('mcq_round1')
            phaseRef.current = 'mcq_round1'
          }}
          className="mt-6 w-full max-w-xl mx-auto block bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 rounded-xl transition-colors text-center"
        >
          Continue to Section 2 →
        </button>
      </main>
    )
  }

  if (phase === 'mcq_summary') {
    const allMcqWrong = [...new Set([...mcqWrongWords.r1, ...mcqWrongWords.r2, ...mcqWrongWords.r3])]
    return (
      <main className="min-h-screen bg-gradient-to-b from-purple-50 to-white p-8">
        <MCQSummary
          score={mcqScore}
          wordsCorrect={10 - allMcqWrong.length}
          wordsToReview={allMcqWrong}
          onDone={() => router.push('/')}
        />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-8">
      <ScoreDisplay score={phase.startsWith('bonus_') ? bonusScore : phase.startsWith('mcq_') ? mcqScore : score} />
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
        {(phase === 'mcq_round1' || phase === 'mcq_round2' || phase === 'mcq_round3') && mcqQuestions[mcqQuestionIndex] && (
          <QuestionCard
            question={{
              ...mcqQuestions[mcqQuestionIndex],
              pronunciation: undefined,
            }}
            onAnswer={handleMCQAnswer}
          />
        )}
        {phase === 'mcq_explain' && mcqPendingExplain && (
          <ExplanationCard
            question={{ ...mcqPendingExplain, pronunciation: undefined }}
            chosenAnswer={mcqChosenAnswer}
            chosenMeaning={getWordObj(mcqChosenAnswer).meaning}
            onContinue={handleMCQExplainContinue}
          />
        )}
        {phase === 'mcq_review1' && mcqReviewWords[mcqReviewIndex] && (
          <ReviewCard
            word={mcqReviewWords[mcqReviewIndex]}
            onNext={() => {
              if (mcqReviewIndex + 1 < mcqReviewWords.length) {
                setMcqReviewIndex(i => i + 1)
              } else {
                if (mcqR2WordNames.length > 0) {
                  setPhase('mcq_round2')
                  phaseRef.current = 'mcq_round2'
                } else {
                  setPhase('mcq_round3')
                  phaseRef.current = 'mcq_round3'
                }
              }
            }}
          />
        )}
        {phase === 'mcq_review2' && mcqReviewWords[mcqReviewIndex] && (
          <ReviewCard
            word={mcqReviewWords[mcqReviewIndex]}
            onNext={() => {
              if (mcqReviewIndex + 1 < mcqReviewWords.length) {
                setMcqReviewIndex(i => i + 1)
              } else {
                const r3Words = mcqWrongWordsRef.current.r2
                if (r3Words.length > 0) {
                  setPhase('mcq_round3')
                  phaseRef.current = 'mcq_round3'
                } else {
                  completeMCQSession({ wrong_words: [...new Set([...mcqWrongWordsRef.current.r1, ...mcqWrongWordsRef.current.r2])], date: new Date().toISOString().split('T')[0] })
                  setPhase('mcq_summary')
                  phaseRef.current = 'mcq_summary'
                }
              }
            }}
          />
        )}
        {phase === 'bonus_meaning' && bonusQuestions[bonusQuestionIndex] && (
          <QuestionCard question={bonusQuestions[bonusQuestionIndex]} onAnswer={handleBonusMeaningAnswer} />
        )}
        {phase === 'bonus_explain' && bonusPendingExplain && (
          <ExplanationCard
            question={{ ...bonusPendingExplain }}
            chosenAnswer={bonusChosenAnswer}
            chosenMeaning={getWordObj(bonusChosenAnswer).meaning}
            onContinue={handleBonusExplainContinue}
          />
        )}
        {phase === 'bonus_mcq' && bonusMCQQuestions[bonusMCQIndex] && (
          <QuestionCard
            question={{ ...bonusMCQQuestions[bonusMCQIndex], pronunciation: undefined }}
            onAnswer={handleBonusMCQAnswer}
          />
        )}
      </div>
    </main>
  )
}
