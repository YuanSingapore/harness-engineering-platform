import sqlite3
import os
import pytest
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from database import init_db, get_db

def test_init_db_creates_tables(tmp_path):
    db_path = str(tmp_path / "test.db")
    conn = init_db(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = {row[0] for row in cursor.fetchall()}
    assert "words" in tables
    assert "sessions" in tables
    assert "wrong_words_log" in tables
    conn.close()

def test_words_table_schema(tmp_path):
    db_path = str(tmp_path / "test.db")
    conn = init_db(db_path)
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(words)")
    cols = {row[1] for row in cursor.fetchall()}
    assert cols == {"id", "word", "part_of_speech", "category", "meaning", "synonym", "example_sentence"}
    conn.close()
