import datetime
import json
from fastapi import APIRouter
from database import get_db
from models import SessionState, AnswerRequest, AnswerResponse, CompleteSessionRequest, WrongWordEntry, GenerateQuizRequest, GenerateQuizResponse
from services.claude_service import generate_quiz as _generate_quiz
from services.session_service import (
    update_session_score, get_session_score,
    log_wrong_words, get_recent_wrong_words, mark_session_complete
)
from typing import List

router = APIRouter(tags=["quiz"])

@router.get("/api/quiz/session/today", response_model=SessionState)
def get_session_today():
    today = str(datetime.date.today())
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sessions WHERE date = ?", (today,))
    row = cursor.fetchone()
    if row is None:
        cursor.execute(
            "INSERT INTO sessions (date) VALUES (?)", (today,)
        )
        conn.commit()
        cursor.execute("SELECT * FROM sessions WHERE date = ?", (today,))
        row = cursor.fetchone()
    conn.close()
    r1 = json.loads(row["round1_words"])
    r2 = json.loads(row["round2_words"])
    r3 = json.loads(row["round3_words"])
    # Determine current round
    if not row["completed"]:
        if not r1:
            current_round = 1
        elif not r2:
            current_round = 2
        elif not r3:
            current_round = 3
        else:
            current_round = 3
    else:
        current_round = 3
    return SessionState(
        date=row["date"],
        current_round=current_round,
        total_score=row["total_score"],
        completed=bool(row["completed"]),
        round1_words=r1,
        round2_words=r2,
        round3_words=r3,
    )


@router.post("/api/quiz/generate", response_model=GenerateQuizResponse)
def generate_quiz_endpoint(req: GenerateQuizRequest):
    questions = _generate_quiz(req.words, req.round, req.previous_questions)
    return GenerateQuizResponse(questions=questions)


@router.post("/api/quiz/answer", response_model=AnswerResponse)
def submit_answer(req: AnswerRequest):
    today = str(datetime.date.today())
    conn = get_db()
    delta = 5 if req.is_correct else 0
    if delta > 0:
        update_session_score(conn, today, delta)
    total = get_session_score(conn, today)
    conn.close()
    return AnswerResponse(
        is_correct=req.is_correct,
        score_delta=delta,
        total_score=total,
    )


@router.post("/api/session/complete")
def complete_session(req: CompleteSessionRequest):
    conn = get_db()
    log_wrong_words(conn, req.wrong_words, req.date)
    mark_session_complete(conn, req.date)
    conn.close()
    return {"ok": True}


@router.get("/api/wrongwords/recent", response_model=List[WrongWordEntry])
def recent_wrong_words():
    conn = get_db()
    words = get_recent_wrong_words(conn)
    conn.close()
    return words
