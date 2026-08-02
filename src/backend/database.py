import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "english_buddy.db")

def init_db(path: str = DB_PATH) -> sqlite3.Connection:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word TEXT NOT NULL UNIQUE,
            part_of_speech TEXT,
            category TEXT,
            meaning TEXT,
            synonym TEXT,
            example_sentence TEXT
        );
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL UNIQUE,
            round1_words TEXT DEFAULT '[]',
            round2_words TEXT DEFAULT '[]',
            round3_words TEXT DEFAULT '[]',
            total_score INTEGER DEFAULT 0,
            completed INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS wrong_words_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word TEXT NOT NULL UNIQUE,
            last_wrong_date TEXT NOT NULL,
            wrong_count INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS mcq_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL UNIQUE,
            round1_words TEXT DEFAULT '[]',
            round2_words TEXT DEFAULT '[]',
            round3_words TEXT DEFAULT '[]',
            total_score INTEGER DEFAULT 0,
            completed INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS mcq_wrong_words_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word TEXT NOT NULL UNIQUE,
            last_wrong_date TEXT NOT NULL,
            wrong_count INTEGER DEFAULT 1
        );
    """)
    conn.commit()
    return conn

def get_db() -> sqlite3.Connection:
    return init_db()
