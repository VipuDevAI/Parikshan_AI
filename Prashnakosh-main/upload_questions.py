#!/usr/bin/env python3
"""
Upload parsed questions to Render database
Run this script with your Render URL
Usage: python3 upload_questions.py https://your-app.onrender.com
"""

import json
import sys
import requests
import time

# Configuration - UPDATE THESE VALUES
RENDER_URL = "https://question-bank-y6wx.onrender.com"  # Your Render URL
SCHOOL_CODE = "MVMCHN"  # Your school code
HOD_EMAIL = "hod.cs@mvmchennai.edu.in"  # HOD email
HOD_PASSWORD = "HodCS@123"  # HOD password

# Settings
BATCH_SIZE = 50  # Upload in batches
GRADE = "12"
SUBJECT = "Computer Science"

def load_questions(filepath="parsed_questions.json"):
    """Load parsed questions from JSON file"""
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)

def login(base_url, school_code, email, password):
    """Login and get auth token"""
    url = f"{base_url}/api/auth/login"
    payload = {
        "schoolCode": school_code,
        "email": email,
        "password": password
    }
    response = requests.post(url, json=payload, timeout=30)
    if response.status_code == 200:
        data = response.json()
        return data.get("token")
    else:
        print(f"Login failed: {response.text}")
        return None

def upload_batch(base_url, token, questions):
    """Upload a batch of questions"""
    url = f"{base_url}/api/questions/bulk"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Format questions for API
    formatted = []
    for q in questions:
        formatted.append({
            "questionText": q["questionText"],
            "type": q["type"],
            "marks": q.get("marks", 1),
            "options": q.get("options"),
            "correctAnswer": q.get("correctAnswer"),
            "chapter": q.get("chapter", "Mixed"),
            "grade": GRADE,
            "subject": SUBJECT,
            "difficulty": "medium",
            "source": q.get("source", "Uploaded"),
            "status": "draft",  # Will need HOD approval
        })
    
    payload = {"questions": formatted}
    response = requests.post(url, json=payload, headers=headers, timeout=60)
    return response

def main():
    global RENDER_URL
    
    # Allow command line override
    if len(sys.argv) > 1:
        RENDER_URL = sys.argv[1]
    
    print("=" * 60)
    print("QUESTION UPLOAD SCRIPT")
    print("=" * 60)
    print(f"Target: {RENDER_URL}")
    print(f"School: {SCHOOL_CODE}")
    print(f"User: {HOD_EMAIL}")
    print()
    
    # Load questions
    print("Loading questions...")
    questions = load_questions()
    print(f"✓ Loaded {len(questions)} questions")
    
    # Login
    print("\nLogging in...")
    token = login(RENDER_URL, SCHOOL_CODE, HOD_EMAIL, HOD_PASSWORD)
    if not token:
        print("✗ Login failed. Check credentials.")
        sys.exit(1)
    print("✓ Login successful")
    
    # Upload in batches
    print(f"\nUploading in batches of {BATCH_SIZE}...")
    
    total_uploaded = 0
    failed_batches = []
    
    for i in range(0, len(questions), BATCH_SIZE):
        batch = questions[i:i+BATCH_SIZE]
        batch_num = (i // BATCH_SIZE) + 1
        total_batches = (len(questions) + BATCH_SIZE - 1) // BATCH_SIZE
        
        print(f"  Batch {batch_num}/{total_batches} ({len(batch)} questions)...", end=" ")
        
        try:
            response = upload_batch(RENDER_URL, token, batch)
            if response.status_code == 200:
                result = response.json()
                count = result.get("count", len(batch))
                total_uploaded += count
                print(f"✓ {count} uploaded")
            else:
                print(f"✗ Error: {response.text[:100]}")
                failed_batches.append(batch_num)
        except Exception as e:
            print(f"✗ Exception: {e}")
            failed_batches.append(batch_num)
        
        # Small delay to avoid rate limiting
        time.sleep(0.5)
    
    # Summary
    print("\n" + "=" * 60)
    print("UPLOAD COMPLETE")
    print("=" * 60)
    print(f"Total uploaded: {total_uploaded}/{len(questions)}")
    
    if failed_batches:
        print(f"Failed batches: {failed_batches}")
    else:
        print("✓ All batches uploaded successfully!")
    
    print("\nNext steps:")
    print("1. Login as HOD and go to Question Bank")
    print("2. Review and approve the uploaded questions")
    print("3. Create tests using approved questions")

if __name__ == "__main__":
    main()
