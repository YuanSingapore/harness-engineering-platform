import datetime
from fastapi import APIRouter
from database import get_db
from models import (
    BonusWordsResponse, BonusSessionState,
    BonusAnswerRequest, BonusAnswerResponse, BonusCompleteRequest
)
from services.bonus_service import get_bonus_words, reduce_wrong_count

router = APIRouter(tags=["bonus"])


@router.get("/api/bonus/session/today", response_model=BonusSessionState)
def get_bonus_session_today():
    today = str(datetime.date.today())
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM bonus_sessions WHERE date = ?", (today,))
    row = cursor.fetchone()
    if row is None:
        cursor.execute("INSERT INTO bonus_sessions (date) VALUES (?)", (today,))
        conn.commit()
        cursor.execute("SELECT * FROM bonus_sessions WHERE date = ?", (today,))
        row = cursor.fetchone()
    conn.close()
    return BonusSessionState(
        date=row["date"],
        total_score=row["total_score"],
        completed=bool(row["completed"]),
    )


@router.get("/api/bonus/words", response_model=BonusWordsResponse)
def get_bonus_words_today():
    conn = get_db()
    words = get_bonus_words(conn)
    conn.close()
    return BonusWordsResponse(words=words)


@router.post("/api/bonus/answer", response_model=BonusAnswerResponse)
def submit_bonus_answer(req: BonusAnswerRequest):
    today = req.date
    delta = 5 if req.is_correct else 0
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM bonus_sessions WHERE date = ?", (today,))
    if cursor.fetchone() is None:
        cursor.execute("INSERT INTO bonus_sessions (date) VALUES (?)", (today,))
        conn.commit()
    if delta > 0:
        cursor.execute(
            "UPDATE bonus_sessions SET total_score = total_score + ? WHERE date = ?",
            (delta, today)
        )
        # Also add to mcq_sessions so home page total score includes bonus
        cursor.execute(
            "UPDATE mcq_sessions SET total_score = total_score + ? WHERE date = ?",
            (delta, today)
        )
        conn.commit()
        reduce_wrong_count(conn, req.word)
    cursor.execute("SELECT total_score FROM bonus_sessions WHERE date = ?", (today,))
    row = cursor.fetchone()
    total = row["total_score"] if row else 0
    conn.close()
    return BonusAnswerResponse(score_delta=delta, total_score=total)


@router.post("/api/bonus/session/complete")
def complete_bonus_session(req: BonusCompleteRequest):
    today = req.date
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE bonus_sessions SET completed = 1 WHERE date = ?", (today,))
    conn.commit()
    conn.close()
    return {"ok": True}
