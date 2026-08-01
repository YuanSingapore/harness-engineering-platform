# Architecture: English Buddy

## Overview

A web application with a Next.js frontend and FastAPI backend.

---

## Frontend

| Layer | Technology |
|---|---|
| Framework | Next.js |
| UI Library | React |
| Language | TypeScript |
| Styling | Tailwind CSS |

---

## Backend

| Layer | Technology |
|---|---|
| Framework | FastAPI (Python) |

---

## Database

| Layer | Technology |
|---|---|
| Database | SQLite |

Word bank source: `word-bank/P4_Top200_MOE_Aligned_Vocabulary.txt` — 200 MOE-aligned P4 words with meaning, synonym, part of speech, category, and example sentence. This file is the seed source for the SQLite vocabulary table.

## AI / Question Generation

| Layer | Technology |
|---|---|
| LLM API | Claude API (Anthropic) |
| Purpose | Generate MCQs, sentences, conversations, and review content per round |

## Out of Scope (This Version)

- Image storage — visual elements not included in v1
- Hosting / deployment — to be decided later
