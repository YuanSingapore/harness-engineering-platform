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
        model="rsn.claude-sonnet-4-6",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}]
    )
    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    data = json.loads(raw)
    return [QuizQuestion(**q) for q in data]
