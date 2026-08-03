import datetime
import sqlite3
from typing import List
from models import WordOut


def get_bonus_words(conn: sqlite3.Connection) -> List[WordOut]:
    """Return deduplicated words wrong in past 3 days OR wrong_count >= 2 from either log."""
    today = datetime.date.today()
    cutoff = str(today - datetime.timedelta(days=3))
    cursor = conn.cursor()

    words = set()

    # Section 1 wrong words log
    cursor.execute("""
        SELECT word FROM wrong_words_log
        WHERE last_wrong_date >= ? OR wrong_count >= 2
    """, (cutoff,))
    for row in cursor.fetchall():
        words.add(row["word"].lower())

    # Section 2 MCQ wrong words log
    cursor.execute("""
        SELECT word FROM mcq_wrong_words_log
        WHERE last_wrong_date >= ? OR wrong_count >= 2
    """, (cutoff,))
    for row in cursor.fetchall():
        words.add(row["word"].lower())

    if not words:
        return []

    # Look up full WordOut from words table
    result = []
    for w in sorted(words):
        cursor.execute("SELECT * FROM words WHERE LOWER(word) = ?", (w,))
        row = cursor.fetchone()
        if row:
            result.append(WordOut(
                id=row["id"],
                word=row["word"],
                part_of_speech=row["part_of_speech"],
                category=row["category"],
                meaning=row["meaning"],
                synonym=row["synonym"],
                example_sentence=row["example_sentence"],
            ))
    return result


def reduce_wrong_count(conn: sqlite3.Connection, word: str):
    """Decrement wrong_count by 1 (floor 0) in both wrong word logs."""
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE wrong_words_log
        SET wrong_count = MAX(0, wrong_count - 1)
        WHERE LOWER(word) = LOWER(?)
    """, (word,))
    cursor.execute("""
        UPDATE mcq_wrong_words_log
        SET wrong_count = MAX(0, wrong_count - 1)
        WHERE LOWER(word) = LOWER(?)
    """, (word,))
    conn.commit()
