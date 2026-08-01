import re
import sqlite3


def seed_words(conn: sqlite3.Connection, word_bank_path: str) -> int:
    with open(word_bank_path, "r", encoding="utf-8") as f:
        text = f.read()

    # Normalize whitespace to handle line-wrapped entries in the file
    normalized = re.sub(r'\s+', ' ', text)

    pattern = re.compile(
        r'Word:\s*(.+?)\s+Part of Speech:\s*(.+?)\s+Category:\s*(.+?)\s+Meaning:\s*(.+?)\s+Synonym:\s*(.+?)\s+Example:\s*(.+?)(?=\d+\.|$)',
        re.DOTALL
    )

    words = []
    for match in pattern.finditer(normalized):
        words.append({
            "word": match.group(1).strip(),
            "part_of_speech": match.group(2).strip(),
            "category": match.group(3).strip(),
            "meaning": match.group(4).strip(),
            "synonym": match.group(5).strip(),
            "example_sentence": match.group(6).strip(),
        })

    cursor = conn.cursor()
    inserted = 0
    for w in words:
        cursor.execute(
            "INSERT OR IGNORE INTO words (word, part_of_speech, category, meaning, synonym, example_sentence) VALUES (?, ?, ?, ?, ?, ?)",
            (w["word"], w["part_of_speech"], w["category"], w["meaning"], w["synonym"], w["example_sentence"])
        )
        inserted += cursor.rowcount
    conn.commit()
    return inserted
