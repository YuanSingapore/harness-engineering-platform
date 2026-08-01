import datetime
import json
from fastapi import APIRouter
from database import get_db
from models import DailyWordsResponse, WordOut

router = APIRouter(prefix="/api/words", tags=["words"])

def date():
    return datetime.date.today()

@router.get("/daily", response_model=DailyWordsResponse)
def get_daily_words():
    today = date()
    day_number = (today - datetime.date(2026, 1, 1)).days  # day index from fixed epoch
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM words")
    total = cursor.fetchone()[0]
    if total == 0:
        conn.close()
        return DailyWordsResponse(words=[], date=str(today))
    offset = (day_number * 10) % total
    cursor.execute(
        "SELECT * FROM words ORDER BY id LIMIT 10 OFFSET ?", (offset,)
    )
    rows = cursor.fetchall()
    # Wrap around if fewer than 10 at end
    if len(rows) < 10:
        needed = 10 - len(rows)
        cursor.execute("SELECT * FROM words ORDER BY id LIMIT ?", (needed,))
        rows += cursor.fetchall()
    conn.close()
    return DailyWordsResponse(
        words=[WordOut(**dict(r)) for r in rows],
        date=str(today)
    )
