"""
Question Parser FastAPI Service
Runs on port 8002, proxied through main Express backend
"""

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
import uvicorn
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.question_parser import (
    process_image_file,
    extract_questions_from_images,
    get_cbse_subjects,
    get_chapters_for_subject,
    classify_question_chapter,
    CBSE_SUBJECTS
)

app = FastAPI(
    title="Question Paper Parser API",
    description="AI-powered question extraction from PDF/Image files",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "question-parser"}


@app.get("/api/parser/subjects")
async def list_subjects():
    """Get list of CBSE subjects"""
    return {"subjects": get_cbse_subjects()}


@app.get("/api/parser/chapters/{subject}")
async def list_chapters(subject: str):
    """Get chapters for a subject"""
    chapters = get_chapters_for_subject(subject)
    if not chapters:
        raise HTTPException(status_code=404, detail=f"Subject '{subject}' not found")
    return {"subject": subject, "chapters": chapters}


@app.post("/api/parser/parse-paper")
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
    """
    # Validate file type
    allowed_types = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
    content_type = file.content_type or 'application/octet-stream'
    
    # Check file extension if content_type is generic
    if content_type == 'application/octet-stream':
        ext = file.filename.lower().split('.')[-1] if file.filename else ''
        if ext == 'pdf':
            content_type = 'application/pdf'
        elif ext in ['png']:
            content_type = 'image/png'
        elif ext in ['jpg', 'jpeg']:
            content_type = 'image/jpeg'
    
    if content_type not in allowed_types:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file type. Allowed: PDF, PNG, JPG. Got: {content_type}"
        )
    
    # Validate API key
    if not openai_api_key or len(openai_api_key) < 20:
        raise HTTPException(status_code=400, detail="Valid OpenAI API key is required")
    
    try:
        # Read file
        file_bytes = await file.read()
        
        # Convert to images
        images = process_image_file(file_bytes, content_type)
        
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
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error parsing paper: {str(e)}")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002)
