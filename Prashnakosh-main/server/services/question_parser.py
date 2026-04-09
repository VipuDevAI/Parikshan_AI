"""
Question Paper Parser Service
Uses OpenAI GPT-4 Vision to extract questions from PDF/Image files
Designed for CBSE board format
"""

import os
import base64
import json
import tempfile
from typing import List, Optional
from pdf2image import convert_from_path, convert_from_bytes
from PIL import Image
import io
from openai import OpenAI

# CBSE typical subjects and their chapters
CBSE_SUBJECTS = {
    "Mathematics": ["Real Numbers", "Polynomials", "Pair of Linear Equations", "Quadratic Equations", "Arithmetic Progressions", "Triangles", "Coordinate Geometry", "Trigonometry", "Circles", "Surface Areas and Volumes", "Statistics", "Probability"],
    "Science": ["Chemical Reactions", "Acids Bases and Salts", "Metals and Non-metals", "Carbon Compounds", "Life Processes", "Control and Coordination", "Reproduction", "Heredity", "Light", "Human Eye", "Electricity", "Magnetic Effects", "Sources of Energy", "Environment"],
    "Physics": ["Electric Charges and Fields", "Electrostatic Potential", "Current Electricity", "Moving Charges and Magnetism", "Magnetism and Matter", "Electromagnetic Induction", "Alternating Current", "Electromagnetic Waves", "Ray Optics", "Wave Optics", "Dual Nature of Radiation", "Atoms", "Nuclei", "Semiconductor Electronics"],
    "Chemistry": ["Solid State", "Solutions", "Electrochemistry", "Chemical Kinetics", "Surface Chemistry", "Isolation of Elements", "p-Block Elements", "d and f Block Elements", "Coordination Compounds", "Haloalkanes", "Alcohols Phenols Ethers", "Aldehydes Ketones", "Amines", "Biomolecules", "Polymers"],
    "Biology": ["Reproduction in Organisms", "Sexual Reproduction in Flowering Plants", "Human Reproduction", "Reproductive Health", "Inheritance and Variation", "Molecular Basis of Inheritance", "Evolution", "Human Health and Disease", "Microbes in Human Welfare", "Biotechnology Principles", "Biotechnology Applications", "Organisms and Populations", "Ecosystem", "Biodiversity"],
    "English": ["Reading Comprehension", "Writing Skills", "Grammar", "Literature", "Poetry", "Prose"],
    "Hindi": ["Gadya Khand", "Kavya Khand", "Lekhan", "Vyakaran"],
    "Social Science": ["India and Contemporary World", "Contemporary India", "Democratic Politics", "Understanding Economic Development"],
    "Computer Science": ["Programming Basics", "Data Structures", "Database Management", "Networking", "Python Programming", "File Handling"],
    "Accountancy": ["Accounting for Partnership", "Reconstitution of Partnership", "Dissolution of Partnership", "Accounting for Share Capital", "Issue of Debentures", "Financial Statements", "Cash Flow Statement", "Financial Statement Analysis"],
    "Business Studies": ["Nature and Purpose of Business", "Forms of Business Organisation", "Business Services", "Business Environment", "Planning", "Organising", "Staffing", "Directing", "Controlling", "Financial Management", "Marketing Management"],
    "Economics": ["Introduction to Economics", "Consumer Behaviour", "Producer Behaviour", "Market Types", "National Income", "Money and Banking", "Government Budget", "Balance of Payments"]
}

QUESTION_EXTRACTION_PROMPT = """You are an expert at extracting questions from CBSE board examination papers.

Analyze this question paper image and extract ALL questions with their details.

For each question, identify:
1. Question number (e.g., "1", "2a", "3.i")
2. Question text (complete question)
3. Question type: mcq, true_false, fill_blank, short_answer, long_answer, numerical, case_study
4. Marks allocated (look for [2], (3 marks), etc.)
5. Options (if MCQ - list as A, B, C, D)
6. Any sub-questions (treat as separate questions with parent reference)
7. Section name if visible (Section A, Section B, etc.)
8. Chapter/Topic hint if identifiable from the question content

CBSE Format Notes:
- Section A: Usually 1 mark MCQs/Very Short Answer (VSA)
- Section B: Usually 2 marks Short Answer (SA-I)
- Section C: Usually 3 marks Short Answer (SA-II)
- Section D: Usually 5 marks Long Answer (LA)
- Section E: Case-based/Source-based questions (4 marks)

Return a JSON array with this structure:
{
  "questions": [
    {
      "questionNumber": "1",
      "section": "A",
      "content": "Full question text here",
      "type": "mcq",
      "marks": 1,
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correctAnswer": null,
      "chapterHint": "Suggested chapter based on content",
      "topicHint": "Suggested topic",
      "difficulty": "easy|medium|hard",
      "hasSubQuestions": false
    }
  ],
  "paperMetadata": {
    "totalMarks": 80,
    "totalQuestions": 30,
    "duration": "3 hours",
    "examType": "Board Exam",
    "detectedSubject": "Mathematics",
    "detectedClass": "10"
  }
}

Important:
- Extract EVERY question, don't skip any
- For case-study questions, extract the passage and each sub-question separately
- If marks aren't visible, estimate based on section (A=1, B=2, C=3, D=5)
- Be precise with question text - copy exactly as shown
- If options are present, it's MCQ
- Return ONLY valid JSON, no other text"""


def encode_image_to_base64(image: Image.Image, format: str = "PNG") -> str:
    """Convert PIL Image to base64 string"""
    buffer = io.BytesIO()
    image.save(buffer, format=format)
    return base64.b64encode(buffer.getvalue()).decode('utf-8')


def pdf_to_images(pdf_bytes: bytes) -> List[Image.Image]:
    """Convert PDF bytes to list of PIL Images"""
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
        tmp.write(pdf_bytes)
        tmp_path = tmp.name
    
    try:
        images = convert_from_path(tmp_path, dpi=200)
        return images
    finally:
        os.unlink(tmp_path)


def process_image_file(file_bytes: bytes, mime_type: str) -> List[Image.Image]:
    """Process uploaded file and return list of images"""
    if mime_type == 'application/pdf':
        return pdf_to_images(file_bytes)
    else:
        # It's an image file
        image = Image.open(io.BytesIO(file_bytes))
        if image.mode == 'RGBA':
            image = image.convert('RGB')
        return [image]


async def extract_questions_from_images(
    images: List[Image.Image],
    openai_api_key: str,
    subject: Optional[str] = None,
    class_level: Optional[str] = None,
    chapter: Optional[str] = None
) -> dict:
    """
    Use OpenAI Vision to extract questions from images
    """
    client = OpenAI(api_key=openai_api_key)
    
    all_questions = []
    paper_metadata = {}
    
    # Process each page
    for i, image in enumerate(images):
        base64_image = encode_image_to_base64(image)
        
        # Build context message
        context = ""
        if subject:
            context += f"Subject: {subject}\n"
        if class_level:
            context += f"Class: {class_level}\n"
        if chapter:
            context += f"Expected Chapter: {chapter}\n"
        
        messages = [
            {
                "role": "system",
                "content": QUESTION_EXTRACTION_PROMPT
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"Page {i+1} of question paper.\n{context}\nExtract all questions from this page:"
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{base64_image}",
                            "detail": "high"
                        }
                    }
                ]
            }
        ]
        
        try:
            response = client.chat.completions.create(
                model="gpt-4o",  # GPT-4 Vision
                messages=messages,
                max_tokens=4096,
                temperature=0.1
            )
            
            content = response.choices[0].message.content
            
            # Parse JSON from response
            # Try to extract JSON from the response
            try:
                # Try direct JSON parse
                result = json.loads(content)
            except json.JSONDecodeError:
                # Try to find JSON in the response
                import re
                json_match = re.search(r'\{[\s\S]*\}', content)
                if json_match:
                    result = json.loads(json_match.group())
                else:
                    result = {"questions": [], "paperMetadata": {}}
            
            if "questions" in result:
                # Add page number to each question
                for q in result["questions"]:
                    q["pageNumber"] = i + 1
                    # Override subject/class if provided
                    if subject:
                        q["subject"] = subject
                    if class_level:
                        q["grade"] = class_level
                all_questions.extend(result["questions"])
            
            if "paperMetadata" in result and i == 0:
                paper_metadata = result["paperMetadata"]
                
        except Exception as e:
            print(f"Error processing page {i+1}: {str(e)}")
            continue
    
    # Override metadata with provided values
    if subject:
        paper_metadata["detectedSubject"] = subject
    if class_level:
        paper_metadata["detectedClass"] = class_level
    
    return {
        "questions": all_questions,
        "paperMetadata": paper_metadata,
        "totalPages": len(images)
    }


def classify_question_chapter(content: str, subject: str) -> dict:
    """
    Try to classify question into chapter based on keywords
    Returns suggested chapter and topic
    """
    if subject not in CBSE_SUBJECTS:
        return {"chapter": None, "topic": None}
    
    chapters = CBSE_SUBJECTS[subject]
    content_lower = content.lower()
    
    # Simple keyword matching
    for chapter in chapters:
        chapter_keywords = chapter.lower().split()
        if any(kw in content_lower for kw in chapter_keywords if len(kw) > 3):
            return {"chapter": chapter, "topic": chapter}
    
    return {"chapter": None, "topic": None}


def get_cbse_subjects() -> List[str]:
    """Return list of CBSE subjects"""
    return list(CBSE_SUBJECTS.keys())


def get_chapters_for_subject(subject: str) -> List[str]:
    """Return chapters for a given subject"""
    return CBSE_SUBJECTS.get(subject, [])
