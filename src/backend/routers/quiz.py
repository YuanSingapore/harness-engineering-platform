import datetime
import json
from fastapi import APIRouter
from database import get_db
from models import SessionState, CompleteSessionRequest, WrongWordEntry
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
