# Prashnakosh - School SAFAL Platform

Multi-tenant SaaS platform for educational institutions providing comprehensive exam engine, question bank management, and role-based dashboards.

## Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- npm or yarn

### Local Development

1. **Clone and Install**
```bash
git clone <your-repo-url>
cd Prashnakosh-main
npm install
```

2. **Set up Environment**
```bash
cp .env.example .env
# Edit .env with your DATABASE_URL and other settings
```

3. **Initialize Database**
```bash
npm run db:push
```

4. **Start Development Server**
```bash
npm run dev
```

Visit `http://localhost:5000`

### Deployment to Render

See [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md) for detailed deployment instructions.

**Quick Deploy:**
1. Create PostgreSQL database on Render
2. Create Web Service with:
   - Build Command: `npm install && npm run db:push && npm run build`
   - Start Command: `npm run start`
3. Set `DATABASE_URL` environment variable
4. Deploy!

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Express + TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: JWT-based with role-based access control

## Features

- Multi-tenancy with strict data isolation
- Role-based dashboards (Super Admin, Principal, HOD, Teacher, Student, Parent)
- Question bank management with bulk upload
- Exam creation and management
- Student practice sessions and mock tests
- Analytics and reporting
- S3 integration for file storage

## Project Structure

```
├── client/          # React frontend
├── server/          # Express backend
├── shared/          # Shared types and schemas
├── migrations/      # Database migrations
└── script/          # Build scripts
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:push` - Push schema to database
- `npm run db:generate` - Generate migrations
- `npm run db:studio` - Open Drizzle Studio

## Documentation

- [Deployment Guide](./RENDER_DEPLOYMENT.md)
- [Design Guidelines](./design_guidelines.md)
- [Architecture Overview](./replit.md)

## License

MIT
