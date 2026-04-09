# Parikshan.AI - Smart School Intelligence Platform

## Overview

Parikshan.AI is a multi-tenant, AI-powered Smart School Intelligence Platform designed for Indian schools. The platform integrates AI camera intelligence, attendance management (teacher + student), timetable scheduling with intelligent substitution, role-based dashboards, and communication integrations. Built as a production-ready SaaS capable of serving 100+ schools.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with custom theme configuration
- **UI Components**: Shadcn/ui component library (Radix UI primitives)
- **Animations**: Framer Motion for page transitions and alerts
- **Charts**: Recharts for analytics dashboards

The frontend follows a page-based structure with protected routes. Authentication state is managed through a custom `useAuth` hook that integrates with React Query.

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Pattern**: RESTful endpoints defined in `shared/routes.ts`
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Build Tool**: esbuild for server bundling, Vite for client

The backend uses a storage abstraction layer (`server/storage.ts`) for all database operations, making it easy to swap implementations.

### Multi-Tenancy Design
Every entity includes a `schoolId` field for tenant isolation. The system supports:
- Schools as primary tenants
- Wings within schools (KG, Primary, Middle, Secondary, Senior Secondary)
- Role-based access control with roles: SUPER_ADMIN, CORRESPONDENT, PRINCIPAL, VICE_PRINCIPAL, WING_ADMIN, TEACHER, PARENT

### Database Schema
Key tables defined in `shared/schema.ts`:
- `schools` - Tenant information with unique school codes
- `wings` - School divisions with grade ranges
- `users` - All user roles with school/wing associations
- `classes` and `sections` - Academic structure
- `students` - Student records
- `timetable` - Weekly scheduling
- `attendance` - Attendance records
- `alerts` - AI-generated alerts from camera systems
- `leaveRequests` and `substitutions` - Leave management
- `cameras` - Surveillance system configuration
- `schoolConfig` - Per-school settings

### AI Integration
The platform includes AI services through Replit AI Integrations:
- Chat functionality via OpenAI-compatible API
- Image generation capabilities
- Batch processing utilities with rate limiting

## External Dependencies

### Database
- PostgreSQL database (configured via `DATABASE_URL` environment variable)
- Drizzle ORM for type-safe queries
- Schema migrations managed through `drizzle-kit`

### AI Services
- OpenAI-compatible API via Replit AI Integrations
- Environment variables: `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`

### Key NPM Packages
- `express` - HTTP server
- `drizzle-orm` / `drizzle-zod` - Database ORM and validation
- `@tanstack/react-query` - Server state management
- `zod` - Schema validation
- `date-fns` - Date formatting
- `recharts` - Data visualization
- `framer-motion` - Animations

### Development Tools
- Vite for frontend development with HMR
- TypeScript for type safety across the stack
- Path aliases: `@/*` for client source, `@shared/*` for shared code

## Production Features

### Security & Authentication
- Role-based permission middleware (`requireAuth`, `requirePermission`) applied to all sensitive API routes
- 7-level role hierarchy enforcement (SUPER_ADMIN to PARENT)
- Wing-based access control for Wing Admins

### Notification Integrations
- **SendGrid Email**: Set `SENDGRID_API_KEY` and `EMAIL_FROM` for email notifications
- **OneSignal Push**: Set `ONESIGNAL_APP_ID` and `ONESIGNAL_API_KEY` for mobile push
- **WhatsApp/Arattai**: Configure webhook URLs for messaging
- Console fallback when integrations not configured

### Camera AI Integration
- Webhook endpoints for face detection, discipline events, attention monitoring, teacher presence
- Camera Simulator page (`/camera-simulator`) for testing webhooks
- Face encoding storage for 6,000-10,000 users per school

### Deployment
- See `DEPLOYMENT.md` for full deployment guide and school onboarding walkthrough
- Environment template in `.env.example`
- Footer: "Powered by SmartGenEduX 2025 | All Rights Reserved"