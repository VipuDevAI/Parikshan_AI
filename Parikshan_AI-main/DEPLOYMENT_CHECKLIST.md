# 🚀 Render Deployment Checklist

Use this checklist to ensure successful deployment of Prashnakosh to Render.

## Pre-Deployment

### 1. Database Setup
- [ ] Create PostgreSQL database on Render (or external provider)
- [ ] Note down the DATABASE_URL connection string
- [ ] Test database connection locally

### 2. Code Preparation
- [ ] All changes committed to Git
- [ ] Push to GitHub/GitLab
- [ ] Verify branch is correct (usually `main` or `master`)

### 3. Environment Variables Ready
- [ ] DATABASE_URL (from step 1)
- [ ] SESSION_SECRET (generate using: `openssl rand -hex 32`)
- [ ] AWS credentials (if using S3, optional)

---

## Render Setup

### 4. Create Web Service
Go to Render Dashboard → New → Web Service

**Repository:**
- [ ] Connect your Git repository
- [ ] Select the correct branch

**Configuration:**
```
Name:           prashnakosh
Region:         (choose closest to users)
Branch:         main
Root Directory: (leave blank)
Runtime:        Node
Build Command:  npm install && npm run db:push && npm run build
Start Command:  npm run start
```

### 5. Set Environment Variables
Navigate to Environment tab and add:

**Required:**
```
DATABASE_URL    → <paste your PostgreSQL connection string>
NODE_ENV        → production
SESSION_SECRET  → <paste generated secret>
```

**Optional (S3 for file uploads):**
```
AWS_S3_BUCKET          → <your-bucket-name>
AWS_S3_REGION          → us-east-1
AWS_ACCESS_KEY_ID      → <your-access-key>
AWS_SECRET_ACCESS_KEY  → <your-secret-key>
```

### 6. Advanced Settings (Optional)
- [ ] Health Check Path: `/api/health`
- [ ] Auto-Deploy: ✅ Yes (recommended)

---

## Deploy

### 7. Initial Deployment
- [ ] Click "Create Web Service"
- [ ] Wait for build to complete (5-10 minutes)
- [ ] Check logs for errors

### 8. Verify Deployment
- [ ] Visit your Render URL: `https://prashnakosh-xxxx.onrender.com`
- [ ] Check health endpoint: `https://your-url.onrender.com/api/health`
- [ ] Should see: `{"status":"ok","timestamp":"...","environment":"production"}`

---

## Post-Deployment

### 9. Create Super Admin
Access your database and run:

```sql
INSERT INTO users (id, email, password, name, role, tenant_id, must_change_password, user_code)
VALUES (
  gen_random_uuid(),
  'admin@example.com',
  'TempPassword123!',
  'Super Admin',
  'super_admin',
  NULL,
  true,
  'ADMIN001'
);
```

**Important:** The user must change this password on first login!

### 10. Test Application
- [ ] Login with super admin credentials
- [ ] Create a test tenant (school)
- [ ] Create a test user
- [ ] Upload a test question
- [ ] Generate a test paper

---

## Monitoring

### 11. Set Up Monitoring
- [ ] Enable Render monitoring
- [ ] Set up error alerts
- [ ] Configure uptime checks
- [ ] Set up database backups (Render → Database → Backups)

---

## Troubleshooting

If deployment fails, check:

1. **Build Errors**
   - Review build logs in Render
   - Ensure DATABASE_URL is set before build runs
   - Check `npm run db:push` completes successfully

2. **Runtime Errors**
   - Check application logs
   - Verify environment variables
   - Test database connectivity

3. **404 Errors**
   - Check frontend build succeeded
   - Verify static file serving
   - Check `dist/public` contains files

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detailed solutions.

---

## Success Criteria

Your deployment is successful when:

✅ Build completes without errors  
✅ Service starts and shows "Running"  
✅ Health check returns HTTP 200  
✅ Can access login page  
✅ Can login with super admin  
✅ Database queries work  
✅ Static assets load  

---

## Quick Commands Reference

**Local Development:**
```bash
npm run dev          # Start dev server
npm run db:push      # Push schema to DB
npm run db:studio    # Open DB viewer
```

**Build & Deploy:**
```bash
npm run build        # Build for production
npm run start        # Start production server
```

**Database:**
```bash
npm run db:generate  # Generate migrations
npm run db:migrate   # Run migrations
npm run db:push      # Push schema (no migrations)
```

---

## Deployment Timeline

Expected deployment time: **5-15 minutes**

- Dependencies install: 2-4 min
- Database schema push: 1-2 min
- Client build: 2-5 min
- Server build: 1-2 min
- Service startup: 1 min

---

## Support Resources

- [Render Documentation](https://render.com/docs)
- [Deployment Guide](./RENDER_DEPLOYMENT.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [Project README](./README.md)

---

## Update Checklist

When pushing updates:

- [ ] Test changes locally
- [ ] Commit and push to Git
- [ ] Render auto-deploys (if enabled)
- [ ] Check deployment logs
- [ ] Test deployed changes
- [ ] Monitor for errors

---

**Last Updated:** 2025-04-09
