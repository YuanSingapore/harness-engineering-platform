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
