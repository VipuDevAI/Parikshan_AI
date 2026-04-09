#!/usr/bin/env python3
"""
Populate chapters table on Render based on unique chapters from questions
"""

import requests
import sys

RENDER_URL = "https://question-bank-y6wx.onrender.com"

# Super Admin credentials
SUPER_ADMIN = {
    "schoolCode": "SUPERADMIN",
    "email": "superadmin@safal.com",
    "password": "SuperAdmin@123"
}

# HOD credentials for MVMCHN
HOD_CREDS = {
    "schoolCode": "MVMCHN",
    "email": "hod.cs@mvmchennai.edu.in",
    "password": "HodCS@123"
}

def api_call(method, endpoint, token=None, data=None):
    """Make API call"""
    url = f"{RENDER_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    try:
        if method == "GET":
            resp = requests.get(url, headers=headers, timeout=30)
        elif method == "POST":
            resp = requests.post(url, json=data, headers=headers, timeout=60)
        return resp
    except Exception as e:
        print(f"Error: {e}")
        return None

def main():
    print("=" * 60)
    print("POPULATE CHAPTERS FROM QUESTIONS")
    print("=" * 60)
    
    # Login as HOD
    print("\n1. Logging in as HOD...")
    resp = api_call("POST", "/api/auth/login", data=HOD_CREDS)
    if not resp or resp.status_code != 200:
        print(f"   ✗ Login failed: {resp.text if resp else 'No response'}")
        sys.exit(1)
    token = resp.json()["token"]
    print("   ✓ Logged in successfully")
    
    # Get all questions to find unique chapters
    print("\n2. Fetching questions to find unique chapters...")
    resp = api_call("GET", "/api/questions", token)
    if not resp or resp.status_code != 200:
        print(f"   ✗ Failed: {resp.text if resp else 'No response'}")
        sys.exit(1)
    
    questions = resp.json()
    print(f"   ✓ Found {len(questions)} questions")
    
    # Extract unique chapters
    chapters_set = set()
    for q in questions:
        chapter = q.get("chapter", "").strip()
        if chapter and chapter not in ["", "Mixed", "Unknown"]:
            chapters_set.add(chapter)
    
    unique_chapters = sorted(list(chapters_set))
    print(f"   ✓ Found {len(unique_chapters)} unique chapters:")
    for ch in unique_chapters:
        print(f"      - {ch}")
    
    # Check existing chapters
    print("\n3. Checking existing chapters...")
    resp = api_call("GET", "/api/chapters", token)
    if resp and resp.status_code == 200:
        existing = resp.json()
        existing_names = set(ch.get("name", "") for ch in existing)
        print(f"   ✓ {len(existing)} chapters already exist")
    else:
        existing_names = set()
        print("   ℹ No existing chapters")
    
    # Create missing chapters
    print("\n4. Creating chapters...")
    created = 0
    skipped = 0
    
    for i, chapter_name in enumerate(unique_chapters, 1):
        if chapter_name in existing_names:
            print(f"   ℹ Skipping (exists): {chapter_name}")
            skipped += 1
            continue
        
        chapter_data = {
            "name": chapter_name,
            "subject": "Computer Science",
            "grade": "12",
            "isLocked": False  # Start unlocked so HOD can use them
        }
        
        resp = api_call("POST", "/api/chapters", token, chapter_data)
        if resp and resp.status_code == 200:
            print(f"   ✓ Created: {chapter_name}")
            created += 1
        else:
            print(f"   ✗ Failed: {chapter_name} - {resp.text if resp else 'No response'}")
    
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Total unique chapters: {len(unique_chapters)}")
    print(f"Created: {created}")
    print(f"Skipped (already existed): {skipped}")
    print("\nChapters are now available in the Chapter Unlock Manager!")

if __name__ == "__main__":
    main()
