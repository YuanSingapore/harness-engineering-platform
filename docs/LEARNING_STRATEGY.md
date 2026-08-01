# Learning Strategy: English Buddy

## Core Objective

The goal is **not** to get Xiaowei to answer questions correctly.

The goal is for Xiaowei to **truly understand** each word — its meaning, how it feels in a sentence, and how to use it naturally across different situations and contexts. Success means he can encounter the word somewhere new and know exactly what it means and how to use it.

---

## Learning Principles

These principles govern every interaction in the app. All round and review logic must follow them.

1. **Never punish mistakes** — mistakes are a normal part of learning, never frame them negatively
2. **Every mistake is a learning opportunity** — wrong answers always trigger explanation, not just "incorrect"
3. **Never repeat the same sentence** — each round and review must use fresh sentences
4. **Change context every round** — same word, different situation each time it appears
5. **Explain before testing again** — always show meaning and example before re-quizzing a word
6. **Use visual memory whenever possible** — pair words with images to strengthen retention
7. **Encourage instead of criticise** — use positive, motivating language at all times

---

## Overview

Each daily session uses a 3-round adaptive quiz system. Words that Xiaowei gets wrong are carried forward and re-tested with increasing depth of engagement.

---

## Quiz Round 1

- Generate **10 MCQs** from today's word set
- Each question: one word, 4 answer choices (meanings)

### If answer is correct
- Positive feedback, move to next question

### If answer is incorrect
- Immediately explain the word:
  - **Meaning** — clear, simple definition
  - **Pronunciation** — how to say it
  - **Example sentence** — used naturally in context
- Record word as wrong: log date and increment wrong count in `wrong-words-log`

---

## Review 1

- Collect all words Xiaowei got wrong in Round 1
- For each incorrect word, display:
  - Word
  - Meaning
  - Example sentence
- Activity: **Picture matching** — Xiaowei clicks the correct picture that matches the word

---

## Quiz Round 2

- Word selection:
  1. Take all wrong words from Round 1
  2. If wrong words from Round 1 is **less than 5**, top up with most recently wrong words from `wrong-words-log` (most recent date first) — **maximum 3 top-up words**
- Generate completely **different sentences** from Round 1
- **Never repeat** a previous question
- Keep difficulty **similar** to Round 1

---

## Review 2

For each word still incorrect after Round 2:
1. **Explain again** — meaning, pronunciation, example sentence
2. **Picture matching** — click the correct picture
3. **Simple sentence writing** — Xiaowei writes one sentence using the word

---

## Quiz Round 3

- Word selection:
  1. Take all wrong words from Round 2
  2. If wrong words from Round 2 is **less than 5**, top up with most recently wrong words from `wrong-words-log` (most recent date first, excluding words already used in Round 2) — **maximum 3 top-up words**
- Generate **new context** for each word
- Activities:
  - **Short conversation** — word used in a short dialogue
  - **Picture recognition** — identify the correct image for the word

---

## Wrong Words Log

After all 3 rounds are complete, update the persistent `wrong-words-log` in SQLite. Each entry stores:
- Word
- Date last answered incorrectly (YYYY-MM-DD)
- Total wrong count (cumulative across all sessions)

This log is used at the start of Round 2 and Round 3 to top up words when there are not enough wrong words from the current round.

---

## Global Rules

- Never repeat a question that was already shown in any previous round or review
- Always generate new sentences and contexts for each round
- Difficulty stays consistent across rounds — do not increase or decrease
- Words are only dropped from the session when Xiaowei answers correctly
- All wrong answers must be logged to `wrong-words-log` with date and updated count
