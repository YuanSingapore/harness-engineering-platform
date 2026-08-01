# Workflow: English Buddy

## Daily Session Structure

Each daily session must be completable within **15 minutes**.

Each day consists of 3 quiz rounds with reviews in between:

```
Quiz Round 1 → Review → Quiz Round 2 → Review → Quiz Round 3
```

### Starting a Session
1. Xiaowei opens the app
2. App greets Xiaowei and shows today's progress (which round, score so far)
3. App starts the next pending round automatically

### Quiz Round (applies to all 3 rounds)
1. App shows a word (or clue, image, sentence)
2. Xiaowei answers
3. App gives instant feedback:
   - **If correct:** +5 points added to score immediately → move to next question
   - **If incorrect:** +0 points → display explanation (meaning, pronunciation, example sentence) → move to next question
4. Score is always visible in the top-right corner, updated after every question
5. Move to next word until round is complete

### Review (after Round 1 and Round 2)
1. App shows all words Xiaowei got wrong in the previous round
2. For each word: show correct answer, meaning, and example sentence
3. Xiaowei acknowledges before moving on
4. After review, app proceeds to the next quiz round

### Ending a Session (after Round 3)
1. App shows full day summary (total score across all 3 rounds, words mastered, words to revisit)
2. Progress is saved
3. App encourages Xiaowei and sets expectation for tomorrow

## Practice Modes

[List the modes you plan to support, e.g.:]
- **Flashcard** — see word, recall meaning
- **Fill in the blank** — complete a sentence using the correct word
- **Spelling** — hear or see a definition, type the word
- **Multiple choice** — pick the correct meaning from 4 options

## Word Progression Logic

[How does the app decide which words to show?]
- e.g. New words first, then review words that were previously wrong
- e.g. Spaced repetition — words seen less recently appear more often

## Out of Scope

[Interactions or flows you are NOT building]
