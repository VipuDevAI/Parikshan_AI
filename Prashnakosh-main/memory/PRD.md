# Prashnakosh - Education Governance Platform

## Original Problem Statement
Build a comprehensive education governance application with:
- Super Admin dashboard to manage schools, users, and settings
- Question bank management with bulk upload from Word documents
- Blueprint-driven exam paper generation
- Multi-school/tenant support with role-based access (Principal, HOD, Teacher, Student)

## Core Requirements

### 1. User Management
- Multi-tenant architecture (schools as tenants)
- Roles: Super Admin, Principal, HOD, Teacher, Student
- School code-based login

### 2. Question Management  
- Bulk upload from .docx files
- Question types: MCQ, Short Answer, Long Answer, True/False, Fill-in-blank
- Blueprint-based paper generation

### 3. Exam Workflow
- Blueprint creation with sections, marks, chapters
- HOD approval workflow
- Principal review
- Paper generation with multiple sets

### 4. Paper Generation Features
- PDF and DOCX export
- Multiple sets (Set 1, 2, 3) with shuffled questions
- School logo support
- Test name, marks, duration display
- Answer key generation

## What's Been Implemented

### December 2024
- [x] Full-stack React/Node.js application deployed on Render
- [x] PostgreSQL database with Drizzle ORM
- [x] Multi-tenant school management
- [x] User CRUD operations with role-based access
- [x] Question bank with 1,492+ questions uploaded
- [x] Blueprint creation with wing/exam/chapter selection
- [x] Test creation linked to blueprints
- [x] PDF/DOCX paper generation with multiple sets
- [x] **NEW**: School logo support in paper generation
- [x] **NEW**: Custom logo URL input for HODs
- [x] **NEW**: Logo field in Super Admin school management

### Schools Created
1. Original school (SCH001)
2. Maharishi Vidya Mandir (MVMCHN) - 5 test students, Principal, HOD, Teacher

## Tech Stack
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Shadcn UI
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **Deployment**: Render

## Prioritized Backlog

### P0 (Critical)
- [ ] Create remaining ~295 student accounts (pending user's list)

### P1 (High Priority)
- [ ] Test logo feature on production with actual school logos

### P2 (Medium Priority)  
- [ ] Integrate AWS S3 for file storage
- [ ] Build PowerBI-level Principal Analytics
- [ ] Clean up obsolete legacy admin pages
- [ ] Address pre-existing TypeScript errors

## Key Files
- `/app/client/src/pages/hod/paper-generator.tsx` - HOD paper generation UI
- `/app/client/src/pages/superadmin/schools.tsx` - School management
- `/app/client/src/pages/blueprints.tsx` - Blueprint creation
- `/app/client/src/pages/tests/create.tsx` - Test creation
- `/app/server/routes.ts` - API routes including PDF generation
- `/app/server/pg-storage.ts` - Database operations

## Credentials (Render Production)
- **Super Admin**: SUPERADMIN / superadmin@safal.com / SuperAdmin@123
- **Principal (MVM)**: MVMCHN / principal@mvmchennai.edu.in / Principal@123
- **HOD CS (MVM)**: MVMCHN / hod.cs@mvmchennai.edu.in / HodCS@123
- **Teacher (MVM)**: MVMCHN / teacher.cs@mvmchennai.edu.in / Teacher@123
- **Student (Example)**: MVMCHN / appanraj@mvmchennai.edu.in / Student@123
