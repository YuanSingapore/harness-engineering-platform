import pytest
import sqlite3
from database import init_db
from services.bonus_service import get_bonus_words, reduce_wrong_count
import datetime


@pytest.fixture
def conn(tmp_path):
    import os
    db_path = str(tmp_path / "test.db")
    os.environ["DB_PATH"] = db_path
    c = init_db(db_path)
    yield c
    c.close()


def _seed_word(conn, word="anxious"):
    conn.execute("""INSERT OR IGNORE INTO words
        (word, part_of_speech, category, meaning, synonym, example_sentence)
        VALUES (?, 'adj', 'Emotions', 'worried', 'worried', 'She felt anxious.')
    """, (word,))
    conn.commit()


def test_get_bonus_words_recent(conn):
    today = str(datetime.date.today())
    _seed_word(conn, "anxious")
    conn.execute("INSERT INTO wrong_words_log (word, last_wrong_date, wrong_count) VALUES (?, ?, 1)",
                 ("anxious", today))
    conn.commit()
    words = get_bonus_words(conn)
    assert any(w.word.lower() == "anxious" for w in words)


def test_get_bonus_words_high_count(conn):
    old_date = str(datetime.date.today() - datetime.timedelta(days=10))
    _seed_word(conn, "anxious")
    conn.execute("INSERT INTO wrong_words_log (word, last_wrong_date, wrong_count) VALUES (?, ?, 2)",
                 ("anxious", old_date))
    conn.commit()
    words = get_bonus_words(conn)
    assert any(w.word.lower() == "anxious" for w in words)


def test_get_bonus_words_old_low_count_excluded(conn):
    old_date = str(datetime.date.today() - datetime.timedelta(days=10))
    _seed_word(conn, "anxious")
    conn.execute("INSERT INTO wrong_words_log (word, last_wrong_date, wrong_count) VALUES (?, ?, 1)",
                 ("anxious", old_date))
    conn.commit()
    words = get_bonus_words(conn)
    assert not any(w.word.lower() == "anxious" for w in words)


def test_reduce_wrong_count(conn):
    conn.execute("INSERT INTO wrong_words_log (word, last_wrong_date, wrong_count) VALUES ('anxious', '2026-08-01', 3)")
    conn.execute("INSERT INTO mcq_wrong_words_log (word, last_wrong_date, wrong_count) VALUES ('anxious', '2026-08-01', 3)")
    conn.commit()
    reduce_wrong_count(conn, "anxious")
    row = conn.execute("SELECT wrong_count FROM wrong_words_log WHERE word='anxious'").fetchone()
    assert row["wrong_count"] == 2
    row2 = conn.execute("SELECT wrong_count FROM mcq_wrong_words_log WHERE word='anxious'").fetchone()
    assert row2["wrong_count"] == 2


def test_reduce_wrong_count_floor_zero(conn):
    conn.execute("INSERT INTO wrong_words_log (word, last_wrong_date, wrong_count) VALUES ('anxious', '2026-08-01', 0)")
    conn.execute("INSERT INTO mcq_wrong_words_log (word, last_wrong_date, wrong_count) VALUES ('anxious', '2026-08-01', 0)")
    conn.commit()
    reduce_wrong_count(conn, "anxious")
    row = conn.execute("SELECT wrong_count FROM wrong_words_log WHERE word='anxious'").fetchone()
    assert row["wrong_count"] == 0
    row2 = conn.execute("SELECT wrong_count FROM mcq_wrong_words_log WHERE word='anxious'").fetchone()
    assert row2["wrong_count"] == 0
