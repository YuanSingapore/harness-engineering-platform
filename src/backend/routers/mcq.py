import datetime
import json
from fastapi import APIRouter
from database import get_db
from models import (
    MCQSessionState, MCQGenerateRequest, MCQGenerateResponse,
    MCQAnswerRequest, MCQAnswerResponse, MCQCompleteRequest
)
from services.mcq_service import (
    get_today_chapter_number, parse_chapter_docx,
    generate_mcq_round, write_topup_docx
)

router = APIRouter(tags=["mcq"])


@router.get("/api/mcq/session/today", response_model=MCQSessionState)
def get_mcq_session_today():
    today = str(datetime.date.today())
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM mcq_sessions WHERE date = ?", (today,))
    row = cursor.fetchone()
    if row is None:
        cursor.execute("INSERT INTO mcq_sessions (date) VALUES (?)", (today,))
        conn.commit()
        cursor.execute("SELECT * FROM mcq_sessions WHERE date = ?", (today,))
        row = cursor.fetchone()
    conn.close()
    r1 = json.loads(row["round1_words"])
    r2 = json.loads(row["round2_words"])
    r3 = json.loads(row["round3_words"])
    if not row["completed"]:
        current_round = 1 if not r1 else 2 if not r2 else 3
    else:
        current_round = 3
    return MCQSessionState(
        date=row["date"],
        current_round=current_round,
        total_score=row["total_score"],
        completed=bool(row["completed"]),
        round1_words=r1,
        round2_words=r2,
        round3_words=r3,
    )


@router.get("/api/mcq/questions/today", response_model=MCQGenerateResponse)
def get_mcq_questions_today():
    chapter = get_today_chapter_number()
    questions = parse_chapter_docx(chapter)
    return MCQGenerateResponse(questions=questions)


@router.post("/api/mcq/generate", response_model=MCQGenerateResponse)
def generate_mcq_endpoint(req: MCQGenerateRequest):
    questions = generate_mcq_round(req.words, req.previous_questions)
    return MCQGenerateResponse(questions=questions)


@router.post("/api/mcq/answer", response_model=MCQAnswerResponse)
def submit_mcq_answer(req: MCQAnswerRequest):
    today = req.date
    delta = 5 if req.is_correct else 0
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM mcq_sessions WHERE date = ?", (today,))
    if cursor.fetchone() is None:
        cursor.execute("INSERT INTO mcq_sessions (date) VALUES (?)", (today,))
        conn.commit()
    if delta > 0:
        cursor.execute(
            "UPDATE mcq_sessions SET total_score = total_score + ? WHERE date = ?",
            (delta, today)
        )
        conn.commit()
    cursor.execute("SELECT total_score FROM mcq_sessions WHERE date = ?", (today,))
    row = cursor.fetchone()
    total = row["total_score"] if row else 0
    # Track round progress in session state
    cursor.execute(f"SELECT round{req.round}_words FROM mcq_sessions WHERE date = ?", (today,))
    round_row = cursor.fetchone()
    if round_row:
        words = json.loads(round_row[0])
        if req.word not in words:
            words.append(req.word)
            cursor.execute(
                f"UPDATE mcq_sessions SET round{req.round}_words = ? WHERE date = ?",
                (json.dumps(words), today)
            )
            conn.commit()
    conn.close()
    return MCQAnswerResponse(score_delta=delta, total_score=total)


@router.post("/api/mcq/session/complete")
def complete_mcq_session(req: MCQCompleteRequest):
    today = req.date
    conn = get_db()
    cursor = conn.cursor()
    for word in req.wrong_words:
        cursor.execute("""
            INSERT INTO mcq_wrong_words_log (word, last_wrong_date, wrong_count)
            VALUES (?, ?, 1)
            ON CONFLICT(word) DO UPDATE SET
                last_wrong_date = excluded.last_wrong_date,
                wrong_count = wrong_count + 1
        """, (word, today))
    cursor.execute("UPDATE mcq_sessions SET completed = 1 WHERE date = ?", (today,))
    conn.commit()
    conn.close()
    if req.wrong_words:
        write_topup_docx(req.wrong_words, today)
    return {"ok": True}
