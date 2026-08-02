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
