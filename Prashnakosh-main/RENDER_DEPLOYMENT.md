# Render Deployment Guide for Prashnakosh

## Prerequisites
1. Create a PostgreSQL database on Render (or use Neon, Supabase, etc.)
2. Note down the DATABASE_URL

## Deployment Steps on Render

### Step 1: Create Web Service
1. Go to Render Dashboard
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure as follows:
   - **Name**: prashnakosh (or your preferred name)
   - **Region**: Choose closest to your users
   - **Branch**: main
   - **Root Directory**: (leave blank or specify if in subdirectory)
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run db:push && npm run build`
   - **Start Command**: `npm run start`
   - **Instance Type**: Free or Starter

### Step 2: Set Environment Variables
Add these environment variables in Render:

**Required:**
```
DATABASE_URL=<your-postgresql-connection-string>
NODE_ENV=production
SESSION_SECRET=<generate-random-32-char-string>
```

**Optional (if using S3 for file uploads):**
```
AWS_S3_BUCKET=<your-bucket-name>
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your-access-key>
AWS_SECRET_ACCESS_KEY=<your-secret-key>
```

### Step 3: Database Setup
The build command includes `npm run db:push` which will:
- Create all database tables
- Set up the schema automatically
- Initialize required relationships

### Step 4: Deploy
1. Click "Create Web Service"
2. Render will automatically:
   - Install dependencies
   - Push database schema
   - Build the application
   - Start the server

## Troubleshooting

### Error: DATABASE_URL is required
**Solution**: Add DATABASE_URL in Render environment variables

### Error: Build fails with "Cannot find module"
**Solution**: Make sure all dependencies are in package.json (not devDependencies if needed at runtime)

### Error: Database connection timeout
**Solution**: 
- Check DATABASE_URL is correct
- Ensure database is running and accessible
- Check firewall rules allow connections

### Error: Port already in use
**Solution**: Render automatically sets the PORT environment variable. The app uses `process.env.PORT` by default.

## Post-Deployment

### Create Super Admin User
You'll need to manually create a super admin user in the database:

```sql
INSERT INTO users (id, email, password, name, role, tenant_id, must_change_password)
VALUES (
  gen_random_uuid(),
  'admin@example.com',
  'admin123',  -- Change this!
  'Super Admin',
  'super_admin',
  NULL,
  true
);
```

**Important**: Change the password after first login!

### Access the Application
- Your app will be available at: `https://prashnakosh-<your-id>.onrender.com`
- Login with super admin credentials
- Create tenants (schools) from the admin panel

## Environment Variables Explanation

- **DATABASE_URL**: PostgreSQL connection string
- **NODE_ENV**: Set to `production` for production builds
- **SESSION_SECRET**: Random string for session encryption (keep secret!)
- **PORT**: Auto-set by Render, don't override
- **AWS_***: Optional, for S3 file storage. Leave blank to use local storage

## Monitoring

- View logs in Render Dashboard
- Set up alerts for downtime
- Monitor database performance

## Scaling

- Start with Free tier for testing
- Upgrade to Starter ($7/month) for production
- Scale database separately as needed

## Support

If you encounter issues:
1. Check Render logs for error messages
2. Verify all environment variables are set
3. Test database connection separately
4. Check build logs for any failures

## Additional Notes

- The app uses PostgreSQL (not MongoDB)
- Migrations are auto-applied during build
- File uploads work with or without S3 (falls back to local if S3 not configured)
- The app includes session management and authentication out of the box
