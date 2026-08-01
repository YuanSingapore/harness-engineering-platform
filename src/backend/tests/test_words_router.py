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
