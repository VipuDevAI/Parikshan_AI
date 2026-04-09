# School SAFAL - Multi-Tenant Question Bank & Assessment Platform

## Overview
School SAFAL is a multi-tenant SaaS platform for educational institutions. Its primary purpose is to provide a comprehensive exam engine, question bank management, and role-based dashboards to streamline assessment creation, delivery, and analysis. Key capabilities include mock tests, practice sessions, chapter-based learning with an unlock system, and robust data isolation for each school. The platform aims to serve teachers, students, parents, and administrators with tailored functionalities.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript (Vite)
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **UI Components**: shadcn/ui (Radix UI)
- **Styling**: Tailwind CSS with a custom olive green theme (#708238).
- **UI/UX**: Features white rounded cards with shadows on an olive background and "coin-style" colorful buttons (Blue for create/view, Gold for upload/premium, Green for approve/success, Red for destructive).
- **Forms**: React Hook Form with Zod validation
- **Math/LaTeX Support**: Custom MathText component for rendering LaTeX.

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ES modules)
- **API**: RESTful API endpoints (`/api/*`)
- **Authentication**: JWT-based with role-based access control and Express sessions.
- **Multi-Tenancy**: Data isolation for each tenant using `tenant_id` and middleware filtering. Super Admin manages multiple schools.
- **Security**: Strict tenant isolation, role-based route protection, S3 storage with tenant-scoped paths, server-side encryption, and signed URLs.
- **Exam Governance**: State machine for exam lifecycle (DRAFT → PENDING_HOD → HOD_APPROVED → ACTIVE → LOCKED → ARCHIVED) with backend validation and audit logging. Exam security includes tab-switch detection and activity logging.
- **Export Features**: DOCX, CSV, and PDF export for question papers, answer keys, and analytics.
- **Question Management**:
    - Supports objective-only questions for online tests.
    - Passage-text attachment to questions.
    - Blueprint-based question selection, including chapter-level filtering and passage-aware selection.
    - Bulk question upload via Word documents (parses .docx for questions, MCQs, answers, marks) and CSV/XLSX. Manual entry is also available.
    - HOD dashboard for question approval/rejection, chapter unlock, and blueprint review.
- **Student Dashboard**: Displays 8 test types, attempts history, and real-time notifications (test unlocked, exam submitted, result published).
- **Principal Dashboard**: Read-only analytics dashboard for school snapshot, grade performance, subject health, at-risk students, and risk alerts.
- **Super Admin Features**:
    - **Academic Year Governance**: Create/activate/lock academic years per school. Only one active year per school enforced at backend.
    - **Exam Master (Exam Frameworks)**: Define whole-year exam structure with exam type (lesson/chapter/unit/term/annual), online/offline mode, duration, total marks, applicable specific grades within grade groups.
    - **Blueprint Governance**: Manage blueprints linked to school+academic year+grade+subject+exam. Lock/unlock blueprints with audit logging. Editable until locked.
    - Grade Configuration: Define grades scoped to academic years.
    - User Credential Governance: Generate user codes, enforce password changes.
    - Global Soft Delete: Soft delete functionality for key entities (users, questions, blueprints, uploads) with usage checks.
    - School Context Switching: Super admin can manage different schools via a switcher.
    - Blueprint Policies: Control mandatory blueprint requirements.
    - User Bulk Upload: Bulk import users via CSV.
    - Reference Library: Manage educational resources.
    - Storage Governance: Track storage usage per school.

### Data Storage
- **Database**: PostgreSQL (configured for Neon serverless).
- **ORM**: Drizzle ORM with drizzle-zod.
- **Migrations**: Drizzle Kit.
- **Storage Engine**: Toggleable between PostgreSQL (default) and In-Memory. Cloud storage (AWS S3, DigitalOcean Spaces, Firebase Storage) for file uploads.

### Project Structure
- `client/`: React frontend.
- `server/`: Express backend.
- `shared/`: Shared types and schemas.
- `migrations/`: Database migrations.

## External Dependencies

### Database & ORM
- **PostgreSQL**: Relational database.
- **Drizzle ORM**: Database toolkit.
- **connect-pg-simple**: PostgreSQL session store.

### Frontend Libraries
- **@tanstack/react-query**: Server state management.
- **Radix UI**: Accessible UI component primitives.
- **Tailwind CSS**: Utility-first CSS framework.
- **wouter**: Lightweight React router.
- **react-hook-form**: Form state management.
- **zod**: Schema validation.

### Backend Libraries
- **Express**: Web framework.
- **jsonwebtoken**: JWT authentication.
- **multer**: File upload handling.
- **nodemailer**: Email functionality.
- **xlsx**: Spreadsheet parsing.
- **mammoth**: .docx file parsing.

### Build Tools
- **Vite**: Frontend build tool.
- **esbuild**: Backend bundling.
- **tsx**: TypeScript execution.