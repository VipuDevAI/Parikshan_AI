# Parikshan.AI - Deployment & Onboarding Guide

## Quick Start

### Prerequisites

1. **GitHub Repository**: Push this code to a GitHub repo
2. **Neon Database**: Create a PostgreSQL database at [neon.tech](https://neon.tech)
3. **Render Account**: Sign up at [render.com](https://render.com)

---

## Environment Variables Template

Create a `.env` file with:

```bash
# Required
DATABASE_URL=postgresql://user:password@host:port/database
SESSION_SECRET=your-secure-random-string-min-32-chars

# Optional - Email Notifications (SendGrid)
SENDGRID_API_KEY=SG.xxxxxxxxxx
EMAIL_FROM=noreply@yourschool.edu

# Optional - Push Notifications (OneSignal)
ONESIGNAL_APP_ID=your-app-id
ONESIGNAL_API_KEY=your-rest-api-key

# Optional - WhatsApp/Arattai
WHATSAPP_WEBHOOK_URL=https://api.whatsapp.com/v1/messages
ARATTAI_WEBHOOK_URL=https://api.arattai.in/send
```

---

## Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/parikshan-ai.git
git push -u origin main
```

## Step 2: Create Neon Database

1. Go to [neon.tech](https://neon.tech) and create a new project
2. Copy the connection string (looks like: `postgresql://user:pass@host/db`)
3. Save it - you'll need it for Render

## Step 3: Deploy on Render

### Option A: Using render.yaml (Recommended)

1. Go to [render.com/dashboard](https://dashboard.render.com)
2. Click **New** > **Blueprint**
3. Connect your GitHub repo
4. Render will auto-detect `render.yaml`
5. Add your `DATABASE_URL` environment variable with your Neon connection string
6. Deploy!

### Option B: Manual Setup

1. Go to [render.com/dashboard](https://dashboard.render.com)
2. Click **New** > **Web Service**
3. Connect your GitHub repo
4. Configure:
   - **Name**: `parikshan-ai`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Add Environment Variables:
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = your Neon connection string
   - `SESSION_SECRET` = (generate a random string)
6. Deploy!

## Step 4: Initialize Database

After first deployment, the database tables will be created automatically on first request.

To seed demo data, you can:
1. Access your app and navigate to any page (tables auto-create)
2. Or run migrations manually via Render Shell:
   ```bash
   npm run db:push
   ```

## Environment Variables Summary

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Random string for session encryption |
| `NODE_ENV` | Yes | Set to `production` |

## Local Development

```bash
npm install
npm run dev
```

App runs at `http://localhost:5000`

## Build Commands

- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run dev` - Start development server
- `npm run db:push` - Push schema to database

## Test Credentials

After seeding, use these to login:
- **School Code**: `PARIKSHAN001`
- **Username**: `admin`, `principal`, or `teacher1`
- **Password**: `password123`

---

## School Onboarding Walkthrough

### Step 1: Create School Account

1. Super Admin logs into the platform
2. Navigate to Settings > Schools
3. Click "Add School" and fill:
   - School Name: "ABC International School"
   - School Code: "ABCINT001" (unique identifier)
   - Address: Full school address
   - Tier: BASIC / STANDARD / PREMIUM / ENTERPRISE

### Step 2: Configure Wings

Wings divide the school by grade levels:

1. Go to Settings > Wings
2. Add wings with grade ranges:
   - "KG Wing" - Grades: 0-0 (Nursery to UKG)
   - "Primary Wing" - Grades: 1-5
   - "Secondary Wing" - Grades: 6-10
   - "Senior Secondary Wing" - Grades: 11-12

### Step 3: Create User Accounts

Role hierarchy (highest to lowest):
1. SUPER_ADMIN - Platform-wide access
2. CORRESPONDENT - School owner/trustee
3. PRINCIPAL - School head
4. VICE_PRINCIPAL - Deputy head
5. WING_ADMIN - Wing coordinator
6. TEACHER - Teaching staff
7. PARENT - Student guardian

### Step 4: Academic Structure

Upload via CSV or use API:

```json
POST /api/upload/classes
{
  "schoolId": 1,
  "wingId": 2,
  "data": [
    { "className": "Class 6", "sections": ["A1", "A2", "A3"], "roomPrefix": "6" }
  ]
}

POST /api/upload/subjects
{
  "schoolId": 1,
  "wingId": 2,
  "data": [
    { "name": "Mathematics", "code": "MATH", "periodsPerWeek": 6 },
    { "name": "Physics Lab", "code": "PHYLAB", "periodsPerWeek": 2, "isLab": true }
  ]
}

POST /api/upload/teacher-subjects
{
  "schoolId": 1,
  "wingId": 2,
  "data": [
    { "teacherName": "Mrs. Sharma", "subjectName": "Mathematics" }
  ]
}
```

### Step 5: School Configuration

Configure in Settings:
- Periods Per Day: 8
- Substitution Deadline: 18 hours before
- Max Substitutions Per Day: 2 per teacher
- Max Substitutions Per Week: 6 per teacher
- Late Threshold: 15 minutes
- Minimum Attendance: 75%

### Step 6: Timetable Generation

1. Go to Timetable Management
2. Select Wing
3. Click "Generate Timetable"
4. Review and resolve conflicts
5. Click "Freeze" to lock

Download options:
- Master Timetable (all sections)
- Teacher-wise Timetable
- Section-wise Timetable

### Step 7: Camera Integration

Register cameras and configure webhooks:

- **Face Detection**: `POST /api/camera/webhook/face`
- **Discipline Events**: `POST /api/camera/webhook/discipline`
- **Attention Monitoring**: `POST /api/camera/webhook/attention`
- **Teacher Presence**: `POST /api/camera/webhook/teacher-presence`

Test with Camera Simulator page (Settings > Camera Test)

### Step 8: Face Registration

For 6,000-10,000 users per school:

```json
POST /api/face-encodings
{
  "schoolId": 1,
  "entityType": "STUDENT",
  "entityId": 123,
  "sectionId": 5,
  "encoding": "base64-face-vector",
  "photoUrl": "data:image/jpeg;base64,..."
}
```

---

## Production Checklist

- [ ] Set strong SESSION_SECRET
- [ ] Configure SendGrid for email alerts
- [ ] Configure OneSignal for mobile push
- [ ] Set up WhatsApp Business API
- [ ] Test camera webhooks with simulator
- [ ] Verify role permissions work correctly
- [ ] Train school admins on dashboard

---

Powered by SmartGenEduX 2025 | All Rights Reserved
