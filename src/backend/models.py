from pydantic import BaseModel
from typing import List, Optional

class WordOut(BaseModel):
    id: int
    word: str
    part_of_speech: str
    category: str
    meaning: str
    synonym: str
    example_sentence: str

class DailyWordsResponse(BaseModel):
    words: List[WordOut]
    date: str

class SessionState(BaseModel):
    date: str
    current_round: int
    total_score: int
    completed: bool
    round1_words: List[str]
    round2_words: List[str]
    round3_words: List[str]

class GenerateQuizRequest(BaseModel):
    words: List[WordOut]
    round: int
    previous_questions: List[str] = []

class QuizQuestion(BaseModel):
    word: str
    question: str
    choices: List[str]
    correct_answer: str
    explanation: str
    pronunciation: Optional[str] = None

class GenerateQuizResponse(BaseModel):
    questions: List[QuizQuestion]

class AnswerRequest(BaseModel):
    word: str
    chosen_answer: str
    correct_answer: str
    is_correct: bool
    round: int

class AnswerResponse(BaseModel):
    is_correct: bool
    score_delta: int
    explanation: Optional[str] = None
    total_score: int

class CompleteSessionRequest(BaseModel):
    wrong_words: List[str]
    date: str

class WrongWordEntry(BaseModel):
    word: str
    last_wrong_date: str
    wrong_count: int

class MCQQuestion(BaseModel):
    word: str
    question: str
    choices: List[str]
    correct_answer: str
    explanation: str

class MCQSessionState(BaseModel):
    date: str
    current_round: int
    total_score: int
    completed: bool
    round1_words: List[str]
    round2_words: List[str]
    round3_words: List[str]

class MCQAnswerRequest(BaseModel):
    word: str
    is_correct: bool
    round: int
    date: str

class MCQAnswerResponse(BaseModel):
    score_delta: int
    total_score: int

class MCQCompleteRequest(BaseModel):
    wrong_words: List[str]
    date: str

class MCQGenerateRequest(BaseModel):
    words: List[WordOut]
    previous_questions: List[str] = []

class MCQGenerateResponse(BaseModel):
    questions: List[MCQQuestion]
