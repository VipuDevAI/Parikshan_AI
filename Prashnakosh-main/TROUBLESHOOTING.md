# Prashnakosh Troubleshooting Guide

## Common Render Deployment Errors

### 1. Error: "DATABASE_URL environment variable is required"

**Cause**: The DATABASE_URL is not set in Render environment variables.

**Solution**:
1. Go to your Render service dashboard
2. Navigate to "Environment" tab
3. Add a new environment variable:
   - **Key**: `DATABASE_URL`
   - **Value**: Your PostgreSQL connection string (format: `postgresql://user:password@host:port/database`)
4. Click "Save Changes"
5. Render will automatically redeploy

**Getting DATABASE_URL**:
- **Render PostgreSQL**: Dashboard → Database → Internal Connection String
- **Neon**: Project → Connection Details → Copy connection string
- **Supabase**: Project Settings → Database → Connection String → Node.js

---

### 2. Error: Syntax error in compiled code (line 70)

**Cause**: esbuild is over-minifying the Drizzle ORM code.

**Solution**: Already fixed in `script/build.ts` by:
```typescript
minify: false,  // Disabled minification
keepNames: true,  // Preserve names
```

If you still see this error:
1. Clear Render build cache
2. Trigger manual deploy
3. Check that build.ts changes are committed

---

### 3. Error: "Cannot connect to database"

**Possible Causes**:
- Wrong DATABASE_URL format
- Database not running
- Network/firewall issues
- SSL certificate issues

**Solutions**:

**A. Check DATABASE_URL Format**
```
Correct:   postgresql://user:password@host.com:5432/dbname
Incorrect: postgres://...  (should be postgresql://)
Incorrect: Missing password or host
```

**B. Add SSL if required** (for Neon, Render, Supabase):
Update `server/db.ts`:
```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
```

**C. Test Connection Locally**:
```bash
psql "postgresql://user:password@host:5432/dbname"
```

---

### 4. Error: "Build failed" or "npm install failed"

**Solutions**:

**A. Check package.json**:
Ensure all dependencies are listed (not just devDependencies)

**B. Clear Render cache**:
1. Go to Render dashboard
2. Settings → "Clear build cache & deploy"

**C. Check Node version**:
Add to `package.json`:
```json
"engines": {
  "node": ">=18.0.0"
}
```

---

### 5. Error: "Port already in use" or "EADDRINUSE"

**Cause**: App trying to use wrong port.

**Solution**: The app already uses `process.env.PORT` correctly in `server/index.ts`:
```typescript
const port = parseInt(process.env.PORT || "5000", 10);
```

**Don't** override PORT in environment variables - Render sets it automatically.

---

### 6. Error: "Cannot find module '@shared/schema'"

**Cause**: TypeScript paths not resolved correctly.

**Solution**: Check `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@shared/*": ["./shared/*"]
    }
  }
}
```

Also ensure esbuild in `script/build.ts` handles path aliases properly.

---

### 7. Error: "Migration failed" or "Table already exists"

**Cause**: Running migrations multiple times or schema conflicts.

**Solutions**:

**A. Reset database** (development only!):
```bash
npm run db:drop   # If you add this script
npm run db:push
```

**B. Use proper migration workflow**:
```bash
npm run db:generate  # Generate migration files
npm run db:migrate   # Apply migrations
```

**C. For Render deployment**: The build command includes `db:push` which handles this automatically.

---

### 8. Application starts but shows blank page

**Possible Causes**:
- Frontend build failed
- Assets not being served
- CORS issues

**Solutions**:

**A. Check build logs**:
Look for vite build errors in Render logs

**B. Verify static file serving**:
Check `server/static.ts` is configured correctly

**C. Check browser console**:
- Open DevTools (F12)
- Look for 404 errors or CORS errors
- Check Network tab for failed requests

---

### 9. Error: "Session secret is required" or authentication issues

**Solution**:
Add SESSION_SECRET to Render environment variables:
```
SESSION_SECRET=<generate-random-32-character-string>
```

Generate a secure secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### 10. Slow Build Times

**Solutions**:

**A. Use build cache**:
Render automatically caches `node_modules` between builds

**B. Optimize dependencies**:
```json
"dependencies": {
  // Only include what's needed for production
}
```

**C. Skip unnecessary builds**:
In `render.yaml`:
```yaml
buildFilter:
  paths:
    - server/**
    - client/**
    - shared/**
```

---

## Debugging Steps

### 1. Check Render Logs
```
Dashboard → Logs → View Real-time
```
Look for:
- Build errors
- Runtime errors
- Database connection errors
- Port binding issues

### 2. Check Environment Variables
```
Dashboard → Environment
```
Verify:
- DATABASE_URL is set
- NODE_ENV=production
- SESSION_SECRET is set (or auto-generated)

### 3. Test Database Connection
Create a test script `test-db.js`:
```javascript
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('❌ Error:', err);
  else console.log('✅ Connected:', res.rows[0]);
  pool.end();
});
```

Run on Render:
```bash
node test-db.js
```

### 4. Check Build Output
In Render logs, verify:
- ✅ Dependencies installed
- ✅ Database schema pushed
- ✅ Client built successfully
- ✅ Server bundled successfully

---

## Getting Help

If you're still stuck:

1. **Check Render Status**: https://status.render.com
2. **Render Community**: https://community.render.com
3. **Review Error Logs**: Copy full error message and search
4. **GitHub Issues**: Check if others have similar issues

---

## Prevention Tips

1. **Test locally first**: Always test with `npm run build && npm run start` before deploying
2. **Use `.env.example`**: Document all required environment variables
3. **Monitor logs**: Set up log monitoring for production
4. **Use health checks**: The `/api/health` endpoint helps monitor app status
5. **Database backups**: Enable automatic backups for production database
6. **Staged deployments**: Use preview environments for testing changes

---

## Quick Diagnostic Checklist

Run through this checklist when debugging:

- [ ] DATABASE_URL is set and correct format
- [ ] Database is running and accessible
- [ ] All environment variables are set
- [ ] Build command completes successfully
- [ ] No minification errors in logs
- [ ] Health check endpoint responds
- [ ] Static assets are being served
- [ ] No CORS errors in browser console
- [ ] Session secret is configured
- [ ] Correct Node version (18+)

---

## Emergency Recovery

If everything breaks:

1. **Rollback**: Render → Deployments → Redeploy previous version
2. **Check database**: Ensure database is healthy
3. **Clear cache**: Settings → Clear build cache & deploy
4. **Restart service**: Manual Deploy → Deploy latest commit
5. **Review recent changes**: Check git diff between working and broken versions
