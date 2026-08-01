import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_session_today_returns_state():
    response = client.get("/api/quiz/session/today")
    assert response.status_code == 200
    data = response.json()
    assert "current_round" in data
    assert "total_score" in data
    assert data["current_round"] in [1, 2, 3]
    assert data["total_score"] >= 0

def test_session_today_new_session_starts_at_round1():
    response = client.get("/api/quiz/session/today")
    data = response.json()
    assert data["current_round"] == 1
    assert data["total_score"] == 0
    assert data["completed"] == False
