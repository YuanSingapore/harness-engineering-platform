import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import pytest
from database import init_db
from services.seed import seed_words

WORD_BANK = os.path.join(
    os.path.dirname(__file__),
    '../../../../../word-bank/P4_Top200_MOE_Aligned_Vocabulary.txt'
)

@pytest.fixture(autouse=True, scope="session")
def seed_db():
    """Seed the shared DB once before all tests in this session."""
    conn = init_db()
    seed_words(conn, WORD_BANK)
    conn.close()
