# Design: Section 2 MCQ Workbook

Date: 2026-08-02

## Overview

Add a second daily section to English Buddy. After Xiaowei completes Section 1 (rounds 1/2/3 adaptive vocab quiz), the app flows automatically into Section 2 — a 3-round MCQ workbook quiz drawn from pre-written chapter files. One continuous daily session, no separate navigation.

## User Flow

```
Section 1:  round1 → explain → review1 → round2 → review2_explain → review2_write → round3 → summary
                                                                                                  ↓ (Continue to Section 2)
Section 2:  mcq_round1 → mcq_explain → mcq_review1 → mcq_round2 → mcq_review2 → mcq_round3 → mcq_summary
                                                                                                  ↓ (Back to home)
```

- Section 1 `summary` shows a "Continue to Section 2" button
- Section 2 `mcq_summary` shows "Back to home"
- Score tracked separately per section; combined total shown at end

## Section 2 Round Structure

| Round | Word Source | Question Type | Review After |
|---|---|---|---|
| R1 | Pre-written docx (today's chapter) | Fill-in-blank sentence, pick the word | ReviewCard (word + meaning) |
| R2 | Wrong words from R1 only | Claude-generated "given meaning, pick word" MCQ | ReviewCard (word + meaning) |
| R3 | Wrong words from R2 only | Same as R2 (Claude MCQ) | None — goes to mcq_summary |

No top-up from wrong_words_log in Section 2 (unlike Section 1).

## Data Layer

### Chapter-to-Day Mapping

- Day 1 → `P4_Vocabulary_MCQ_Workbook_Chapter_01.docx`
- Day 2 → `P4_Vocabulary_MCQ_Workbook_Chapter_02.docx`
- Day N → Chapter N (wraps around if more days than chapters)
- Chapter number computed at request time: `((date - 2026-08-02).days % num_chapters) + 1`

### New DB Tables (`database.py`)

```sql
CREATE TABLE IF NOT EXISTS mcq_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    round1_words TEXT DEFAULT '[]',   -- JSON array of word strings attempted
    round2_words TEXT DEFAULT '[]',
    round3_words TEXT DEFAULT '[]',
    total_score INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS mcq_wrong_words_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL UNIQUE,
    last_wrong_date TEXT NOT NULL,
    wrong_count INTEGER DEFAULT 1
);
```

### Topup Docx

On Section 2 completion, wrong words are appended to `word-bank/P4_Vocabulary_MCQ_Workbook_topup_words.docx`. Each entry records: word, date, wrong_count. File is created if it doesn't exist.

## Backend

### New Files

**`src/backend/services/mcq_service.py`**
- `get_today_chapter_number() -> int` — computes chapter based on `(today - app_start_date).days % num_chapters + 1`
- `parse_chapter_docx(chapter_num: int) -> List[MCQQuestion]` — reads the docx, extracts word/question/choices/correct_answer/explanation per question
- `generate_mcq_round(words: List[WordOut], previous_questions: List[str]) -> List[MCQQuestion]` — calls Claude with prompt: "Given the meaning of the word, choose the correct word from 4 choices." Returns same MCQQuestion structure.
- `write_topup_docx(wrong_words: List[str], date: str)` — appends wrong words to topup docx

**`src/backend/routers/mcq.py`**
- `GET /api/mcq/session/today` → `MCQSessionState` (date, current_round, total_score, completed, round1/2/3 words)
- `GET /api/mcq/questions/today` → `List[MCQQuestion]` (parses today's chapter docx, R1 only)
- `POST /api/mcq/generate` body: `{words, previous_questions}` → `List[MCQQuestion]` (Claude R2/R3)
- `POST /api/mcq/answer` body: `{word, is_correct, round, date}` → `{score_delta, total_score}`
- `POST /api/mcq/session/complete` body: `{wrong_words, date}` → `{ok: true}` (logs to DB + writes topup docx)

### New Models (`models.py`)

```python
class MCQQuestion(BaseModel):
    word: str
    question: str
    choices: List[str]
    correct_answer: str
    explanation: str

class MCQSessionState(BaseModel):
    date: str
    current_round: int
    total_score: int
    completed: bool
    round1_words: List[str]
    round2_words: List[str]
    round3_words: List[str]

class MCQAnswerRequest(BaseModel):
    word: str
    is_correct: bool
    round: int
    date: str

class MCQCompleteRequest(BaseModel):
    wrong_words: List[str]
    date: str
```

### Claude Prompt (R2/R3)

```
You are a friendly English vocabulary tutor for a Singapore Primary 4 student.

For each word below, generate a multiple-choice question where:
- The question shows the MEANING of the word
- The student must choose the correct WORD from 4 options
- The 3 wrong options are plausible words from the same category

Return a JSON array with: word, question, choices (4 items), correct_answer, explanation.
```

## Frontend

### New Phases (`quiz/page.tsx`)

New phases added after `summary`:
```
mcq_round1 | mcq_explain | mcq_review1 | mcq_round2 | mcq_review2 | mcq_round3 | mcq_summary
```

### Component Reuse

| Phase | Component | Notes |
|---|---|---|
| mcq_round1/2/3 | `QuestionCard` | Reused as-is |
| mcq_explain | `ExplanationCard` | Reused as-is |
| mcq_review1/2 | `ReviewCard` | Reused as-is (no sentence writing) |
| mcq_summary | New `MCQSummary` component | Shows Section 2 score + wrong words |

### New API Client Functions (`lib/api.ts`)

```typescript
getMCQSessionToday()           // GET /api/mcq/session/today
getMCQQuestionsToday()         // GET /api/mcq/questions/today → MCQQuestion[]
generateMCQRound(req)          // POST /api/mcq/generate
submitMCQAnswer(req)           // POST /api/mcq/answer
completeMCQSession(req)        // POST /api/mcq/session/complete
```

## Constraints

- Section 2 only starts after Section 1 is fully complete for the day
- If Xiaowei has already completed Section 2 today, `mcq_summary` is shown directly
- `python-docx` must be added to `requirements.txt` (not currently present)
- Wrong words in Section 2 do NOT feed into Section 1's top-up pool (separate logs)
