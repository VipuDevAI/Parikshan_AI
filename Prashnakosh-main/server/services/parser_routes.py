"""
Question Paper Parser API Routes
FastAPI endpoints for parsing question papers
"""

from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Depends
from fastapi.responses import JSONResponse
from typing import Optional, List
import os
from pydantic import BaseModel

from .question_parser import (
    process_image_file,
    extract_questions_from_images,
    get_cbse_subjects,
    get_chapters_for_subject,
    classify_question_chapter,
    CBSE_SUBJECTS
)

router = APIRouter(prefix="/api/parser", tags=["Question Parser"])

class ParsedQuestion(BaseModel):
    questionNumber: str
    section: Optional[str] = None
    content: str
    type: str
    marks: int
    options: Optional[List[str]] = None
    correctAnswer: Optional[str] = None
    chapterHint: Optional[str] = None
    topicHint: Optional[str] = None
    difficulty: str = "medium"
    subject: Optional[str] = None
    grade: Optional[str] = None
    pageNumber: int = 1

class ParseResponse(BaseModel):
    success: bool
    questions: List[ParsedQuestion]
    paperMetadata: dict
    totalPages: int
    message: str


@router.get("/subjects")
async def list_subjects():
    """Get list of CBSE subjects"""
    return {"subjects": get_cbse_subjects()}


@router.get("/chapters/{subject}")
async def list_chapters(subject: str):
    """Get chapters for a subject"""
    chapters = get_chapters_for_subject(subject)
    if not chapters:
        raise HTTPException(status_code=404, detail=f"Subject '{subject}' not found")
    return {"subject": subject, "chapters": chapters}


@router.post("/parse-paper")
async def parse_question_paper(
    file: UploadFile = File(...),
    subject: Optional[str] = Form(None),
    class_level: Optional[str] = Form(None),
    chapter: Optional[str] = Form(None),
    exam_type: Optional[str] = Form(None),
    openai_api_key: str = Form(...)
):
    """
    Parse a question paper PDF or image and extract questions.
    
    - **file**: PDF or image file (PNG, JPG, JPEG)
    - **subject**: Subject name (e.g., Mathematics, Physics)
    - **class_level**: Class/Grade (e.g., 10, 12)
    - **chapter**: Specific chapter if known
    - **exam_type**: Type of exam (Unit Test, Half Yearly, Board Exam, etc.)
    - **openai_api_key**: Your OpenAI API key for GPT-4 Vision
    """
    
    # Validate file type
    allowed_types = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file type. Allowed: PDF, PNG, JPG. Got: {file.content_type}"
        )
    
    # Validate API key
    if not openai_api_key or len(openai_api_key) < 20:
        raise HTTPException(status_code=400, detail="Valid OpenAI API key is required")
    
    try:
        # Read file
        file_bytes = await file.read()
        
        # Convert to images
        images = process_image_file(file_bytes, file.content_type)
        
        if not images:
            raise HTTPException(status_code=400, detail="Could not process the uploaded file")
        
        # Extract questions using AI
        result = await extract_questions_from_images(
            images=images,
            openai_api_key=openai_api_key,
            subject=subject,
            class_level=class_level,
            chapter=chapter
        )
        
        # Add exam type to metadata
        if exam_type:
            result["paperMetadata"]["examType"] = exam_type
        
        # Try to classify chapters for questions without hints
        if subject:
            for q in result["questions"]:
                if not q.get("chapterHint"):
                    classification = classify_question_chapter(q["content"], subject)
                    q["chapterHint"] = classification["chapter"]
                    q["topicHint"] = classification["topic"]
        
        return {
            "success": True,
            "questions": result["questions"],
            "paperMetadata": result["paperMetadata"],
            "totalPages": result["totalPages"],
            "message": f"Successfully extracted {len(result['questions'])} questions from {result['totalPages']} page(s)"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing paper: {str(e)}")


@router.post("/save-parsed-questions")
async def save_parsed_questions(
    questions: List[dict],
    tenant_id: str,
    created_by: str
):
    """
    Save parsed questions to the database.
    This endpoint is called after the user reviews and confirms the parsed questions.
    """
    # This will be handled by the main routes.ts
    # Just return the formatted questions for now
    formatted_questions = []
    
    for q in questions:
        formatted_questions.append({
            "content": q.get("content", ""),
            "type": q.get("type", "short_answer"),
            "subject": q.get("subject", ""),
            "chapter": q.get("chapterHint") or q.get("chapter", ""),
            "topic": q.get("topicHint") or q.get("topic", ""),
            "grade": q.get("grade", ""),
            "difficulty": q.get("difficulty", "medium"),
            "marks": q.get("marks", 1),
            "options": q.get("options"),
            "correctAnswer": q.get("correctAnswer"),
            "bloomLevel": "understand",  # Default
            "tenantId": tenant_id,
            "createdBy": created_by,
            "status": "pending"  # Goes to HOD for review
        })
    
    return {
        "success": True,
        "formattedQuestions": formatted_questions,
        "count": len(formatted_questions)
    }
