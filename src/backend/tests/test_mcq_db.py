import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import pytest
from database import init_db

def test_mcq_sessions_table_exists():
    conn = init_db()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='mcq_sessions'")
    assert cursor.fetchone() is not None
    conn.close()

def test_mcq_wrong_words_log_table_exists():
    conn = init_db()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='mcq_wrong_words_log'")
    assert cursor.fetchone() is not None
    conn.close()
