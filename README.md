# English Buddy

A vocabulary practice app for a Singapore MOE Primary 4 student. Built entirely by Claude Code, governed by developer-written specs.

This repo is also a working example of **harness-driven development** — where developers write the rules, AI writes the code, and a verification harness keeps everything honest.

---

## How This Was Built

The process splits clearly into two phases: **developer defines, AI builds.**

---

### Phase 1 — Developer Work (no code yet)

These steps require a human who understands the product deeply. Do not skip or shortcut them — the quality of the AI output depends entirely on the quality of these documents.

**Step 1: Define the product**

Write `docs/PRODUCT.md` and `docs/WORKFLOW.md`. Answer: who is the user, what do they do in the app, what does success look like, what is out of scope.

**Step 2: Define the learning strategy**

Write `docs/LEARNING_STRATEGY.md`, `docs/VOCABULARY_STRATEGY.md`, `docs/SCORING_STRATEGY.md`. These are domain rules that AI cannot invent — they must come from you.

**Step 3: Define the architecture**

Write `docs/ARCHITECTURE.md`. Decide the tech stack (this project: Next.js + FastAPI + SQLite + Claude API). All AI-generated code will live in `src/`.

**Step 4: Break into features**

Write `feature_list.json`. Each feature gets: an id, a description precise enough for AI to implement without questions, a dependency list, and a status field. This file is the single source of truth for what gets built.

**Step 5: Write the governing doc**

Write `CLAUDE.md`. This is the contract between you and the AI — startup workflow, working rules, verification commands, definition of done. Claude Code reads this at the start of every session.

**Step 6: Write the verification harness**

Write `init.sh`. This script must: install dependencies, run backend tests, run frontend type-check and tests. AI must pass this before any feature is marked done.

---

### Phase 2 — Claude Code Builds (all output goes to `src/`)

Once Phase 1 is complete, every implementation session follows the same pattern. The developer gives a prompt; Claude Code reads the governing docs, picks the next unfinished feature, implements it in `src/`, and verifies before marking done.

**Standard session prompt:**

```
Start a new session. Follow the startup workflow in CLAUDE.md.
Read feature_list.json, pick the next unfinished feature, implement it,
run ./init.sh to verify, then update feature_list.json and progress.md.
```

**When introducing new scope mid-project** (e.g. the Section 2 MCQ Workbook was added after the core loop was complete):

```
I want to add a new feature: [describe it clearly].
Add it to feature_list.json with the correct dependencies,
then implement it following the same rules in CLAUDE.md.
All new code goes in src/.
```

**Rule: all implementation code lives in `src/`.**
Docs, config, and governance files stay at root. AI never touches those unless explicitly told to.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript, Tailwind CSS |
| Backend | FastAPI (Python) |
| Database | SQLite |
| AI | Claude API (Anthropic) |

---

## Project Structure

```
english_buddy/
├── CLAUDE.md               # governing doc — AI reads this every session
├── feature_list.json       # feature state tracker — source of truth
├── init.sh                 # verification harness
├── progress.md             # session continuity log
├── docs/                   # all developer-written specs
│   ├── PRODUCT.md
│   ├── ARCHITECTURE.md
│   ├── WORKFLOW.md
│   └── ...
├── word-bank/              # vocabulary source files
└── src/                    # all AI-generated code lives here
    ├── backend/            # FastAPI app
    └── frontend/           # Next.js app
```

---

## Running Locally

```bash
./init.sh
```

Then:
- Backend: `cd src/backend && uvicorn main:app --reload`
- Frontend: `cd src/frontend && npm run dev`

Set `ANTHROPIC_API_KEY` in `src/backend/.env` before starting.

---

## Key Principle

The developer's job is to make the spec so clear that AI has no ambiguity. The AI's job is to implement exactly that spec and prove it works. The harness (`init.sh` + `CLAUDE.md`) enforces the contract between them.
