import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from services.seed import seed_words
from routers import words as words_router
from routers import quiz as quiz_router
from routers import mcq as mcq_router

app = FastAPI(title="English Buddy API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(words_router.router)
app.include_router(quiz_router.router)
app.include_router(mcq_router.router)

@app.on_event("startup")
def startup():
    conn = init_db()
    word_bank = os.path.join(os.path.dirname(__file__), "../../word-bank/P4_Top200_MOE_Aligned_Vocabulary.txt")
    seed_words(conn, word_bank)
    conn.close()

@app.get("/health")
def health():
    return {"status": "ok"}
