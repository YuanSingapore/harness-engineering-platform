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
