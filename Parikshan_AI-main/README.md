# Parikshan AI - School Management Platform

Multi-feature school management system with AI integration, camera monitoring, timetable management, and comprehensive administrative tools.

## 🚀 Quick Deploy to Render

### Prerequisites
- PostgreSQL database (Render, Neon, or Supabase)
- Node.js 18+

### Deployment Steps

1. **Create PostgreSQL Database**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Create PostgreSQL database (Free tier for testing)
   - Copy the Internal Database URL

2. **Create Web Service**
   ```
   Build Command:  npm install && npm run db:push && npm run build
   Start Command:  npm run start
   ```

3. **Set Environment Variables**
   ```
   DATABASE_URL=<your-postgresql-url>
   NODE_ENV=production
   SESSION_SECRET=<random-32-char-string>
   ```

4. **Deploy!**
   - Your app will be live in 5-10 minutes

## 📚 Documentation

- **[QUICK_START.md](./QUICK_START.md)** - 5-minute deployment guide
- **[FIX_SUMMARY.md](./FIX_SUMMARY.md)** - Technical fix details  
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Common errors & solutions
- **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** - Step-by-step guide

## ✅ Recent Fixes

**Issue**: Application was crashing on Render with SyntaxError at line 70

**Solution**: Disabled aggressive esbuild minification that was corrupting Drizzle ORM code

**Status**: ✅ FIXED and ready to deploy!

## 🛠 Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Express + TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **AI**: Chat and Image generation integration
- **Real-time**: WebSocket support

## 📦 Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run db:push      # Push schema to database
npm run db:studio    # Open Drizzle Studio
```

## 🎯 Features

- Multi-school management
- Role-based access control
- Timetable management
- Attendance tracking
- Leave management
- Camera AI integration
- AI chat assistant
- Image generation
- Substitution engine
- Alert system

## 📝 License

MIT

---

**For deployment help, see [QUICK_START.md](./QUICK_START.md)**
