import os, sys, sqlite3
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from database import init_db
from services.seed import seed_words

WORD_BANK = os.path.join(os.path.dirname(__file__), '../../../word-bank/P4_Top200_MOE_Aligned_Vocabulary.txt')

def test_seed_words_inserts_records(tmp_path):
    conn = init_db(str(tmp_path / "test.db"))
    count = seed_words(conn, WORD_BANK)
    assert count > 0

def test_seed_words_idempotent(tmp_path):
    conn = init_db(str(tmp_path / "test.db"))
    count1 = seed_words(conn, WORD_BANK)
    count2 = seed_words(conn, WORD_BANK)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM words")
    total = cursor.fetchone()[0]
    assert total == count1  # no duplicates on second seed

def test_seeded_word_has_required_fields(tmp_path):
    conn = init_db(str(tmp_path / "test.db"))
    seed_words(conn, WORD_BANK)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM words LIMIT 1")
    row = cursor.fetchone()
    assert row["word"]
    assert row["meaning"]
