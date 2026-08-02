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
