import json
import datetime
import sqlite3
from typing import List

def get_round_words(conn: sqlite3.Connection, today: str, round: int) -> List[str]:
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sessions WHERE date = ?", (today,))
    row = cursor.fetchone()
    if row is None:
        return []
    field = f"round{round}_words"
    return json.loads(row[field])

def update_session_score(conn: sqlite3.Connection, today: str, delta: int):
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE sessions SET total_score = total_score + ? WHERE date = ?",
        (delta, today)
    )
    conn.commit()

def get_session_score(conn: sqlite3.Connection, today: str) -> int:
    cursor = conn.cursor()
    cursor.execute("SELECT total_score FROM sessions WHERE date = ?", (today,))
    row = cursor.fetchone()
    return row["total_score"] if row else 0

def log_wrong_words(conn: sqlite3.Connection, wrong_words: List[str], date: str):
    cursor = conn.cursor()
    for word in wrong_words:
        cursor.execute("""
            INSERT INTO wrong_words_log (word, last_wrong_date, wrong_count)
            VALUES (?, ?, 1)
            ON CONFLICT(word) DO UPDATE SET
                last_wrong_date = excluded.last_wrong_date,
                wrong_count = wrong_count + 1
        """, (word, date))
    conn.commit()

def get_recent_wrong_words(conn: sqlite3.Connection, limit: int = 20) -> List[dict]:
    cursor = conn.cursor()
    cursor.execute(
        "SELECT word, last_wrong_date, wrong_count FROM wrong_words_log ORDER BY last_wrong_date DESC LIMIT ?",
        (limit,)
    )
    return [dict(row) for row in cursor.fetchall()]

def mark_session_complete(conn: sqlite3.Connection, today: str):
    cursor = conn.cursor()
    cursor.execute("UPDATE sessions SET completed = 1 WHERE date = ?", (today,))
    conn.commit()
