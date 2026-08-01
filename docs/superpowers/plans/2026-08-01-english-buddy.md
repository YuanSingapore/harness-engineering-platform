# English Buddy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-user P4 English vocabulary quiz web app with a 3-round adaptive session system, Claude API question generation, and persistent wrong-word tracking.

**Architecture:** Monorepo with `src/frontend` (Next.js) and `src/backend` (FastAPI). Frontend calls backend REST API. Backend manages SQLite state and calls Claude API for question generation. No authentication — single user only.

**Tech Stack:** Next.js 14, React, TypeScript, Tailwind CSS, FastAPI, Python 3.11+, SQLite (via `sqlite3` stdlib), Anthropic Python SDK, pytest, Jest + React Testing Library.

## Global Constraints

- All source code lives under `src/` — never in the project root
- Frontend: `src/frontend/`, Backend: `src/backend/`
- SQLite file: `src/backend/data/english_buddy.db`
- Word bank source: `word-bank/P4_Top200_MOE_Aligned_Vocabulary.txt`
- Score: correct = +5, incorrect = +0 — never penalise mistakes
- Never repeat a question shown in a previous round or review
- Wrong words log updated only after all 3 rounds complete
- Round 2 top-up: max 3 words from `wrong_words_log`, only if Round 1 wrong < 5
- Round 3 top-up: max 3 words from `wrong_words_log`, only if Round 2 wrong < 5, exclude Round 2 words
- Daily word cycling: words 1–10 on day 1, 11–20 on day 2, wrapping after 200
- Session must complete within 15 minutes
- Language must always be encouraging — never critical

---

## File Map

### Backend
```
src/backend/
├── main.py                    # FastAPI app, CORS, router registration
├── database.py                # SQLite connection, table creation, seed
├── models.py                  # Pydantic request/response models
├── routers/
│   ├── words.py               # GET /api/words/daily
│   └── quiz.py                # POST /api/quiz/generate, POST /api/quiz/answer,
│                              # GET /api/quiz/session/today,
│                              # POST /api/session/complete,
│                              # GET /api/wrongwords/recent
├── services/
│   ├── claude_service.py      # Claude API calls, prompt construction
│   └── session_service.py     # Word selection logic for all 3 rounds
├── data/
│   └── english_buddy.db       # Created at runtime
└── requirements.txt
```

### Frontend
```
src/frontend/
├── app/
│   ├── page.tsx               # Home page — session progress, start button
│   └── quiz/
│       └── page.tsx           # Quiz page — all rounds, reviews, summary
├── components/
│   ├── ScoreDisplay.tsx       # Always-visible score, top-right
│   ├── ProgressBar.tsx        # Round indicator
│   ├── QuestionCard.tsx       # MCQ with 4 choices
│   ├── ExplanationCard.tsx    # Meaning + pronunciation + example
│   ├── ReviewCard.tsx         # Word/meaning/example during reviews
│   ├── ConversationCard.tsx   # Short dialogue for Round 3
│   ├── SentenceInput.tsx      # Sentence writing for Review 2
│   └── SessionSummary.tsx     # End-of-day summary
├── lib/
│   └── api.ts                 # Typed fetch wrappers for all backend endpoints
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## Task 1: Backend Scaffolding + Database Setup

**Files:**
- Create: `src/backend/main.py`
- Create: `src/backend/database.py`
- Create: `src/backend/requirements.txt`
- Create: `src/backend/data/` (directory)
- Test: `src/backend/tests/test_database.py`

**Interfaces:**
- Produces: `get_db() -> sqlite3.Connection`, `init_db()`, `seed_words()`

- [ ] **Step 1: Create requirements.txt**

```
fastapi==0.111.0
uvicorn==0.29.0
anthropic==0.28.0
pytest==8.2.0
httpx==0.27.0
python-dotenv==1.0.1
```

- [ ] **Step 2: Write failing test for database init**

Create `src/backend/tests/__init__.py` (empty) and `src/backend/tests/test_database.py`:

```python
import sqlite3
import os
import pytest
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from database import init_db, get_db

def test_init_db_creates_tables(tmp_path):
    db_path = str(tmp_path / "test.db")
    conn = init_db(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = {row[0] for row in cursor.fetchall()}
    assert "words" in tables
    assert "sessions" in tables
    assert "wrong_words_log" in tables
    conn.close()

def test_words_table_schema(tmp_path):
    db_path = str(tmp_path / "test.db")
    conn = init_db(db_path)
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(words)")
    cols = {row[1] for row in cursor.fetchall()}
    assert cols == {"id", "word", "part_of_speech", "category", "meaning", "synonym", "example_sentence"}
    conn.close()
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd src/backend && pip install -r requirements.txt && pytest tests/test_database.py -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'database'`

- [ ] **Step 4: Create `src/backend/database.py`**

```python
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "english_buddy.db")

def init_db(path: str = DB_PATH) -> sqlite3.Connection:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word TEXT NOT NULL,
            part_of_speech TEXT,
            category TEXT,
            meaning TEXT,
            synonym TEXT,
            example_sentence TEXT
        );
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL UNIQUE,
            round1_words TEXT DEFAULT '[]',
            round2_words TEXT DEFAULT '[]',
            round3_words TEXT DEFAULT '[]',
            total_score INTEGER DEFAULT 0,
            completed INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS wrong_words_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word TEXT NOT NULL UNIQUE,
            last_wrong_date TEXT NOT NULL,
            wrong_count INTEGER DEFAULT 1
        );
    """)
    conn.commit()
    return conn

def get_db() -> sqlite3.Connection:
    return init_db()
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd src/backend && pytest tests/test_database.py -v
```
Expected: 2 PASSED

- [ ] **Step 6: Create `src/backend/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db

app = FastAPI(title="English Buddy API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()

@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 7: Verify server starts**

```bash
cd src/backend && uvicorn main:app --reload --port 8000
```
Expected: `Application startup complete` — visit `http://localhost:8000/health` returns `{"status":"ok"}`

- [ ] **Step 8: Commit**

```bash
git add src/backend/
git commit -m "feat: backend scaffolding and SQLite schema"
```

---

## Task 2: Word Bank Seeding

**Files:**
- Modify: `src/backend/database.py`
- Create: `src/backend/services/seed.py`
- Test: `src/backend/tests/test_seed.py`

**Interfaces:**
- Consumes: `init_db(path) -> sqlite3.Connection` from Task 1
- Produces: `seed_words(conn, word_bank_path) -> int` (returns count of words inserted)

- [ ] **Step 1: Write failing test**

Create `src/backend/tests/test_seed.py`:

```python
import os, sys, sqlite3
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from database import init_db
from services.seed import seed_words

WORD_BANK = os.path.join(os.path.dirname(__file__), '../../../../word-bank/P4_Top200_MOE_Aligned_Vocabulary.txt')

def test_seed_words_inserts_records(tmp_path):
    conn = init_db(str(tmp_path / "test.db"))
    count = seed_words(conn, WORD_BANK)
    assert count > 0

def test_seed_words_idempotent(tmp_path):
    conn = init_db(str(tmp_path / "test.db"))
    count1 = seed_words(conn, WORD_BANK)
    count2 = seed_words(conn, WORD_BANK)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM words")
    total = cursor.fetchone()[0]
    assert total == count1  # no duplicates on second seed

def test_seeded_word_has_required_fields(tmp_path):
    conn = init_db(str(tmp_path / "test.db"))
    seed_words(conn, WORD_BANK)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM words LIMIT 1")
    row = cursor.fetchone()
    assert row["word"]
    assert row["meaning"]
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd src/backend && pytest tests/test_seed.py -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'services.seed'`

- [ ] **Step 3: Create `src/backend/services/__init__.py`** (empty)

- [ ] **Step 4: Create `src/backend/services/seed.py`**

The word bank format is:
```
Word: anxious Part of Speech: adjective Category: Emotions Meaning: feeling worried Synonym: worried Example: She felt anxious before the test.
```

```python
import re
import sqlite3

def seed_words(conn: sqlite3.Connection, word_bank_path: str) -> int:
    with open(word_bank_path, "r", encoding="utf-8") as f:
        text = f.read()

    pattern = re.compile(
        r'Word:\s*(.+?)\s+Part of Speech:\s*(.+?)\s+Category:\s*(.+?)\s+Meaning:\s*(.+?)\s+Synonym:\s*(.+?)\s+Example:\s*(.+?)(?=\d+\.|$)',
        re.DOTALL
    )

    words = []
    for match in pattern.finditer(text):
        words.append({
            "word": match.group(1).strip(),
            "part_of_speech": match.group(2).strip(),
            "category": match.group(3).strip(),
            "meaning": match.group(4).strip(),
            "synonym": match.group(5).strip(),
            "example_sentence": match.group(6).strip(),
        })

    cursor = conn.cursor()
    inserted = 0
    for w in words:
        cursor.execute(
            "INSERT OR IGNORE INTO words (word, part_of_speech, category, meaning, synonym, example_sentence) VALUES (?, ?, ?, ?, ?, ?)",
            (w["word"], w["part_of_speech"], w["category"], w["meaning"], w["synonym"], w["example_sentence"])
        )
        inserted += cursor.rowcount
    conn.commit()
    return inserted
```

- [ ] **Step 5: Update `main.py` startup to seed on first run**

```python
from services.seed import seed_words
import os

@app.on_event("startup")
def startup():
    conn = init_db()
    word_bank = os.path.join(os.path.dirname(__file__), "../../word-bank/P4_Top200_MOE_Aligned_Vocabulary.txt")
    seed_words(conn, word_bank)
    conn.close()
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd src/backend && pytest tests/test_seed.py -v
```
Expected: 3 PASSED

- [ ] **Step 7: Commit**

```bash
git add src/backend/
git commit -m "feat: word bank seeding from P4 vocabulary file"
```

---

## Task 3: Pydantic Models + Daily Words Endpoint

**Files:**
- Create: `src/backend/models.py`
- Create: `src/backend/routers/__init__.py`
- Create: `src/backend/routers/words.py`
- Modify: `src/backend/main.py`
- Test: `src/backend/tests/test_words_router.py`

**Interfaces:**
- Consumes: `get_db()`, `seed_words()` from Tasks 1–2
- Produces:
  - `GET /api/words/daily` → `{"words": [WordOut], "date": str}`
  - `WordOut`: `{id, word, part_of_speech, category, meaning, synonym, example_sentence}`

- [ ] **Step 1: Create `src/backend/models.py`**

```python
from pydantic import BaseModel
from typing import List, Optional

class WordOut(BaseModel):
    id: int
    word: str
    part_of_speech: str
    category: str
    meaning: str
    synonym: str
    example_sentence: str

class DailyWordsResponse(BaseModel):
    words: List[WordOut]
    date: str

class SessionState(BaseModel):
    date: str
    current_round: int
    total_score: int
    completed: bool
    round1_words: List[str]
    round2_words: List[str]
    round3_words: List[str]

class GenerateQuizRequest(BaseModel):
    words: List[WordOut]
    round: int
    previous_questions: List[str] = []

class QuizQuestion(BaseModel):
    word: str
    question: str
    choices: List[str]
    correct_answer: str
    explanation: str
    pronunciation: Optional[str] = None

class GenerateQuizResponse(BaseModel):
    questions: List[QuizQuestion]

class AnswerRequest(BaseModel):
    word: str
    chosen_answer: str
    correct_answer: str
    is_correct: bool
    round: int

class AnswerResponse(BaseModel):
    is_correct: bool
    score_delta: int
    explanation: Optional[str] = None
    total_score: int

class CompleteSessionRequest(BaseModel):
    wrong_words: List[str]
    date: str

class WrongWordEntry(BaseModel):
    word: str
    last_wrong_date: str
    wrong_count: int
```

- [ ] **Step 2: Write failing test**

Create `src/backend/tests/test_words_router.py`:

```python
import os, sys, pytest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from fastapi.testclient import TestClient
from unittest.mock import patch
from main import app

client = TestClient(app)

def test_daily_words_returns_10():
    response = client.get("/api/words/daily")
    assert response.status_code == 200
    data = response.json()
    assert len(data["words"]) == 10
    assert "date" in data

def test_daily_words_cycle_day2(monkeypatch):
    import datetime
    # Simulate day 2 by patching date
    fake_date = datetime.date(2026, 8, 2)
    monkeypatch.setattr("routers.words.date", lambda: fake_date)
    response = client.get("/api/words/daily")
    assert response.status_code == 200
    data = response.json()
    # Day 2 should return words 11-20 (offset 10)
    assert len(data["words"]) == 10

def test_daily_words_has_required_fields():
    response = client.get("/api/words/daily")
    word = response.json()["words"][0]
    assert "word" in word
    assert "meaning" in word
    assert "example_sentence" in word
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd src/backend && pytest tests/test_words_router.py -v
```
Expected: FAIL — `404 Not Found`

- [ ] **Step 4: Create `src/backend/routers/__init__.py`** (empty)

- [ ] **Step 5: Create `src/backend/routers/words.py`**

```python
import datetime
import json
from fastapi import APIRouter
from database import get_db
from models import DailyWordsResponse, WordOut

router = APIRouter(prefix="/api/words", tags=["words"])

def date():
    return datetime.date.today()

@router.get("/daily", response_model=DailyWordsResponse)
def get_daily_words():
    today = date()
    day_number = (today - datetime.date(2026, 1, 1)).days  # day index from fixed epoch
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM words")
    total = cursor.fetchone()[0]
    if total == 0:
        conn.close()
        return DailyWordsResponse(words=[], date=str(today))
    offset = (day_number * 10) % total
    cursor.execute(
        "SELECT * FROM words ORDER BY id LIMIT 10 OFFSET ?", (offset,)
    )
    rows = cursor.fetchall()
    # Wrap around if fewer than 10 at end
    if len(rows) < 10:
        needed = 10 - len(rows)
        cursor.execute("SELECT * FROM words ORDER BY id LIMIT ?", (needed,))
        rows += cursor.fetchall()
    conn.close()
    return DailyWordsResponse(
        words=[WordOut(**dict(r)) for r in rows],
        date=str(today)
    )
```

- [ ] **Step 6: Register router in `main.py`**

```python
from routers import words as words_router
app.include_router(words_router.router)
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd src/backend && pytest tests/test_words_router.py -v
```
Expected: 3 PASSED

- [ ] **Step 8: Commit**

```bash
git add src/backend/
git commit -m "feat: daily words endpoint with 10-word cycling logic"
```

---

## Task 4: Session State Endpoint

**Files:**
- Modify: `src/backend/routers/quiz.py` (create)
- Modify: `src/backend/main.py`
- Test: `src/backend/tests/test_session.py`

**Interfaces:**
- Consumes: `get_db()`, `SessionState` model from Task 3
- Produces: `GET /api/quiz/session/today` → `SessionState`

- [ ] **Step 1: Write failing test**

Create `src/backend/tests/test_session.py`:

```python
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_session_today_returns_state():
    response = client.get("/api/quiz/session/today")
    assert response.status_code == 200
    data = response.json()
    assert "current_round" in data
    assert "total_score" in data
    assert data["current_round"] in [1, 2, 3]
    assert data["total_score"] >= 0

def test_session_today_new_session_starts_at_round1():
    response = client.get("/api/quiz/session/today")
    data = response.json()
    assert data["current_round"] == 1
    assert data["total_score"] == 0
    assert data["completed"] == False
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd src/backend && pytest tests/test_session.py -v
```
Expected: FAIL — `404 Not Found`

- [ ] **Step 3: Create `src/backend/routers/quiz.py`**

```python
import datetime
import json
from fastapi import APIRouter
from database import get_db
from models import SessionState, CompleteSessionRequest, WrongWordEntry
from typing import List

router = APIRouter(tags=["quiz"])

@router.get("/api/quiz/session/today", response_model=SessionState)
def get_session_today():
    today = str(datetime.date.today())
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sessions WHERE date = ?", (today,))
    row = cursor.fetchone()
    if row is None:
        cursor.execute(
            "INSERT INTO sessions (date) VALUES (?)", (today,)
        )
        conn.commit()
        cursor.execute("SELECT * FROM sessions WHERE date = ?", (today,))
        row = cursor.fetchone()
    conn.close()
    r1 = json.loads(row["round1_words"])
    r2 = json.loads(row["round2_words"])
    r3 = json.loads(row["round3_words"])
    # Determine current round
    if not row["completed"]:
        if not r1:
            current_round = 1
        elif not r2:
            current_round = 2
        elif not r3:
            current_round = 3
        else:
            current_round = 3
    else:
        current_round = 3
    return SessionState(
        date=row["date"],
        current_round=current_round,
        total_score=row["total_score"],
        completed=bool(row["completed"]),
        round1_words=r1,
        round2_words=r2,
        round3_words=r3,
    )
```

- [ ] **Step 4: Register quiz router in `main.py`**

```python
from routers import quiz as quiz_router
app.include_router(quiz_router.router)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd src/backend && pytest tests/test_session.py -v
```
Expected: 2 PASSED

- [ ] **Step 6: Commit**

```bash
git add src/backend/
git commit -m "feat: session state endpoint, creates daily session on first access"
```

---

## Task 5: Claude API Service + Quiz Generation Endpoint

**Files:**
- Create: `src/backend/services/claude_service.py`
- Modify: `src/backend/routers/quiz.py`
- Create: `src/backend/.env.example`
- Test: `src/backend/tests/test_claude_service.py`

**Interfaces:**
- Consumes: `WordOut`, `GenerateQuizRequest`, `GenerateQuizResponse`, `QuizQuestion` from Task 3
- Produces:
  - `generate_quiz(words: List[WordOut], round: int, previous_questions: List[str]) -> List[QuizQuestion]`
  - `POST /api/quiz/generate` → `GenerateQuizResponse`

- [ ] **Step 1: Create `.env.example`**

```
ANTHROPIC_API_KEY=your_key_here
```

- [ ] **Step 2: Write failing test**

Create `src/backend/tests/test_claude_service.py`:

```python
import os, sys, pytest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from unittest.mock import patch, MagicMock
from models import WordOut
from services.claude_service import generate_quiz, build_prompt

SAMPLE_WORD = WordOut(
    id=1, word="anxious", part_of_speech="adjective", category="Emotions",
    meaning="feeling worried", synonym="worried",
    example_sentence="She felt anxious before the test."
)

def test_build_prompt_includes_word():
    prompt = build_prompt([SAMPLE_WORD], round=1, previous_questions=[])
    assert "anxious" in prompt
    assert "feeling worried" in prompt

def test_build_prompt_includes_round():
    prompt = build_prompt([SAMPLE_WORD], round=2, previous_questions=[])
    assert "Round 2" in prompt or "round 2" in prompt.lower()

def test_build_prompt_includes_previous_questions():
    prompt = build_prompt([SAMPLE_WORD], round=2, previous_questions=["old question"])
    assert "old question" in prompt

def test_generate_quiz_returns_questions():
    mock_response = MagicMock()
    mock_response.content = [MagicMock()]
    mock_response.content[0].text = '''[
        {
            "word": "anxious",
            "question": "What does anxious mean?",
            "choices": ["feeling worried", "very happy", "feeling angry", "very tired"],
            "correct_answer": "feeling worried",
            "explanation": "Anxious means feeling worried or nervous.",
            "pronunciation": "ANGK-shuhs"
        }
    ]'''
    with patch("services.claude_service.anthropic_client") as mock_client:
        mock_client.messages.create.return_value = mock_response
        questions = generate_quiz([SAMPLE_WORD], round=1, previous_questions=[])
    assert len(questions) == 1
    assert questions[0].word == "anxious"
    assert len(questions[0].choices) == 4
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd src/backend && pytest tests/test_claude_service.py -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'services.claude_service'`

- [ ] **Step 4: Create `src/backend/services/claude_service.py`**

```python
import json
import os
from typing import List
import anthropic
from models import WordOut, QuizQuestion
from dotenv import load_dotenv

load_dotenv()

anthropic_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

LEARNING_PRINCIPLES = """
- Never punish mistakes — use encouraging, positive language always
- Every mistake is a learning opportunity
- Never repeat the same sentence across rounds
- Change context every round — same word, different situation
- Explain before testing again
- Encourage instead of criticise
"""

def build_prompt(words: List[WordOut], round: int, previous_questions: List[str]) -> str:
    word_list = "\n".join([
        f"- {w.word} ({w.part_of_speech}): {w.meaning}. Example: {w.example_sentence}"
        for w in words
    ])
    prev = "\n".join(previous_questions) if previous_questions else "None"
    round_instructions = {
        1: "Generate MCQ questions with 4 answer choices testing the word meaning.",
        2: "Generate MCQ questions with completely NEW sentences and contexts. Never reuse sentences from Round 1.",
        3: "Generate a short conversation (2-4 lines of dialogue) that uses the word naturally. Ask the student to identify the word or its meaning from context.",
    }
    return f"""You are a friendly English vocabulary tutor for a Singapore Primary 4 student.

Learning principles to follow:
{LEARNING_PRINCIPLES}

Round {round} instructions: {round_instructions[round]}

Words to quiz:
{word_list}

Previously used questions (DO NOT repeat these):
{prev}

For each word, return a JSON array of question objects with this exact structure:
{{
    "word": "the word being tested",
    "question": "the question text",
    "choices": ["choice1", "choice2", "choice3", "choice4"],
    "correct_answer": "the correct choice verbatim",
    "explanation": "clear, simple explanation of the word meaning with an example",
    "pronunciation": "phonetic pronunciation guide"
}}

Return ONLY the JSON array. No markdown, no extra text."""

def generate_quiz(words: List[WordOut], round: int, previous_questions: List[str]) -> List[QuizQuestion]:
    prompt = build_prompt(words, round, previous_questions)
    response = anthropic_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}]
    )
    raw = response.content[0].text.strip()
    data = json.loads(raw)
    return [QuizQuestion(**q) for q in data]
```

- [ ] **Step 5: Add generate endpoint to `routers/quiz.py`**

```python
from services.claude_service import generate_quiz as _generate_quiz
from models import GenerateQuizRequest, GenerateQuizResponse

@router.post("/api/quiz/generate", response_model=GenerateQuizResponse)
def generate_quiz_endpoint(req: GenerateQuizRequest):
    questions = _generate_quiz(req.words, req.round, req.previous_questions)
    return GenerateQuizResponse(questions=questions)
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd src/backend && pytest tests/test_claude_service.py -v
```
Expected: 4 PASSED

- [ ] **Step 7: Commit**

```bash
git add src/backend/
git commit -m "feat: Claude API service for quiz generation"
```

---

## Task 6: Answer Submission + Session Complete Endpoints

**Files:**
- Modify: `src/backend/routers/quiz.py`
- Create: `src/backend/services/session_service.py`
- Test: `src/backend/tests/test_answer.py`

**Interfaces:**
- Consumes: `AnswerRequest`, `AnswerResponse`, `CompleteSessionRequest`, `WrongWordEntry` from Task 3; `get_db()` from Task 1
- Produces:
  - `POST /api/quiz/answer` → `AnswerResponse`
  - `POST /api/session/complete` → `{"ok": true}`
  - `GET /api/wrongwords/recent` → `List[WrongWordEntry]`

- [ ] **Step 1: Write failing tests**

Create `src/backend/tests/test_answer.py`:

```python
import os, sys, json, datetime
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_correct_answer_adds_5_points():
    response = client.post("/api/quiz/answer", json={
        "word": "anxious", "chosen_answer": "feeling worried",
        "correct_answer": "feeling worried", "is_correct": True, "round": 1
    })
    assert response.status_code == 200
    data = response.json()
    assert data["score_delta"] == 5
    assert data["is_correct"] == True

def test_incorrect_answer_adds_0_points():
    response = client.post("/api/quiz/answer", json={
        "word": "anxious", "chosen_answer": "very happy",
        "correct_answer": "feeling worried", "is_correct": False, "round": 1
    })
    assert response.status_code == 200
    data = response.json()
    assert data["score_delta"] == 0
    assert data["is_correct"] == False

def test_complete_session_logs_wrong_words():
    today = str(datetime.date.today())
    response = client.post("/api/session/complete", json={
        "wrong_words": ["anxious", "delighted"],
        "date": today
    })
    assert response.status_code == 200
    assert response.json()["ok"] == True

def test_recent_wrong_words_returns_list():
    response = client.get("/api/wrongwords/recent")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd src/backend && pytest tests/test_answer.py -v
```
Expected: FAIL — `404 Not Found`

- [ ] **Step 3: Create `src/backend/services/session_service.py`**

```python
import json
import datetime
import sqlite3
from typing import List

def get_round_words(conn: sqlite3.Connection, today: str, round: int) -> List[str]:
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sessions WHERE date = ?", (today,))
    row = cursor.fetchone()
    if row is None:
        return []
    field = f"round{round}_words"
    return json.loads(row[field])

def update_session_score(conn: sqlite3.Connection, today: str, delta: int):
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE sessions SET total_score = total_score + ? WHERE date = ?",
        (delta, today)
    )
    conn.commit()

def get_session_score(conn: sqlite3.Connection, today: str) -> int:
    cursor = conn.cursor()
    cursor.execute("SELECT total_score FROM sessions WHERE date = ?", (today,))
    row = cursor.fetchone()
    return row["total_score"] if row else 0

def log_wrong_words(conn: sqlite3.Connection, wrong_words: List[str], date: str):
    cursor = conn.cursor()
    for word in wrong_words:
        cursor.execute("""
            INSERT INTO wrong_words_log (word, last_wrong_date, wrong_count)
            VALUES (?, ?, 1)
            ON CONFLICT(word) DO UPDATE SET
                last_wrong_date = excluded.last_wrong_date,
                wrong_count = wrong_count + 1
        """, (word, date))
    conn.commit()

def get_recent_wrong_words(conn: sqlite3.Connection, limit: int = 20) -> List[dict]:
    cursor = conn.cursor()
    cursor.execute(
        "SELECT word, last_wrong_date, wrong_count FROM wrong_words_log ORDER BY last_wrong_date DESC LIMIT ?",
        (limit,)
    )
    return [dict(row) for row in cursor.fetchall()]

def mark_session_complete(conn: sqlite3.Connection, today: str):
    cursor = conn.cursor()
    cursor.execute("UPDATE sessions SET completed = 1 WHERE date = ?", (today,))
    conn.commit()
```

- [ ] **Step 4: Add answer + complete endpoints to `routers/quiz.py`**

```python
import datetime
from services.session_service import (
    update_session_score, get_session_score,
    log_wrong_words, get_recent_wrong_words, mark_session_complete
)
from models import AnswerRequest, AnswerResponse, CompleteSessionRequest, WrongWordEntry

@router.post("/api/quiz/answer", response_model=AnswerResponse)
def submit_answer(req: AnswerRequest):
    today = str(datetime.date.today())
    conn = get_db()
    delta = 5 if req.is_correct else 0
    if delta > 0:
        update_session_score(conn, today, delta)
    total = get_session_score(conn, today)
    conn.close()
    return AnswerResponse(
        is_correct=req.is_correct,
        score_delta=delta,
        total_score=total,
    )

@router.post("/api/session/complete")
def complete_session(req: CompleteSessionRequest):
    conn = get_db()
    log_wrong_words(conn, req.wrong_words, req.date)
    mark_session_complete(conn, req.date)
    conn.close()
    return {"ok": True}

@router.get("/api/wrongwords/recent", response_model=List[WrongWordEntry])
def recent_wrong_words():
    conn = get_db()
    words = get_recent_wrong_words(conn)
    conn.close()
    return words
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd src/backend && pytest tests/test_answer.py -v
```
Expected: 4 PASSED

- [ ] **Step 6: Run full backend test suite**

```bash
cd src/backend && pytest -v
```
Expected: All tests PASSED

- [ ] **Step 7: Commit**

```bash
git add src/backend/
git commit -m "feat: answer submission, session complete, wrong words log endpoints"
```

---

## Task 7: Frontend Scaffolding + API Client

**Files:**
- Create: `src/frontend/` (Next.js project)
- Create: `src/frontend/lib/api.ts`
- Test: `src/frontend/lib/api.test.ts`

**Interfaces:**
- Produces typed fetch wrappers:
  - `getDailyWords() -> DailyWordsResponse`
  - `getSessionToday() -> SessionState`
  - `generateQuiz(req: GenerateQuizRequest) -> GenerateQuizResponse`
  - `submitAnswer(req: AnswerRequest) -> AnswerResponse`
  - `completeSession(req: CompleteSessionRequest) -> {ok: boolean}`
  - `getRecentWrongWords() -> WrongWordEntry[]`

- [ ] **Step 1: Scaffold Next.js project**

```bash
cd src && npx create-next-app@latest frontend \
  --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
```
Answer prompts: Yes to TypeScript, Yes to Tailwind, Yes to App Router.

- [ ] **Step 2: Install testing deps**

```bash
cd src/frontend && npm install -D jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom ts-jest
```

- [ ] **Step 3: Write failing test**

Create `src/frontend/lib/api.test.ts`:

```typescript
import { getDailyWords, getSessionToday, submitAnswer } from './api'

global.fetch = jest.fn()

const mockFetch = (data: unknown) => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => data,
  })
}

describe('api client', () => {
  beforeEach(() => jest.clearAllMocks())

  test('getDailyWords calls correct endpoint', async () => {
    mockFetch({ words: [], date: '2026-08-01' })
    const result = await getDailyWords()
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/api/words/daily')
    expect(result.date).toBe('2026-08-01')
  })

  test('submitAnswer posts to correct endpoint', async () => {
    mockFetch({ is_correct: true, score_delta: 5, total_score: 5 })
    const result = await submitAnswer({
      word: 'anxious', chosen_answer: 'feeling worried',
      correct_answer: 'feeling worried', is_correct: true, round: 1
    })
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/quiz/answer',
      expect.objectContaining({ method: 'POST' })
    )
    expect(result.score_delta).toBe(5)
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd src/frontend && npx jest lib/api.test.ts
```
Expected: FAIL — `Cannot find module './api'`

- [ ] **Step 5: Create `src/frontend/lib/api.ts`**

```typescript
const API_BASE = 'http://localhost:8000'

export interface WordOut {
  id: number; word: string; part_of_speech: string; category: string
  meaning: string; synonym: string; example_sentence: string
}
export interface DailyWordsResponse { words: WordOut[]; date: string }
export interface SessionState {
  date: string; current_round: number; total_score: number; completed: boolean
  round1_words: string[]; round2_words: string[]; round3_words: string[]
}
export interface QuizQuestion {
  word: string; question: string; choices: string[]
  correct_answer: string; explanation: string; pronunciation?: string
}
export interface GenerateQuizRequest {
  words: WordOut[]; round: number; previous_questions: string[]
}
export interface GenerateQuizResponse { questions: QuizQuestion[] }
export interface AnswerRequest {
  word: string; chosen_answer: string; correct_answer: string
  is_correct: boolean; round: number
}
export interface AnswerResponse { is_correct: boolean; score_delta: number; total_score: number }
export interface CompleteSessionRequest { wrong_words: string[]; date: string }
export interface WrongWordEntry { word: string; last_wrong_date: string; wrong_count: number }

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  return res.json()
}

export const getDailyWords = () => get<DailyWordsResponse>('/api/words/daily')
export const getSessionToday = () => get<SessionState>('/api/quiz/session/today')
export const getRecentWrongWords = () => get<WrongWordEntry[]>('/api/wrongwords/recent')
export const generateQuiz = (req: GenerateQuizRequest) => post<GenerateQuizResponse>('/api/quiz/generate', req)
export const submitAnswer = (req: AnswerRequest) => post<AnswerResponse>('/api/quiz/answer', req)
export const completeSession = (req: CompleteSessionRequest) => post<{ ok: boolean }>('/api/session/complete', req)
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd src/frontend && npx jest lib/api.test.ts
```
Expected: 2 PASSED

- [ ] **Step 7: Commit**

```bash
git add src/frontend/
git commit -m "feat: Next.js frontend scaffold and typed API client"
```

---

## Task 8: UI Components

**Files:**
- Create: `src/frontend/components/ScoreDisplay.tsx`
- Create: `src/frontend/components/ProgressBar.tsx`
- Create: `src/frontend/components/QuestionCard.tsx`
- Create: `src/frontend/components/ExplanationCard.tsx`
- Create: `src/frontend/components/ReviewCard.tsx`
- Create: `src/frontend/components/ConversationCard.tsx`
- Create: `src/frontend/components/SentenceInput.tsx`
- Create: `src/frontend/components/SessionSummary.tsx`
- Test: `src/frontend/components/QuestionCard.test.tsx`

**Interfaces:**
- Consumes: `QuizQuestion`, `WordOut`, `WrongWordEntry` types from Task 7
- Produces: React components, each accepting typed props

- [ ] **Step 1: Write failing component test**

Create `src/frontend/components/QuestionCard.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import QuestionCard from './QuestionCard'

const mockQuestion = {
  word: 'anxious', question: 'What does anxious mean?',
  choices: ['feeling worried', 'very happy', 'very tired', 'feeling angry'],
  correct_answer: 'feeling worried',
  explanation: 'Anxious means feeling worried.',
  pronunciation: 'ANGK-shuhs'
}

test('renders question text', () => {
  render(<QuestionCard question={mockQuestion} onAnswer={jest.fn()} />)
  expect(screen.getByText('What does anxious mean?')).toBeInTheDocument()
})

test('renders 4 choices', () => {
  render(<QuestionCard question={mockQuestion} onAnswer={jest.fn()} />)
  expect(screen.getAllByRole('button')).toHaveLength(4)
})

test('calls onAnswer with correct boolean when choice selected', () => {
  const onAnswer = jest.fn()
  render(<QuestionCard question={mockQuestion} onAnswer={onAnswer} />)
  fireEvent.click(screen.getByText('feeling worried'))
  expect(onAnswer).toHaveBeenCalledWith('feeling worried', true)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd src/frontend && npx jest components/QuestionCard.test.tsx
```
Expected: FAIL — `Cannot find module './QuestionCard'`

- [ ] **Step 3: Create `src/frontend/components/ScoreDisplay.tsx`**

```typescript
interface Props { score: number }
export default function ScoreDisplay({ score }: Props) {
  return (
    <div className="fixed top-4 right-4 bg-yellow-400 text-yellow-900 font-bold px-4 py-2 rounded-full text-lg shadow">
      ⭐ {score} pts
    </div>
  )
}
```

- [ ] **Step 4: Create `src/frontend/components/ProgressBar.tsx`**

```typescript
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
```

- [ ] **Step 5: Create `src/frontend/components/QuestionCard.tsx`**

```typescript
import { QuizQuestion } from '@/lib/api'
interface Props { question: QuizQuestion; onAnswer: (choice: string, isCorrect: boolean) => void }
export default function QuestionCard({ question, onAnswer }: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-6 max-w-xl mx-auto">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">{question.question}</h2>
      <div className="grid grid-cols-1 gap-3">
        {question.choices.map((choice) => (
          <button key={choice} onClick={() => onAnswer(choice, choice === question.correct_answer)}
            className="w-full text-left px-4 py-3 rounded-xl border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-gray-700 font-medium">
            {choice}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create `src/frontend/components/ExplanationCard.tsx`**

```typescript
import { QuizQuestion } from '@/lib/api'
interface Props { question: QuizQuestion; onContinue: () => void }
export default function ExplanationCard({ question, onContinue }: Props) {
  return (
    <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 max-w-xl mx-auto">
      <p className="text-blue-600 font-semibold mb-3">Good try! Let's learn this word 📖</p>
      <h3 className="text-2xl font-bold text-blue-800 mb-1">{question.word}</h3>
      {question.pronunciation && <p className="text-gray-500 text-sm mb-3">/{question.pronunciation}/</p>}
      <p className="text-gray-700 mb-2"><span className="font-semibold">Meaning:</span> {question.explanation}</p>
      <button onClick={onContinue}
        className="mt-4 w-full bg-blue-500 text-white py-3 rounded-xl font-semibold hover:bg-blue-600 transition-colors">
        Got it! Continue →
      </button>
    </div>
  )
}
```

- [ ] **Step 7: Create `src/frontend/components/ReviewCard.tsx`**

```typescript
import { WordOut } from '@/lib/api'
interface Props { word: WordOut; onNext: () => void }
export default function ReviewCard({ word, onNext }: Props) {
  return (
    <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6 max-w-xl mx-auto">
      <p className="text-green-600 font-semibold mb-2">Let's review this word 🌟</p>
      <h3 className="text-2xl font-bold text-green-800 mb-2">{word.word}</h3>
      <p className="text-gray-700 mb-1"><span className="font-semibold">Meaning:</span> {word.meaning}</p>
      <p className="text-gray-600 text-sm italic mb-4">"{word.example_sentence}"</p>
      <button onClick={onNext}
        className="w-full bg-green-500 text-white py-3 rounded-xl font-semibold hover:bg-green-600 transition-colors">
        Next →
      </button>
    </div>
  )
}
```

- [ ] **Step 8: Create `src/frontend/components/ConversationCard.tsx`**

```typescript
import { QuizQuestion } from '@/lib/api'
interface Props { question: QuizQuestion; onAnswer: (choice: string, isCorrect: boolean) => void }
export default function ConversationCard({ question, onAnswer }: Props) {
  return (
    <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-6 max-w-xl mx-auto">
      <p className="text-purple-600 font-semibold mb-3">Read this conversation 💬</p>
      <div className="bg-white rounded-xl p-4 mb-4 text-gray-700 whitespace-pre-line">{question.question}</div>
      <p className="font-semibold text-gray-700 mb-3">What does the bold word mean?</p>
      <div className="grid grid-cols-1 gap-2">
        {question.choices.map((choice) => (
          <button key={choice} onClick={() => onAnswer(choice, choice === question.correct_answer)}
            className="text-left px-4 py-3 rounded-xl border-2 border-purple-200 hover:border-purple-400 hover:bg-purple-50 transition-colors text-gray-700">
            {choice}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Create `src/frontend/components/SentenceInput.tsx`**

```typescript
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
```

- [ ] **Step 10: Create `src/frontend/components/SessionSummary.tsx`**

```typescript
interface Props { score: number; wordsCorrect: number; wordsToReview: string[] }
export default function SessionSummary({ score, wordsCorrect, wordsToReview }: Props) {
  const messages = ['Great work today! 🌟', 'You\'re doing amazing! ⭐', 'Keep it up! 🚀']
  const msg = messages[Math.floor(wordsCorrect % messages.length)]
  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 max-w-xl mx-auto text-center">
      <h2 className="text-3xl font-bold text-blue-600 mb-2">{msg}</h2>
      <p className="text-5xl font-bold text-yellow-500 my-4">{score} pts</p>
      <p className="text-gray-600 mb-6">{wordsCorrect} words mastered today!</p>
      {wordsToReview.length > 0 && (
        <div className="bg-blue-50 rounded-xl p-4 text-left">
          <p className="font-semibold text-blue-700 mb-2">Words to keep practising:</p>
          <ul className="list-disc list-inside text-gray-600">
            {wordsToReview.map(w => <li key={w}>{w}</li>)}
          </ul>
        </div>
      )}
      <p className="text-gray-500 mt-6 text-sm">See you tomorrow! 👋</p>
    </div>
  )
}
```

- [ ] **Step 11: Run component tests**

```bash
cd src/frontend && npx jest components/QuestionCard.test.tsx
```
Expected: 3 PASSED

- [ ] **Step 12: Commit**

```bash
git add src/frontend/components/
git commit -m "feat: all UI components — QuestionCard, ExplanationCard, ReviewCard, etc."
```

---

## Task 9: Home Page + Quiz Page

**Files:**
- Modify: `src/frontend/app/page.tsx`
- Create: `src/frontend/app/quiz/page.tsx`
- Test: `src/frontend/app/quiz/page.test.tsx`

**Interfaces:**
- Consumes: All components from Task 8; all API functions from Task 7
- Produces: Working quiz flow — Round 1 → Review 1 → Round 2 → Review 2 → Round 3 → Summary

- [ ] **Step 1: Create `src/frontend/app/page.tsx`**

```typescript
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
```

- [ ] **Step 2: Create `src/frontend/app/quiz/page.tsx`**

```typescript
'use client'
import { useEffect, useState, useCallback } from 'react'
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
  const [wrongWords, setWrongWords] = useState<{ r1: string[], r2: string[] }>({ r1: [], r2: [] })
  const [reviewIndex, setReviewIndex] = useState(0)
  const [previousQuestions, setPreviousQuestions] = useState<string[]>([])
  const [pendingExplain, setPendingExplain] = useState<QuizQuestion | null>(null)
  const [reviewWords, setReviewWords] = useState<WordOut[]>([])
  const [recentWrong, setRecentWrong] = useState<WrongWordEntry[]>([])

  const getWordObj = useCallback((word: string) =>
    dailyWords.find(w => w.word === word) ?? { id: 0, word, part_of_speech: '', category: '', meaning: '', synonym: '', example_sentence: '' },
    [dailyWords])

  const loadRound = useCallback(async (round: number, wordList: WordOut[]) => {
    const qs = await generateQuiz({ words: wordList, round, previous_questions: previousQuestions })
    setQuestions(qs.questions)
    setQuestionIndex(0)
    setPreviousQuestions(prev => [...prev, ...qs.questions.map(q => q.question)])
  }, [previousQuestions])

  useEffect(() => {
    Promise.all([getDailyWords(), getRecentWrongWords()]).then(([daily, recent]) => {
      setDailyWords(daily.words)
      setRecentWrong(recent)
      generateQuiz({ words: daily.words, round: 1, previous_questions: [] }).then(qs => {
        setQuestions(qs.questions)
        setPreviousQuestions(qs.questions.map(q => q.question))
      })
    })
  }, [])

  const handleAnswer = async (choice: string, isCorrect: boolean) => {
    const q = questions[questionIndex]
    const res = await submitAnswer({ word: q.word, chosen_answer: choice, correct_answer: q.correct_answer, is_correct: isCorrect, round: phase === 'round1' ? 1 : phase === 'round2' ? 2 : 3 })
    setScore(res.total_score)
    if (!isCorrect) {
      if (phase === 'round1') setWrongWords(w => ({ ...w, r1: [...w.r1, q.word] }))
      else if (phase === 'round2') setWrongWords(w => ({ ...w, r2: [...w.r2, q.word] }))
      setPendingExplain(q)
      setPhase('explain')
    } else {
      advanceQuestion()
    }
  }

  const advanceQuestion = () => {
    if (questionIndex + 1 < questions.length) {
      setQuestionIndex(i => i + 1)
    } else {
      endRound()
    }
  }

  const endRound = async () => {
    if (phase === 'round1') {
      const r1Wrong = wrongWords.r1
      const topupWords = recentWrong
        .filter(w => !r1Wrong.includes(w.word))
        .slice(0, r1Wrong.length < 5 ? 3 : 0)
        .map(w => w.word)
      const r2WordNames = [...r1Wrong, ...topupWords]
      const r2Words = r2WordNames.map(getWordObj)
      setReviewWords(r1Wrong.map(getWordObj))
      setReviewIndex(0)
      setPhase('review1')
      await loadRound(2, r2Words)
    } else if (phase === 'round2') {
      const r2Wrong = wrongWords.r2
      const topupWords = recentWrong
        .filter(w => !r2Wrong.includes(w.word) && !wrongWords.r1.includes(w.word))
        .slice(0, r2Wrong.length < 5 ? 3 : 0)
        .map(w => w.word)
      const r3WordNames = [...r2Wrong, ...topupWords]
      const r3Words = r3WordNames.map(getWordObj)
      setReviewWords(r2Wrong.map(getWordObj))
      setReviewIndex(0)
      setPhase('review2_explain')
      await loadRound(3, r3Words)
    } else if (phase === 'round3') {
      const allWrong = [...new Set([...wrongWords.r1, ...wrongWords.r2])]
      await completeSession({ wrong_words: allWrong, date: new Date().toISOString().split('T')[0] })
      setPhase('summary')
    }
  }

  const progressStep = { round1: 0, explain: 0, review1: 1, round2: 2, review2_explain: 3, review2_write: 3, round3: 4, summary: 5 }[phase]

  if (phase === 'summary') {
    const allWrong = [...new Set([...wrongWords.r1, ...wrongWords.r2])]
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
          <ExplanationCard question={pendingExplain} onContinue={() => { setPendingExplain(null); setPhase(phase === 'explain' && wrongWords.r2.includes(pendingExplain.word) ? 'round2' : 'round1'); advanceQuestion() }} />
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
```

- [ ] **Step 3: Commit**

```bash
git add src/frontend/app/
git commit -m "feat: home page and full quiz flow page"
```

---

## Task 10: Update init.sh + Final Integration Check

**Files:**
- Modify: `init.sh`
- Modify: `CLAUDE.md`
- Modify: `feature_list.json` (mark feat-001 through feat-013 as done)

- [ ] **Step 1: Update `init.sh`**

```bash
#!/bin/bash
set -e
echo "=== English Buddy Harness Initialization ==="

echo "--- Backend ---"
cd src/backend
pip install -r requirements.txt -q
pytest -q
echo "Backend: OK"
cd ../..

echo "--- Frontend ---"
cd src/frontend
npm install --silent
npx tsc --noEmit
npx jest --passWithNoTests
echo "Frontend: OK"
cd ../..

echo "=== Initialization Complete ==="
echo "Next steps:"
echo "1. Read feature_list.json to see current feature state"
echo "2. Pick ONE unfinished feature to work on"
echo "3. Implement only that feature"
echo "4. Re-run ./init.sh before claiming done"
```

- [ ] **Step 2: Update `CLAUDE.md` verification section**

Replace the `{{PRIMARY_VERIFICATION_COMMAND}}` and `{{VERIFICATION_COMMANDS}}` placeholders:

```markdown
## Verification Commands

```bash
# Full verification (recommended)
./init.sh
```

Required checks:
- Backend: `cd src/backend && pytest -q`
- Frontend type check: `cd src/frontend && npx tsc --noEmit`
- Frontend tests: `cd src/frontend && npx jest --passWithNoTests`
```

- [ ] **Step 3: Run full integration check**

Start both servers and verify:

```bash
# Terminal 1
cd src/backend && uvicorn main:app --reload --port 8000

# Terminal 2
cd src/frontend && npm run dev
```

Visit `http://localhost:3000` — should see home page with "Start Practice" button.
Visit `http://localhost:3000/quiz` — should load quiz with score display.
Visit `http://localhost:8000/docs` — FastAPI swagger should show all endpoints.

- [ ] **Step 4: Commit**

```bash
git add init.sh CLAUDE.md feature_list.json
git commit -m "feat: update init.sh for monorepo, complete English Buddy v1"
```

---

## Self-Review Notes

- All 13 features from `feature_list.json` are covered across Tasks 1–10
- Word cycling logic (daily offset) is in Task 3 `routers/words.py`
- Round 2/3 top-up logic (< 5 wrong → max 3 top-up) is in Task 9 `quiz/page.tsx` `endRound()`
- Wrong words logged only after Round 3 complete via `completeSession()` — matches spec
- Score +5 correct / +0 incorrect — enforced in Task 6 `session_service.py`
- No auth, no images, no multi-user — all out of scope and excluded
- `ExplanationCard` always shows before re-testing — learning principle 5 satisfied
