# Section 2 MCQ Workbook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Section 2 MCQ workbook quiz (3 rounds, pre-written docx questions + Claude R2/R3) that flows automatically after Section 1 completes each day.

**Architecture:** Separate MCQ subsystem with new DB tables (`mcq_sessions`, `mcq_wrong_words_log`), new backend router/service, and new frontend phases appended to the existing quiz page flow. Section 1 and Section 2 share no state; both live in the same daily page.

**Tech Stack:** FastAPI + SQLite (backend), python-docx (docx parsing), Anthropic SDK (Claude R2/R3 generation), Next.js + TypeScript + Tailwind (frontend).

## Global Constraints

- All Python code lives under `src/backend/`; all frontend code under `src/frontend/`
- Word-bank files live under `word-bank/` at repo root (two levels up from `src/backend/`)
- Backend runs on port 8001; frontend on port 3000 with Next.js rewrites to `/api/*`
- Model for Claude calls: `rsn.claude-sonnet-4-6`
- Never repeat question text across rounds (pass `previous_questions` to Claude)
- `python-docx` must be added to `requirements.txt`
- App start date for chapter mapping: `2026-08-02`
- Chapter files: `P4_Vocabulary_MCQ_Workbook_Chapter_01.docx` through `_Chapter_05.docx` (5 chapters total)
- Topup docx path: `word-bank/P4_Vocabulary_MCQ_Workbook_topup_words.docx`

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `src/backend/requirements.txt` | Add `python-docx` |
| Modify | `src/backend/database.py` | Add `mcq_sessions`, `mcq_wrong_words_log` tables |
| Modify | `src/backend/models.py` | Add `MCQQuestion`, `MCQSessionState`, `MCQAnswerRequest`, `MCQCompleteRequest`, `MCQGenerateRequest`, `MCQGenerateResponse` |
| Create | `src/backend/services/mcq_service.py` | Docx parser, chapter mapping, Claude R2/R3 generator, topup docx writer |
| Create | `src/backend/routers/mcq.py` | All `/api/mcq/*` endpoints |
| Modify | `src/backend/main.py` | Register MCQ router |
| Create | `src/backend/tests/test_mcq_service.py` | Unit tests for parser and chapter mapping |
| Create | `src/backend/tests/test_mcq_router.py` | Integration tests for all MCQ endpoints |
| Modify | `src/frontend/lib/api.ts` | Add MCQ types and API client functions |
| Create | `src/frontend/components/MCQSummary.tsx` | Section 2 summary card |
| Modify | `src/frontend/app/quiz/page.tsx` | Add MCQ phases, state, handlers |

---

## Task 1: Add python-docx and DB tables

**Files:**
- Modify: `src/backend/requirements.txt`
- Modify: `src/backend/database.py`

**Interfaces:**
- Produces: `init_db()` now creates `mcq_sessions` and `mcq_wrong_words_log` tables

- [ ] **Step 1: Add python-docx to requirements**

In `src/backend/requirements.txt`, add at the end:
```
python-docx==1.1.2
```

- [ ] **Step 2: Add new tables to database.py**

In `src/backend/database.py`, inside the `cursor.executescript("""...""")` call, append these two tables before the closing `""")`:

```sql
        CREATE TABLE IF NOT EXISTS mcq_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL UNIQUE,
            round1_words TEXT DEFAULT '[]',
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

- [ ] **Step 3: Write DB test**

Create `src/backend/tests/test_mcq_db.py`:

```python
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import pytest
from database import init_db

def test_mcq_sessions_table_exists():
    conn = init_db()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='mcq_sessions'")
    assert cursor.fetchone() is not None
    conn.close()

def test_mcq_wrong_words_log_table_exists():
    conn = init_db()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='mcq_wrong_words_log'")
    assert cursor.fetchone() is not None
    conn.close()
```

- [ ] **Step 4: Install python-docx and run test**

```bash
cd src/backend
pip install --break-system-packages python-docx==1.1.2 -q
pytest tests/test_mcq_db.py -v
```

Expected: 2 PASS

- [ ] **Step 5: Commit**

```bash
git add src/backend/requirements.txt src/backend/database.py src/backend/tests/test_mcq_db.py
git commit -m "feat: add python-docx, mcq_sessions and mcq_wrong_words_log tables"
```

---

## Task 2: Add MCQ models

**Files:**
- Modify: `src/backend/models.py`

**Interfaces:**
- Produces:
  - `MCQQuestion(word, question, choices, correct_answer, explanation)`
  - `MCQSessionState(date, current_round, total_score, completed, round1_words, round2_words, round3_words)`
  - `MCQAnswerRequest(word, is_correct, round, date)`
  - `MCQAnswerResponse(score_delta, total_score)`
  - `MCQCompleteRequest(wrong_words, date)`
  - `MCQGenerateRequest(words, previous_questions)`
  - `MCQGenerateResponse(questions)`

- [ ] **Step 1: Add models to models.py**

Append to `src/backend/models.py`:

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

class MCQAnswerResponse(BaseModel):
    score_delta: int
    total_score: int

class MCQCompleteRequest(BaseModel):
    wrong_words: List[str]
    date: str

class MCQGenerateRequest(BaseModel):
    words: List[WordOut]
    previous_questions: List[str] = []

class MCQGenerateResponse(BaseModel):
    questions: List[MCQQuestion]
```

- [ ] **Step 2: Verify import compiles**

```bash
cd src/backend
python3 -c "from models import MCQQuestion, MCQSessionState, MCQAnswerRequest, MCQAnswerResponse, MCQCompleteRequest, MCQGenerateRequest, MCQGenerateResponse; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/backend/models.py
git commit -m "feat: add MCQ pydantic models"
```

---

## Task 3: MCQ service — docx parser and chapter mapping

**Files:**
- Create: `src/backend/services/mcq_service.py`
- Create: `src/backend/tests/test_mcq_service.py`

**Interfaces:**
- Consumes: `MCQQuestion` from `models.py`
- Produces:
  - `get_today_chapter_number() -> int` — returns 1–5
  - `parse_chapter_docx(chapter_num: int) -> List[MCQQuestion]` — returns 10 questions from the chapter file
  - `get_word_bank_dir() -> str` — absolute path to `word-bank/` directory

**Docx paragraph pattern** (one question block, 11 paragraphs):
```
"1. Anxious"                          ← word number + name, split on ". "
"Part of Speech: Adjective"           ← ignored
"Category: Emotions"                  ← ignored
"Meaning: Feeling worried or nervous" ← ignored (word meaning from DB used in frontend)
"Synonym: worried"                    ← ignored
"Choose the most suitable word..."    ← ignored (static instruction line)
"Sarah felt ________ before..."       ← question text
"A. relaxed"                          ← choice[0]
"B. anxious"                          ← choice[1]
"C. careless"                         ← choice[2]
"D. cheerful"                         ← choice[3]
"Answer: B"                           ← correct_answer letter → map to full choice text
"Explanation: 'Anxious' means..."     ← explanation text after "Explanation: "
"Composition Example: ..."            ← ignored
```

- [ ] **Step 1: Write failing tests**

Create `src/backend/tests/test_mcq_service.py`:

```python
import os, sys, datetime
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import pytest
from unittest.mock import patch
from services.mcq_service import get_today_chapter_number, parse_chapter_docx, get_word_bank_dir

def test_get_word_bank_dir_exists():
    d = get_word_bank_dir()
    assert os.path.isdir(d)

def test_chapter_number_day1():
    with patch('services.mcq_service.datetime') as mock_dt:
        mock_dt.date.today.return_value = datetime.date(2026, 8, 2)
        mock_dt.date.fromisoformat.return_value = datetime.date(2026, 8, 2)
        assert get_today_chapter_number() == 1

def test_chapter_number_day2():
    with patch('services.mcq_service.datetime') as mock_dt:
        mock_dt.date.today.return_value = datetime.date(2026, 8, 3)
        mock_dt.date.fromisoformat.return_value = datetime.date(2026, 8, 2)
        assert get_today_chapter_number() == 2

def test_chapter_number_wraps():
    with patch('services.mcq_service.datetime') as mock_dt:
        mock_dt.date.today.return_value = datetime.date(2026, 8, 7)  # day 6, index 5 % 5 = 0 → chapter 1
        mock_dt.date.fromisoformat.return_value = datetime.date(2026, 8, 2)
        assert get_today_chapter_number() == 1

def test_parse_chapter01_returns_10_questions():
    questions = parse_chapter_docx(1)
    assert len(questions) == 10

def test_parse_chapter01_first_question():
    questions = parse_chapter_docx(1)
    q = questions[0]
    assert q.word.lower() == "anxious"
    assert "________" in q.question
    assert len(q.choices) == 4
    assert q.correct_answer in q.choices
    assert len(q.explanation) > 0
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd src/backend
pytest tests/test_mcq_service.py -v
```

Expected: ImportError or similar — `mcq_service` doesn't exist yet.

- [ ] **Step 3: Implement mcq_service.py**

Create `src/backend/services/mcq_service.py`:

```python
import os
import datetime
import json
from typing import List
import docx
import anthropic
from models import MCQQuestion, WordOut
from dotenv import load_dotenv

load_dotenv()

APP_START_DATE = "2026-08-02"
NUM_CHAPTERS = 5

anthropic_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def get_word_bank_dir() -> str:
    return os.path.join(os.path.dirname(__file__), "../../../word-bank")


def get_today_chapter_number() -> int:
    today = datetime.date.today()
    start = datetime.date.fromisoformat(APP_START_DATE)
    day_index = (today - start).days
    return (day_index % NUM_CHAPTERS) + 1


def parse_chapter_docx(chapter_num: int) -> List[MCQQuestion]:
    path = os.path.join(
        get_word_bank_dir(),
        f"P4_Vocabulary_MCQ_Workbook_Chapter_{chapter_num:02d}.docx"
    )
    doc = docx.Document(path)
    texts = [p.text.strip() for p in doc.paragraphs if p.text.strip()]

    questions = []
    i = 0
    while i < len(texts):
        # Detect start of a question block: "N. Word"
        parts = texts[i].split(". ", 1)
        if len(parts) == 2 and parts[0].isdigit():
            word = parts[1].strip()
            # Skip: Part of Speech, Category, Meaning, Synonym, "Choose the most..."
            i += 6
            if i + 6 >= len(texts):
                break
            question_text = texts[i]; i += 1
            choice_a = texts[i].lstrip("A. "); i += 1
            choice_b = texts[i].lstrip("B. "); i += 1
            choice_c = texts[i].lstrip("C. "); i += 1
            choice_d = texts[i].lstrip("D. "); i += 1
            answer_line = texts[i]; i += 1  # "Answer: B"
            explanation_line = texts[i]; i += 1  # "Explanation: ..."
            # Skip "Composition Example: ..."
            if i < len(texts) and texts[i].startswith("Composition Example"):
                i += 1

            letter = answer_line.replace("Answer:", "").strip()
            choice_map = {"A": choice_a, "B": choice_b, "C": choice_c, "D": choice_d}
            correct = choice_map.get(letter, choice_a)
            explanation = explanation_line.replace("Explanation:", "").strip()

            questions.append(MCQQuestion(
                word=word,
                question=question_text,
                choices=[choice_a, choice_b, choice_c, choice_d],
                correct_answer=correct,
                explanation=explanation,
            ))
        else:
            i += 1

    return questions


def generate_mcq_round(words: List[WordOut], previous_questions: List[str]) -> List[MCQQuestion]:
    word_list = "\n".join([
        f"- {w.word} ({w.part_of_speech}): {w.meaning}"
        for w in words
    ])
    prev = "\n".join(previous_questions) if previous_questions else "None"

    prompt = f"""You are a friendly English vocabulary tutor for a Singapore Primary 4 student.

For each word below, generate a multiple-choice question where:
- The question gives the MEANING of the word (do not use the word itself in the question)
- The student must choose the correct WORD from 4 options
- The 3 wrong options are plausible words from the same category as the correct word
- Use encouraging, positive language

Words to quiz:
{word_list}

Previously used questions (DO NOT repeat these):
{prev}

Return ONLY a JSON array. Each object must have exactly these fields:
{{
    "word": "the correct word",
    "question": "the question text showing the meaning",
    "choices": ["word1", "word2", "word3", "word4"],
    "correct_answer": "the correct word verbatim from choices",
    "explanation": "brief encouraging explanation"
}}"""

    response = anthropic_client.messages.create(
        model="rsn.claude-sonnet-4-6",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}]
    )
    raw = response.content[0].text.strip()
    data = json.loads(raw)
    return [MCQQuestion(**q) for q in data]


def write_topup_docx(wrong_words: List[str], date: str):
    path = os.path.join(get_word_bank_dir(), "P4_Vocabulary_MCQ_Workbook_topup_words.docx")
    if os.path.exists(path):
        doc = docx.Document(path)
    else:
        doc = docx.Document()
        doc.add_heading("MCQ Workbook Wrong Words Log", 0)

    doc.add_paragraph(f"--- {date} ---")
    for word in wrong_words:
        doc.add_paragraph(f"• {word}")
    doc.save(path)
```

- [ ] **Step 4: Run tests**

```bash
cd src/backend
pytest tests/test_mcq_service.py -v
```

Expected: 6 PASS

- [ ] **Step 5: Commit**

```bash
git add src/backend/services/mcq_service.py src/backend/tests/test_mcq_service.py
git commit -m "feat: MCQ service — docx parser, chapter mapping, Claude generator, topup writer"
```

---

## Task 4: MCQ router and main.py registration

**Files:**
- Create: `src/backend/routers/mcq.py`
- Modify: `src/backend/main.py`
- Create: `src/backend/tests/test_mcq_router.py`

**Interfaces:**
- Consumes: `MCQQuestion`, `MCQSessionState`, `MCQAnswerRequest`, `MCQAnswerResponse`, `MCQCompleteRequest`, `MCQGenerateRequest`, `MCQGenerateResponse` from `models.py`; all functions from `services/mcq_service.py`
- Produces:
  - `GET /api/mcq/session/today` → `MCQSessionState`
  - `GET /api/mcq/questions/today` → `MCQGenerateResponse`
  - `POST /api/mcq/generate` body: `MCQGenerateRequest` → `MCQGenerateResponse`
  - `POST /api/mcq/answer` body: `MCQAnswerRequest` → `MCQAnswerResponse`
  - `POST /api/mcq/session/complete` body: `MCQCompleteRequest` → `{"ok": True}`

- [ ] **Step 1: Write failing router tests**

Create `src/backend/tests/test_mcq_router.py`:

```python
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_mcq_session_today_returns_state():
    r = client.get("/api/mcq/session/today")
    assert r.status_code == 200
    data = r.json()
    assert "current_round" in data
    assert data["current_round"] == 1
    assert data["total_score"] == 0
    assert data["completed"] == False

def test_mcq_questions_today_returns_10():
    r = client.get("/api/mcq/questions/today")
    assert r.status_code == 200
    data = r.json()
    assert "questions" in data
    assert len(data["questions"]) == 10
    q = data["questions"][0]
    assert "word" in q
    assert "question" in q
    assert len(q["choices"]) == 4
    assert q["correct_answer"] in q["choices"]

def test_mcq_answer_correct_adds_5_points():
    import datetime
    today = str(datetime.date.today())
    r = client.post("/api/mcq/answer", json={
        "word": "anxious", "is_correct": True, "round": 1, "date": today
    })
    assert r.status_code == 200
    data = r.json()
    assert data["score_delta"] == 5
    assert data["total_score"] >= 5

def test_mcq_answer_wrong_adds_0_points():
    import datetime
    today = str(datetime.date.today())
    r = client.post("/api/mcq/answer", json={
        "word": "delighted", "is_correct": False, "round": 1, "date": today
    })
    assert r.status_code == 200
    data = r.json()
    assert data["score_delta"] == 0

def test_mcq_session_complete():
    import datetime
    today = str(datetime.date.today())
    r = client.post("/api/mcq/session/complete", json={
        "wrong_words": ["anxious", "delighted"], "date": today
    })
    assert r.status_code == 200
    assert r.json()["ok"] == True
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd src/backend
pytest tests/test_mcq_router.py -v
```

Expected: FAIL — router not registered yet.

- [ ] **Step 3: Create routers/mcq.py**

Create `src/backend/routers/mcq.py`:

```python
import datetime
import json
from fastapi import APIRouter
from database import get_db
from models import (
    MCQSessionState, MCQGenerateRequest, MCQGenerateResponse,
    MCQAnswerRequest, MCQAnswerResponse, MCQCompleteRequest
)
from services.mcq_service import (
    get_today_chapter_number, parse_chapter_docx,
    generate_mcq_round, write_topup_docx
)

router = APIRouter(tags=["mcq"])


@router.get("/api/mcq/session/today", response_model=MCQSessionState)
def get_mcq_session_today():
    today = str(datetime.date.today())
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM mcq_sessions WHERE date = ?", (today,))
    row = cursor.fetchone()
    if row is None:
        cursor.execute("INSERT INTO mcq_sessions (date) VALUES (?)", (today,))
        conn.commit()
        cursor.execute("SELECT * FROM mcq_sessions WHERE date = ?", (today,))
        row = cursor.fetchone()
    conn.close()
    r1 = json.loads(row["round1_words"])
    r2 = json.loads(row["round2_words"])
    r3 = json.loads(row["round3_words"])
    if not row["completed"]:
        current_round = 1 if not r1 else 2 if not r2 else 3
    else:
        current_round = 3
    return MCQSessionState(
        date=row["date"],
        current_round=current_round,
        total_score=row["total_score"],
        completed=bool(row["completed"]),
        round1_words=r1,
        round2_words=r2,
        round3_words=r3,
    )


@router.get("/api/mcq/questions/today", response_model=MCQGenerateResponse)
def get_mcq_questions_today():
    chapter = get_today_chapter_number()
    questions = parse_chapter_docx(chapter)
    return MCQGenerateResponse(questions=questions)


@router.post("/api/mcq/generate", response_model=MCQGenerateResponse)
def generate_mcq_endpoint(req: MCQGenerateRequest):
    questions = generate_mcq_round(req.words, req.previous_questions)
    return MCQGenerateResponse(questions=questions)


@router.post("/api/mcq/answer", response_model=MCQAnswerResponse)
def submit_mcq_answer(req: MCQAnswerRequest):
    today = req.date
    delta = 5 if req.is_correct else 0
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM mcq_sessions WHERE date = ?", (today,))
    if cursor.fetchone() is None:
        cursor.execute("INSERT INTO mcq_sessions (date) VALUES (?)", (today,))
        conn.commit()
    if delta > 0:
        cursor.execute(
            "UPDATE mcq_sessions SET total_score = total_score + ? WHERE date = ?",
            (delta, today)
        )
        conn.commit()
    cursor.execute("SELECT total_score FROM mcq_sessions WHERE date = ?", (today,))
    row = cursor.fetchone()
    total = row["total_score"] if row else 0
    conn.close()
    return MCQAnswerResponse(score_delta=delta, total_score=total)


@router.post("/api/mcq/session/complete")
def complete_mcq_session(req: MCQCompleteRequest):
    today = req.date
    conn = get_db()
    cursor = conn.cursor()
    for word in req.wrong_words:
        cursor.execute("""
            INSERT INTO mcq_wrong_words_log (word, last_wrong_date, wrong_count)
            VALUES (?, ?, 1)
            ON CONFLICT(word) DO UPDATE SET
                last_wrong_date = excluded.last_wrong_date,
                wrong_count = wrong_count + 1
        """, (word, today))
    cursor.execute("UPDATE mcq_sessions SET completed = 1 WHERE date = ?", (today,))
    conn.commit()
    conn.close()
    if req.wrong_words:
        write_topup_docx(req.wrong_words, today)
    return {"ok": True}
```

- [ ] **Step 4: Register router in main.py**

In `src/backend/main.py`, add after the existing router imports:

```python
from routers import mcq as mcq_router
```

And after `app.include_router(quiz_router.router)`:

```python
app.include_router(mcq_router.router)
```

- [ ] **Step 5: Run all backend tests**

```bash
cd src/backend
pytest -q
```

Expected: all PASS (including the 5 new router tests)

- [ ] **Step 6: Commit**

```bash
git add src/backend/routers/mcq.py src/backend/main.py src/backend/tests/test_mcq_router.py
git commit -m "feat: MCQ router — session, questions, generate, answer, complete endpoints"
```

---

## Task 5: Frontend API client types and functions

**Files:**
- Modify: `src/frontend/lib/api.ts`

**Interfaces:**
- Produces (TypeScript types and functions available to quiz/page.tsx):
  - `interface MCQQuestion { word, question, choices, correct_answer, explanation }`
  - `interface MCQSessionState { date, current_round, total_score, completed, round1_words, round2_words, round3_words }`
  - `interface MCQAnswerRequest { word, is_correct, round, date }`
  - `interface MCQAnswerResponse { score_delta, total_score }`
  - `interface MCQCompleteRequest { wrong_words, date }`
  - `interface MCQGenerateRequest { words: WordOut[], previous_questions: string[] }`
  - `interface MCQGenerateResponse { questions: MCQQuestion[] }`
  - `getMCQSessionToday()` → `MCQSessionState`
  - `getMCQQuestionsToday()` → `MCQGenerateResponse`
  - `generateMCQRound(req: MCQGenerateRequest)` → `MCQGenerateResponse`
  - `submitMCQAnswer(req: MCQAnswerRequest)` → `MCQAnswerResponse`
  - `completeMCQSession(req: MCQCompleteRequest)` → `{ ok: boolean }`

- [ ] **Step 1: Add MCQ types and API functions to api.ts**

Append to `src/frontend/lib/api.ts`:

```typescript
export interface MCQQuestion {
  word: string; question: string; choices: string[]
  correct_answer: string; explanation: string
}
export interface MCQSessionState {
  date: string; current_round: number; total_score: number; completed: boolean
  round1_words: string[]; round2_words: string[]; round3_words: string[]
}
export interface MCQAnswerRequest {
  word: string; is_correct: boolean; round: number; date: string
}
export interface MCQAnswerResponse { score_delta: number; total_score: number }
export interface MCQCompleteRequest { wrong_words: string[]; date: string }
export interface MCQGenerateRequest { words: WordOut[]; previous_questions: string[] }
export interface MCQGenerateResponse { questions: MCQQuestion[] }

export const getMCQSessionToday = () => get<MCQSessionState>('/api/mcq/session/today')
export const getMCQQuestionsToday = () => get<MCQGenerateResponse>('/api/mcq/questions/today')
export const generateMCQRound = (req: MCQGenerateRequest) => post<MCQGenerateResponse>('/api/mcq/generate', req)
export const submitMCQAnswer = (req: MCQAnswerRequest) => post<MCQAnswerResponse>('/api/mcq/answer', req)
export const completeMCQSession = (req: MCQCompleteRequest) => post<{ ok: boolean }>('/api/mcq/session/complete', req)
```

- [ ] **Step 2: Type-check**

```bash
cd src/frontend
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/frontend/lib/api.ts
git commit -m "feat: MCQ API client types and functions"
```

---

## Task 6: MCQSummary component

**Files:**
- Create: `src/frontend/components/MCQSummary.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks (standalone component)
- Produces: `<MCQSummary score={number} wordsCorrect={number} wordsToReview={string[]} onDone={() => void} />`

- [ ] **Step 1: Create MCQSummary.tsx**

Create `src/frontend/components/MCQSummary.tsx`:

```tsx
interface Props {
  score: number
  wordsCorrect: number
  wordsToReview: string[]
  onDone: () => void
}

export default function MCQSummary({ score, wordsCorrect, wordsToReview, onDone }: Props) {
  const messages = ['Well done on Section 2! 🌟', 'You completed both sections! ⭐', 'Amazing effort today! 🚀']
  const msg = messages[wordsCorrect % messages.length]
  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 max-w-xl mx-auto text-center">
      <p className="text-sm font-semibold text-purple-500 uppercase tracking-wide mb-2">Section 2 Complete</p>
      <h2 className="text-3xl font-bold text-purple-600 mb-2">{msg}</h2>
      <p className="text-5xl font-bold text-yellow-500 my-4">{score} pts</p>
      <p className="text-gray-600 mb-6">{wordsCorrect} workbook words mastered!</p>
      {wordsToReview.length > 0 && (
        <div className="bg-purple-50 rounded-xl p-4 text-left mb-6">
          <p className="font-semibold text-purple-700 mb-2">Words to keep practising:</p>
          <ul className="list-disc list-inside text-gray-600">
            {wordsToReview.map(w => <li key={w}>{w}</li>)}
          </ul>
        </div>
      )}
      <button
        onClick={onDone}
        className="w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 rounded-xl transition-colors"
      >
        Back to Home
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd src/frontend
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/frontend/components/MCQSummary.tsx
git commit -m "feat: MCQSummary component for Section 2 end screen"
```

---

## Task 7: Wire Section 2 phases into quiz/page.tsx

**Files:**
- Modify: `src/frontend/app/quiz/page.tsx`

**Interfaces:**
- Consumes: all MCQ API functions from `lib/api.ts`; `QuestionCard`, `ExplanationCard`, `ReviewCard`, `MCQSummary` components
- Produces: seamless flow from Section 1 `summary` → Section 2 → `mcq_summary` → home

**New phases to add** (extend the existing `Phase` union type):
```
'mcq_round1' | 'mcq_explain' | 'mcq_review1' | 'mcq_round2' | 'mcq_review2' | 'mcq_round3' | 'mcq_summary'
```

- [ ] **Step 1: Add imports and extend Phase type**

At the top of `src/frontend/app/quiz/page.tsx`, add to the import from `@/lib/api`:
```typescript
getMCQQuestionsToday, generateMCQRound, submitMCQAnswer, completeMCQSession,
MCQQuestion, MCQAnswerRequest
```

Add to the component imports:
```typescript
import MCQSummary from '@/components/MCQSummary'
```

Change the `Phase` type to:
```typescript
type Phase = 'round1' | 'explain' | 'review1' | 'round2' | 'review2_explain' | 'review2_write' | 'round3' | 'summary'
  | 'mcq_round1' | 'mcq_explain' | 'mcq_review1' | 'mcq_round2' | 'mcq_review2' | 'mcq_round3' | 'mcq_summary'
```

- [ ] **Step 2: Add MCQ state variables**

Inside the `QuizPage` component function, after the existing state declarations, add:

```typescript
const [mcqQuestions, setMcqQuestions] = useState<MCQQuestion[]>([])
const [mcqQuestionIndex, setMcqQuestionIndex] = useState(0)
const [mcqWrongWords, setMcqWrongWords] = useState<{ r1: string[], r2: string[], r3: string[] }>({ r1: [], r2: [], r3: [] })
const [mcqR2WordNames, setMcqR2WordNames] = useState<string[]>([])
const [mcqReviewWords, setMcqReviewWords] = useState<WordOut[]>([])
const [mcqReviewIndex, setMcqReviewIndex] = useState(0)
const [mcqScore, setMcqScore] = useState(0)
const [mcqPendingExplain, setMcqPendingExplain] = useState<MCQQuestion | null>(null)
const [mcqPreviousQuestions, setMcqPreviousQuestions] = useState<string[]>([])
const mcqPhaseRef = useRef<Phase>('mcq_round1')
const mcqQuestionsRef = useRef<MCQQuestion[]>([])
const mcqQuestionIndexRef = useRef(0)
const mcqWrongWordsRef = useRef<{ r1: string[], r2: string[], r3: string[] }>({ r1: [], r2: [], r3: [] })
const mcqExplainOriginPhase = useRef<Phase>('mcq_round1')
const mcqPreviousQuestionsRef = useRef<string[]>([])
```

- [ ] **Step 3: Add MCQ ref sync effects**

After the existing ref sync `useEffect` blocks, add:

```typescript
useEffect(() => { mcqPhaseRef.current = phase }, [phase])
useEffect(() => { mcqQuestionsRef.current = mcqQuestions }, [mcqQuestions])
useEffect(() => { mcqQuestionIndexRef.current = mcqQuestionIndex }, [mcqQuestionIndex])
useEffect(() => { mcqWrongWordsRef.current = mcqWrongWords }, [mcqWrongWords])
```

- [ ] **Step 4: Add loadMCQRound helper**

After the existing `loadRound` callback, add:

```typescript
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
```

- [ ] **Step 5: Add mcqEndRound handler**

After the existing `endRound` callback, add:

```typescript
const mcqEndRound = useCallback(async (roundPhase: Phase, currentWrong: { r1: string[], r2: string[], r3: string[] }) => {
  const today = new Date().toISOString().split('T')[0]
  if (roundPhase === 'mcq_round1') {
    const r1Wrong = currentWrong.r1
    setMcqR2WordNames(r1Wrong)
    if (r1Wrong.length === 0) {
      // Perfect round — skip R2 and R3
      await completeMCQSession({ wrong_words: [], date: today })
      setPhase('mcq_summary')
      return
    }
    const r2Words = r1Wrong.map(getWordObj)
    setMcqReviewWords(r2Words)
    setMcqReviewIndex(0)
    await loadMCQRound(r2Words)
    setPhase('mcq_review1')
  } else if (roundPhase === 'mcq_round2') {
    const r2Wrong = currentWrong.r2
    if (r2Wrong.length === 0) {
      // Perfect R2 — skip R3
      const allWrong = [...new Set([...currentWrong.r1])]
      await completeMCQSession({ wrong_words: allWrong, date: today })
      setPhase('mcq_summary')
      return
    }
    const r3Words = r2Wrong.map(getWordObj)
    setMcqReviewWords(r3Words)
    setMcqReviewIndex(0)
    await loadMCQRound(r3Words)
    setPhase('mcq_review2')
  } else if (roundPhase === 'mcq_round3') {
    const allWrong = [...new Set([...currentWrong.r1, ...currentWrong.r2, ...currentWrong.r3])]
    await completeMCQSession({ wrong_words: allWrong, date: today })
    setPhase('mcq_summary')
  }
}, [getWordObj, loadMCQRound])
```

- [ ] **Step 6: Add mcqAdvanceQuestion handler**

After `advanceQuestion`, add:

```typescript
const mcqAdvanceQuestion = useCallback((currentPhase: Phase, currentIndex: number, currentQuestions: MCQQuestion[], currentWrong: { r1: string[], r2: string[], r3: string[] }) => {
  if (currentIndex + 1 < currentQuestions.length) {
    setMcqQuestionIndex(currentIndex + 1)
    mcqQuestionIndexRef.current = currentIndex + 1
  } else {
    mcqEndRound(currentPhase, currentWrong)
  }
}, [mcqEndRound])
```

- [ ] **Step 7: Add handleMCQAnswer handler**

After `handleAnswer`, add:

```typescript
const handleMCQAnswer = async (choice: string, isCorrect: boolean) => {
  const currentPhase = mcqPhaseRef.current
  const currentIndex = mcqQuestionIndexRef.current
  const currentQuestions = mcqQuestionsRef.current
  const q = currentQuestions[currentIndex]
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
    setPhase('mcq_explain')
    mcqPhaseRef.current = 'mcq_explain'
  } else {
    mcqAdvanceQuestion(currentPhase, currentIndex, currentQuestions, mcqWrongWordsRef.current)
  }
}
```

- [ ] **Step 8: Add handleMCQExplainContinue handler**

After `handleExplainContinue`, add:

```typescript
const handleMCQExplainContinue = useCallback(() => {
  const originPhase = mcqExplainOriginPhase.current
  const currentIndex = mcqQuestionIndexRef.current
  const currentQuestions = mcqQuestionsRef.current
  const currentWrong = mcqWrongWordsRef.current
  setMcqPendingExplain(null)
  setPhase(originPhase)
  mcqPhaseRef.current = originPhase
  mcqAdvanceQuestion(originPhase, currentIndex, currentQuestions, currentWrong)
}, [mcqAdvanceQuestion])
```

- [ ] **Step 9: Load Section 2 when Section 1 summary is reached**

In the `endRound` callback, find the `round3` branch. It currently ends with:
```typescript
    await completeSession({ wrong_words: allWrong, date: new Date().toISOString().split('T')[0] })
    setPhase('summary')
```

Replace it with:
```typescript
    await completeSession({ wrong_words: allWrong, date: new Date().toISOString().split('T')[0] })
    // Pre-load Section 2 questions while showing Section 1 summary
    getMCQQuestionsToday().then(qs => {
      setMcqQuestions(qs.questions)
      mcqQuestionsRef.current = qs.questions
      const initialQs = qs.questions.map(q => q.question)
      mcqPreviousQuestionsRef.current = initialQs
      setMcqPreviousQuestions(initialQs)
    })
    setPhase('summary')
```

- [ ] **Step 10: Update progressStep map**

Find the `progressStep` line and replace it with:

```typescript
const progressStep = {
  round1: 0, explain: 0, review1: 1, round2: 2, review2_explain: 3, review2_write: 3, round3: 4, summary: 5,
  mcq_round1: 0, mcq_explain: 0, mcq_review1: 1, mcq_round2: 2, mcq_review2: 3, mcq_round3: 4, mcq_summary: 5,
}[phase] ?? 0
```

- [ ] **Step 11: Update summary render to show "Continue to Section 2"**

Find the `phase === 'summary'` return block. Replace:
```tsx
<button onClick={() => router.push('/')} className="mt-6 w-full max-w-xl mx-auto block text-center text-blue-500 underline">Back to home</button>
```
With:
```tsx
<button
  onClick={() => {
    setPhase('mcq_round1')
    mcqPhaseRef.current = 'mcq_round1'
  }}
  className="mt-6 w-full max-w-xl mx-auto block bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 rounded-xl transition-colors text-center"
>
  Continue to Section 2 →
</button>
```

- [ ] **Step 12: Add MCQ phase renders**

In the main return JSX, after the `{phase === 'round3' && ...}` block and before the closing `</div></main>`, add:

```tsx
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
          mcqPhaseRef.current = 'mcq_round2'
        } else {
          setPhase('mcq_round3')
          mcqPhaseRef.current = 'mcq_round3'
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
          mcqPhaseRef.current = 'mcq_round3'
        } else {
          completeMCQSession({ wrong_words: [], date: new Date().toISOString().split('T')[0] })
          setPhase('mcq_summary')
        }
      }
    }}
  />
)}
```

- [ ] **Step 13: Add mcq_summary render**

After the `if (phase === 'summary')` block (before the main return), add:

```tsx
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
```

- [ ] **Step 14: Type-check**

```bash
cd src/frontend
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 15: Run frontend tests**

```bash
cd src/frontend
npm test -- --passWithNoTests
```

Expected: PASS

- [ ] **Step 16: Commit**

```bash
git add src/frontend/app/quiz/page.tsx src/frontend/components/MCQSummary.tsx
git commit -m "feat: wire Section 2 MCQ phases into quiz page"
```

---

## Task 8: Full verification

- [ ] **Step 1: Run full backend test suite**

```bash
cd src/backend
pytest -q
```

Expected: all PASS

- [ ] **Step 2: Run full frontend checks**

```bash
cd src/frontend
npx tsc --noEmit && npm test -- --passWithNoTests
```

Expected: no type errors, all tests PASS

- [ ] **Step 3: Smoke-test the endpoints**

```bash
curl -s http://localhost:8001/api/mcq/session/today | python3 -m json.tool
curl -s http://localhost:8001/api/mcq/questions/today | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'{len(d[\"questions\"])} questions, first word: {d[\"questions\"][0][\"word\"]}')"
```

Expected: session state with `current_round: 1`; 10 questions returned.

- [ ] **Step 4: Update feature_list.json**

Add a new feature entry to `feature_list.json`:

```json
{
  "id": "feat-014",
  "name": "Section 2 MCQ Workbook",
  "description": "3-round MCQ workbook quiz from chapter docx files. R1 pre-written questions, R2/R3 Claude-generated meaning-to-word MCQs. Flows after Section 1 summary. Wrong words logged to topup docx.",
  "dependencies": ["feat-004", "feat-010"],
  "status": "done",
  "evidence": "mcq_service.py parses docx, routers/mcq.py serves endpoints, quiz/page.tsx phases mcq_round1–mcq_summary"
}
```

- [ ] **Step 5: Update progress.md**

Append to `progress.md`:

```
## 2026-08-02 — Section 2 MCQ Workbook

Implemented full Section 2 MCQ workbook feature:
- python-docx added to requirements; mcq_sessions + mcq_wrong_words_log DB tables added
- mcq_service.py: docx parser, chapter mapping (Ch01=Day1..Ch05=Day5, wraps), Claude R2/R3 generator, topup docx writer
- routers/mcq.py: 5 endpoints (/session/today, /questions/today, /generate, /answer, /session/complete)
- MCQSummary component (purple theme)
- quiz/page.tsx: 7 new phases (mcq_round1/2/3, mcq_explain, mcq_review1/2, mcq_summary)
- Section 1 summary now shows "Continue to Section 2 →" instead of Back to Home

Status: done
```

- [ ] **Step 6: Final commit**

```bash
git add feature_list.json progress.md
git commit -m "chore: update feature_list and progress for Section 2 MCQ Workbook"
```
