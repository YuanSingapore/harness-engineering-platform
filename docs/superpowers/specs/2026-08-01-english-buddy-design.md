# English Buddy — Design Spec
**Date:** 2026-08-01

## Overview

A single-user web app for Xiaowei (Singapore MOE P4 Term 3) to practice English vocabulary through a 3-round adaptive quiz system. Sessions complete within 15 minutes. Built with Next.js + FastAPI + SQLite + Claude API.

---

## Project Structure

```
english_buddy/
├── src/
│   ├── frontend/                  # Next.js app
│   │   ├── app/
│   │   │   ├── page.tsx           # Home / session start
│   │   │   └── quiz/
│   │   │       └── page.tsx       # Quiz interface
│   │   ├── components/
│   │   └── lib/                   # API client
│   │
│   └── backend/                   # FastAPI app
│       ├── main.py
│       ├── database.py
│       ├── models.py
│       ├── routers/
│       │   ├── quiz.py
│       │   └── words.py
│       ├── services/
│       │   ├── claude_service.py
│       │   └── session_service.py
│       └── data/
│           └── english_buddy.db
│
├── word-bank/
├── docs/
├── CLAUDE.md
├── feature_list.json
└── init.sh
```

---

## Database Schema (SQLite)

### `words`
Seeded from `word-bank/P4_Top200_MOE_Aligned_Vocabulary.txt`.
```
id              INTEGER PRIMARY KEY
word            TEXT
part_of_speech  TEXT
category        TEXT
meaning         TEXT
synonym         TEXT
example_sentence TEXT
```

### `sessions`
One row per daily session.
```
id              INTEGER PRIMARY KEY
date            TEXT (YYYY-MM-DD)
round1_words    TEXT (JSON array of words)
round2_words    TEXT (JSON array of words)
round3_words    TEXT (JSON array of words)
total_score     INTEGER
completed       INTEGER (0 or 1)
```

### `wrong_words_log`
Cumulative across all sessions. Updated after all 3 rounds complete.
```
id              INTEGER PRIMARY KEY
word            TEXT UNIQUE
last_wrong_date TEXT (YYYY-MM-DD)
wrong_count     INTEGER
```

---

## API Endpoints (FastAPI)

### Words
```
GET  /api/words/daily              # Get 10 words for today's Round 1
```

### Quiz
```
POST /api/quiz/generate            # Generate MCQs via Claude API
                                   # Body: { words, round, previous_questions }

POST /api/quiz/answer              # Submit an answer
                                   # Body: { word, answer, is_correct, round }

GET  /api/quiz/session/today       # Get today's session state (round, score)
```

### Session
```
POST /api/session/complete         # After Round 3 — logs wrong words, saves score
GET  /api/wrongwords/recent        # Get most recently wrong words for top-up
```

---

## Round & Word Selection Logic

### Round 1
- 10 MCQs from today's word set — words are selected daily by cycling through the `words` table in order (words 1–10 on day 1, 11–20 on day 2, etc.), wrapping around after all 200 words are covered
- Wrong answers: explained immediately (meaning, pronunciation, example)

### Round 2
- Start with all wrong words from Round 1
- If fewer than 5 wrong words from Round 1, top up from `wrong_words_log` (most recent first) — max 3 top-up words
- New sentences, no repeated questions

### Round 3
- Start with all wrong words from Round 2
- If fewer than 5 wrong words from Round 2, top up from `wrong_words_log` (most recent first, excluding Round 2 words) — max 3 top-up words
- New context, short conversation format

### Wrong Words Log
- Updated **after all 3 rounds complete**
- Stores: word, last wrong date, cumulative wrong count

---

## Scoring

- Correct answer: +5 points
- Incorrect answer: +0 points (no penalty)
- Score always visible in top-right corner, updated immediately after each answer
- Total score saved to `sessions` table

---

## Frontend Pages

### `/` — Home
- Shows today's progress (current round, score so far)
- Button to start or resume the next round

### `/quiz` — Quiz Interface
- Handles all 3 rounds and reviews in a single page
- Transitions between states: Round → Review → Round → Review → Round → Summary

### Components
| Component | Purpose |
|---|---|
| `ScoreDisplay` | Always-visible score, top-right corner |
| `QuestionCard` | MCQ with 4 choices (Rounds 1 & 2) |
| `ExplanationCard` | Meaning + pronunciation + example after wrong answer |
| `ReviewCard` | Word/meaning/example during Review 1 & 2 |
| `ConversationCard` | Short dialogue for Round 3 |
| `SentenceInput` | Text input for Review 2 sentence writing |
| `SessionSummary` | End of day: score, words mastered, encouragement |
| `ProgressBar` | Current round indicator |

---

## Claude API Usage

- Called via `claude_service.py` in the backend
- One call per round to generate all questions upfront
- Prompt includes: word list, round number, previous questions (to avoid repeats), learning principles from `LEARNING_STRATEGY.md`
- Returns structured JSON: questions, choices, correct answer, explanation

---

## Out of Scope (v1)

- Images / picture matching (visual elements deferred)
- Multi-user / login
- Mobile / desktop app
- Hosting / deployment
