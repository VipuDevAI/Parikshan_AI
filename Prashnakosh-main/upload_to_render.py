#!/usr/bin/env python3
"""
Complete Setup and Question Upload Script for Render
Creates school, wing, users, and uploads all questions
"""

import json
import requests
import time
import sys

# Configuration
RENDER_URL = "https://question-bank-y6wx.onrender.com"

# Super Admin credentials
SUPER_ADMIN = {
    "schoolCode": "SUPERADMIN",
    "email": "superadmin@safal.com",
    "password": "SuperAdmin@123"
}

# School to create
SCHOOL = {
    "name": "Maharishi Vidya Mandir Senior Secondary School Chetpet Chennai-31",
    "code": "MVMCHN",
    "principalName": "Mr. Vignesh",
    "board": "CBSE",
    "city": "Chennai",
    "active": True
}

# Users to create
USERS = [
    {"email": "principal@mvmchennai.edu.in", "password": "Principal@123", "name": "Mr. Vignesh", "role": "principal"},
    {"email": "hod.cs@mvmchennai.edu.in", "password": "HodCS@123", "name": "Ms. Priya", "role": "hod", "department": "Computer Science"},
    {"email": "teacher.cs@mvmchennai.edu.in", "password": "Teacher@123", "name": "Mr. Kumar", "role": "teacher", "department": "Computer Science"},
    # Students
    {"email": "appanraj@mvmchennai.edu.in", "password": "Student@123", "name": "Appan Raj", "role": "student", "grade": "12", "section": "A"},
    {"email": "kanimozhi@mvmchennai.edu.in", "password": "Student@123", "name": "Kanimozhi", "role": "student", "grade": "12", "section": "A"},
    {"email": "ramya@mvmchennai.edu.in", "password": "Student@123", "name": "Ramya", "role": "student", "grade": "12", "section": "A"},
    {"email": "sasikala@mvmchennai.edu.in", "password": "Student@123", "name": "Sasikala", "role": "student", "grade": "12", "section": "A"},
    {"email": "sangeetha@mvmchennai.edu.in", "password": "Student@123", "name": "Sangeetha", "role": "student", "grade": "12", "section": "A"},
]

BATCH_SIZE = 50

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
    print("COMPLETE SETUP & QUESTION UPLOAD")
    print("=" * 60)
    print(f"Target: {RENDER_URL}\n")
    
    # Step 1: Login as Super Admin
    print("1. Logging in as Super Admin...")
    resp = api_call("POST", "/api/auth/login", data=SUPER_ADMIN)
    if not resp or resp.status_code != 200:
        print(f"   ✗ Login failed: {resp.text if resp else 'No response'}")
        sys.exit(1)
    token = resp.json()["token"]
    print("   ✓ Logged in successfully")
    
    # Step 2: Create/Get School
    print("\n2. Creating school...")
    resp = api_call("POST", "/api/tenants", token, SCHOOL)
    if resp and resp.status_code == 200:
        tenant = resp.json()
        tenant_id = tenant["id"]
        print(f"   ✓ School created: {tenant['name']}")
        print(f"   ✓ School Code: {tenant['code']}")
    elif resp and "already exists" in resp.text.lower():
        print("   ℹ School already exists, fetching...")
        resp = api_call("GET", "/api/tenants", token)
        if resp and resp.status_code == 200:
            tenants = resp.json()
            tenant = next((t for t in tenants if t["code"] == SCHOOL["code"]), None)
            if tenant:
                tenant_id = tenant["id"]
                print(f"   ✓ Found existing school: {tenant['name']}")
            else:
                print("   ✗ Could not find school")
                sys.exit(1)
    else:
        print(f"   ✗ Failed: {resp.text if resp else 'No response'}")
        sys.exit(1)
    
    # Step 3: Create Wing
    print("\n3. Creating Senior Secondary Wing...")
    wing_data = {
        "tenantId": tenant_id,
        "name": "senior_secondary",
        "displayName": "Senior Secondary (11-12)",
        "grades": ["11", "12"],
        "isActive": True
    }
    resp = api_call("POST", "/api/superadmin/wings", token, wing_data)
    if resp and resp.status_code == 200:
        wing = resp.json()
        wing_id = wing["id"]
        print(f"   ✓ Wing created: {wing['displayName']}")
    elif resp and ("exists" in resp.text.lower() or resp.status_code == 409):
        print("   ℹ Wing may already exist")
        wing_id = None
    else:
        print(f"   ⚠ Wing creation: {resp.text if resp else 'Failed'}")
        wing_id = None
    
    # Step 4: Create Users
    print("\n4. Creating users...")
    for user in USERS:
        user_data = {**user, "tenantId": tenant_id, "active": True}
        resp = api_call("POST", "/api/users", token, user_data)
        if resp and resp.status_code == 200:
            print(f"   ✓ Created: {user['name']} ({user['role']})")
        elif resp and "exists" in resp.text.lower():
            print(f"   ℹ Exists: {user['name']} ({user['role']})")
        else:
            print(f"   ⚠ {user['name']}: {resp.text[:50] if resp else 'Failed'}")
    
    # Step 5: Login as HOD to upload questions
    print("\n5. Switching to HOD for question upload...")
    hod_creds = {
        "schoolCode": SCHOOL["code"],
        "email": "hod.cs@mvmchennai.edu.in",
        "password": "HodCS@123"
    }
    resp = api_call("POST", "/api/auth/login", data=hod_creds)
    if not resp or resp.status_code != 200:
        print(f"   ✗ HOD login failed, trying with Super Admin token...")
        # Continue with super admin token but we need tenant context
        # This might not work for tenant-scoped operations
    else:
        token = resp.json()["token"]
        print("   ✓ Logged in as HOD")
    
    # Step 6: Load and upload questions
    print("\n6. Loading questions from JSON...")
    try:
        with open("parsed_questions.json", "r", encoding="utf-8") as f:
            questions = json.load(f)
        print(f"   ✓ Loaded {len(questions)} questions")
    except FileNotFoundError:
        print("   ✗ parsed_questions.json not found!")
        print("   Please run parse_all_docs_v2.py first")
        sys.exit(1)
    
    print(f"\n7. Uploading questions in batches of {BATCH_SIZE}...")
    total_uploaded = 0
    
    for i in range(0, len(questions), BATCH_SIZE):
        batch = questions[i:i+BATCH_SIZE]
        batch_num = (i // BATCH_SIZE) + 1
        total_batches = (len(questions) + BATCH_SIZE - 1) // BATCH_SIZE
        
        # Format for API
        formatted = [{
            "questionText": q["questionText"],
            "type": q["type"],
            "marks": q.get("marks", 1),
            "options": q.get("options"),
            "correctAnswer": q.get("correctAnswer"),
            "chapter": q.get("chapter", "Mixed"),
            "grade": "12",
            "subject": "Computer Science",
            "difficulty": "medium",
            "source": q.get("source", "Uploaded"),
            "status": "draft",
        } for q in batch]
        
        print(f"   Batch {batch_num}/{total_batches}...", end=" ")
        
        resp = api_call("POST", "/api/questions/bulk", token, {"questions": formatted})
        if resp and resp.status_code == 200:
            count = resp.json().get("count", len(batch))
            total_uploaded += count
            print(f"✓ {count}")
        else:
            print(f"✗ {resp.text[:50] if resp else 'Failed'}")
        
        time.sleep(0.3)
    
    # Summary
    print("\n" + "=" * 60)
    print("SETUP COMPLETE!")
    print("=" * 60)
    print(f"✓ School: {SCHOOL['name']}")
    print(f"✓ School Code: {SCHOOL['code']}")
    print(f"✓ Users created: {len(USERS)}")
    print(f"✓ Questions uploaded: {total_uploaded}/{len(questions)}")
    
    print("\n📋 LOGIN CREDENTIALS:")
    print("-" * 40)
    print(f"School Code: {SCHOOL['code']}")
    print()
    print("Principal:")
    print(f"  Email: principal@mvmchennai.edu.in")
    print(f"  Password: Principal@123")
    print()
    print("HOD (Computer Science):")
    print(f"  Email: hod.cs@mvmchennai.edu.in")
    print(f"  Password: HodCS@123")
    print()
    print("Teacher (Computer Science):")
    print(f"  Email: teacher.cs@mvmchennai.edu.in")
    print(f"  Password: Teacher@123")
    print()
    print("Students (Class 12-A):")
    for u in USERS[3:]:
        print(f"  {u['name']}: {u['email']} / Student@123")
    
    print("\n🎯 NEXT STEPS:")
    print("1. Login as HOD → Go to Question Bank")
    print("2. Approve uploaded questions")
    print("3. Create tests for students")

if __name__ == "__main__":
    main()
