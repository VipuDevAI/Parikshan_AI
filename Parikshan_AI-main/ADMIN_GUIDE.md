# Parikshan.AI - School Administrator Guide

A complete walkthrough for school administrators to set up and manage your Smart School Intelligence Platform.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Wing Management](#wing-management)
4. [User Management](#user-management)
5. [Academic Structure](#academic-structure)
6. [Timetable Management](#timetable-management)
7. [Attendance System](#attendance-system)
8. [Leave Management](#leave-management)
9. [Substitution System](#substitution-system)
10. [AI Camera Integration](#ai-camera-integration)
11. [Alert Management](#alert-management)
12. [Reports & Downloads](#reports--downloads)
13. [School Configuration](#school-configuration)
14. [Role-Based Access](#role-based-access)
15. [Troubleshooting](#troubleshooting)

---

## Getting Started

### First Login

1. Open Parikshan.AI in your browser
2. Enter your **School Code** (provided by Super Admin)
3. Enter your **Username** and **Password**
4. Click **Login**

### Navigation

The sidebar on the left shows all available modules based on your role:
- **Dashboard** - Quick overview of school status
- **Wings** - Manage school divisions
- **Users** - Staff and parent accounts
- **Classes** - Academic structure
- **Timetable** - Schedule management
- **Attendance** - Student and teacher attendance
- **Leaves** - Leave request management
- **Substitutions** - Teacher replacement scheduling
- **Alerts** - AI-generated notifications
- **Settings** - School configuration

---

## Dashboard Overview

The dashboard shows real-time information about your school:

### Key Metrics
- **Total Students** - Current enrollment count
- **Total Teachers** - Active teaching staff
- **Present Today** - Students currently in school
- **Active Alerts** - Issues requiring attention

### Charts & Analytics
- **Attendance Trend** - Weekly attendance pattern
- **Alert Distribution** - Types of alerts by category
- **Teacher Availability** - Staff presence status

### Recent Alerts Panel
Shows the 5 most recent alerts from the AI camera system with severity indicators:
- Red = High Priority (immediate action needed)
- Orange = Medium Priority (review soon)
- Yellow = Low Priority (informational)

---

## Wing Management

Wings divide your school into manageable sections based on grade levels.

### Default Wing Structure

| Wing Name | Grade Range | Description |
|-----------|-------------|-------------|
| KG Wing | Nursery - UKG | Early childhood |
| Primary Wing | 1 - 5 | Elementary grades |
| Middle Wing | 6 - 8 | Middle school |
| Secondary Wing | 9 - 10 | High school |
| Senior Secondary | 11 - 12 | Pre-university |

### Adding a New Wing

1. Go to **Wings** in the sidebar
2. Click **Add Wing**
3. Fill in:
   - **Wing Name**: e.g., "Primary Wing"
   - **Grade From**: Starting grade (1)
   - **Grade To**: Ending grade (5)
4. Click **Save**

### Why Wings Matter

- Each wing can have its own Wing Admin
- Timetables are generated per wing
- Teachers can be assigned to specific wings
- Alerts are filtered by wing for Wing Admins

---

## User Management

### Role Hierarchy

Parikshan.AI uses a 7-level role system (highest to lowest):

| Role | Access Level | Typical Position |
|------|--------------|------------------|
| SUPER_ADMIN | Full platform access | System administrator |
| CORRESPONDENT | Full school access | School owner/trustee |
| PRINCIPAL | School-wide management | Head of school |
| VICE_PRINCIPAL | School-wide view + limited actions | Deputy head |
| WING_ADMIN | Wing-specific management | Wing coordinator |
| TEACHER | Own classes + limited view | Teaching staff |
| PARENT | Child-only information | Student guardian |

### Adding Staff Members

1. Go to **Users** in the sidebar
2. Click **Add User**
3. Fill in:
   - **Full Name**: Complete name
   - **Username**: Login name (no spaces)
   - **Email**: Contact email
   - **Phone**: Mobile number (for notifications)
   - **Role**: Select from dropdown
   - **Wing**: Assign to a wing (for Wing Admin/Teacher)
4. Click **Save**

### Bulk Upload (CSV)

For adding many users at once:

1. Prepare a CSV file with columns:
   - name, username, email, phone, role, wingName
2. Go to **Users** > **Import**
3. Upload your CSV file
4. Review the preview
5. Click **Import All**

---

## Academic Structure

### Classes and Sections

Each class can have multiple sections (e.g., Class 6-A, Class 6-B).

#### Adding Classes

1. Go to **Classes** in the sidebar
2. Click **Add Class**
3. Enter:
   - **Class Name**: e.g., "Class 6"
   - **Wing**: Select the appropriate wing
4. Click **Save**

#### Adding Sections

1. Select a class
2. Click **Add Section**
3. Enter:
   - **Section Name**: e.g., "A" or "A1"
   - **Room Number**: Classroom location
   - **Capacity**: Maximum students
4. Click **Save**

### Subjects

#### Adding Subjects

1. Go to **Subjects** (under Timetable menu)
2. Click **Add Subject**
3. Fill in:
   - **Subject Name**: e.g., "Mathematics"
   - **Subject Code**: e.g., "MATH"
   - **Periods Per Week**: Total periods needed
   - **Is Lab**: Check if it's a practical subject
   - **Wing**: Which wing this subject is for
4. Click **Save**

#### Bulk Subject Upload

Upload subjects via CSV with columns:
- name, code, periodsPerWeek, periodsPerDay, isLab, languageGroup, streamGroup

### Teacher-Subject Mapping

Assign which teachers can teach which subjects:

1. Go to **Teacher Subjects**
2. Click **Add Mapping**
3. Select:
   - **Teacher**: From dropdown
   - **Subject**: From dropdown
   - **Priority**: 1 (primary) to 3 (backup)
4. Click **Save**

---

## Timetable Management

### Generating Timetable

1. Go to **Timetable** in the sidebar
2. Select a **Wing**
3. Click **Generate Timetable**
4. The system will automatically:
   - Respect maximum periods per day for each subject
   - Avoid teacher conflicts
   - Schedule labs in consecutive periods
   - Balance the workload across the week

### Reviewing Generated Timetable

After generation, review for any issues:
- **Conflicts**: Same teacher in two places
- **Overload**: Teacher exceeds max periods
- **Gaps**: Empty periods in the middle of the day

### Manual Adjustments

1. Click on any period slot
2. Select a different teacher/subject
3. The system will warn if it creates a conflict
4. Click **Save Changes**

### Freezing Timetable

Once finalized:

1. Click **Freeze Timetable**
2. Confirm the action
3. The timetable becomes read-only
4. Only Principal/VP can unfreeze

### Downloading Timetables

Available formats:
- **Master Timetable**: All sections on one page (PDF)
- **Teacher Timetable**: Individual schedules for each teacher
- **Section Timetable**: Class-wise schedule for display

---

## Attendance System

### How It Works

Parikshan.AI uses AI cameras to automatically track attendance:

1. Cameras detect faces at entry/exit points
2. System matches faces to registered students/teachers
3. Attendance is recorded with timestamp
4. Late arrivals are automatically flagged

### Viewing Attendance

1. Go to **Attendance** in the sidebar
2. Select:
   - **Date**: Which day to view
   - **Wing/Section**: Filter by class
3. View the attendance list with status:
   - **Present**: Arrived on time
   - **Late**: Arrived after threshold
   - **Absent**: Not detected

### Manual Attendance Entry

If cameras are unavailable:

1. Go to **Attendance** > **Manual Entry**
2. Select the section and date
3. Mark each student as Present/Absent/Late
4. Add notes if needed
5. Click **Save**

### Attendance Reports

Generate reports by:
- Date range
- Section
- Individual student
- Export as PDF or Excel

---

## Leave Management

### Teacher Leave Requests

#### Submitting Leave (for Teachers)

1. Go to **Leaves** > **New Request**
2. Fill in:
   - **Leave Type**: Casual/Sick/Earned/Other
   - **Start Date**: First day of leave
   - **End Date**: Last day of leave
   - **Reason**: Brief explanation
3. Click **Submit**

#### Approving Leave (for Admins)

1. Go to **Leaves** > **Pending Requests**
2. Review the request details
3. Check if substitutes are available
4. Click **Approve** or **Reject**
5. If approved, substitution suggestions appear

### Leave Balance

Each teacher has:
- **Casual Leave**: 12 per year
- **Sick Leave**: 10 per year
- **Earned Leave**: Based on service

### Notifications

When leave is approved:
- Teacher receives notification
- Substitute teachers are notified
- Wing Admin is informed
- Class schedule is updated

---

## Substitution System

### How Smart Substitution Works

When a teacher takes leave, the system automatically suggests substitutes based on:

1. **Subject Match**: Teachers who teach the same subject
2. **Availability**: Free periods at that time
3. **Workload**: Teachers with fewer substitutions that week
4. **Priority**: Primary subject teachers preferred

### Substitution Priority Order

1. Same subject, same wing, free period
2. Same subject, different wing, free period
3. Different subject, same wing, free period
4. Any available teacher

### Managing Substitutions

1. Go to **Substitutions** in the sidebar
2. Select the date
3. View all substitution assignments
4. To change a substitute:
   - Click on the assignment
   - Select a different teacher
   - Click **Reassign**

### Substitution Limits

Configured per school:
- Maximum 2 substitutions per teacher per day
- Maximum 6 substitutions per teacher per week
- These limits can be adjusted in Settings

### Downloading Substitution Report

1. Go to **Substitutions** > **Download**
2. Select the date range
3. Choose format (Excel or PDF)
4. Click **Download**

---

## AI Camera Integration

### Registered Cameras

View all cameras in your school:

1. Go to **Settings** > **Cameras**
2. See list of cameras with:
   - Location (Gate, Corridor, Classroom)
   - Status (Online/Offline)
   - Last Activity

### Camera Types

| Type | Location | Purpose |
|------|----------|---------|
| ENTRY | Main Gate | Student/Teacher check-in |
| EXIT | Exit Gates | Check-out tracking |
| CLASSROOM | Each Room | Attention monitoring |
| CORRIDOR | Hallways | Movement tracking |

### Face Registration

For camera recognition to work, all students and teachers must have registered face data:

1. Go to **Settings** > **Face Registration**
2. Select the person (student/teacher)
3. Upload a clear face photo
4. System extracts face encoding
5. Confirm and save

### Camera Simulator (Testing)

Test camera integrations before going live:

1. Go to **Settings** > **Camera Test**
2. Select event type to simulate:
   - Face Detection
   - Discipline Event
   - Attention Monitoring
   - Teacher Presence
3. Click **Simulate**
4. Check if alerts appear correctly

---

## Alert Management

### Types of Alerts

| Alert Type | Trigger | Priority |
|------------|---------|----------|
| No Teacher | Teacher not detected in class | High |
| Low Attention | Less than 60% students attentive | Medium |
| Discipline | Running, fighting detected | High |
| Uniform Violation | Incorrect uniform detected | Low |
| Unauthorized Entry | Unknown face at gate | High |
| Late Arrival | Student/Teacher arrives late | Low |

### Alert Actions

For each alert, you can:

1. **Acknowledge**: Mark as seen
2. **Resolve**: Mark as handled with notes
3. **Escalate**: Forward to higher authority
4. **Ignore**: False positive, dismiss

### Alert History

1. Go to **Alerts** > **History**
2. Filter by:
   - Date range
   - Alert type
   - Priority level
   - Resolution status
3. Export for records

---

## Reports & Downloads

### Available Reports

| Report | Description | Format |
|--------|-------------|--------|
| Master Timetable | Complete school timetable | PDF |
| Teacher Timetables | Individual schedules | PDF/Excel |
| Section Timetables | Class-wise schedules | PDF |
| Attendance Summary | Daily/Weekly/Monthly | Excel |
| Substitution Report | Replacement assignments | Excel/PDF |
| Alert Summary | Camera alert statistics | PDF |

### Generating Reports

1. Go to **Reports** in sidebar
2. Select report type
3. Choose parameters (date, wing, etc.)
4. Click **Generate**
5. Download or print

---

## School Configuration

### Access Settings

1. Go to **Settings** in sidebar
2. Available options based on your role

### Key Configuration Options

| Setting | Description | Default |
|---------|-------------|---------|
| Periods Per Day | Teaching periods daily | 8 |
| Period Duration | Minutes per period | 40 |
| Late Threshold | Minutes after bell | 15 |
| Min Attendance | Required % | 75 |
| Sub Deadline | Hours before class | 18 |
| Max Subs/Day | Per teacher limit | 2 |
| Max Subs/Week | Weekly limit | 6 |

### Notification Preferences

Configure how alerts are sent:
- **Email**: SendGrid integration
- **Push**: Mobile app notifications
- **WhatsApp**: Message alerts
- **SMS**: Text message (if configured)

---

## Role-Based Access

### What Each Role Can Do

#### Principal / Correspondent
- View all data across school
- Approve/Reject leaves
- Generate substitutions
- Freeze/Unfreeze timetables
- Manage all users
- Access all reports

#### Vice Principal
- View all data
- Approve leaves (limited)
- View substitutions
- Cannot freeze timetables
- Cannot manage users

#### Wing Admin
- View data for their wing only
- Approve leaves for wing teachers
- Manage substitutions in wing
- View wing alerts only

#### Teacher
- View own timetable
- Submit leave requests
- View own substitution assignments
- Mark manual attendance (own classes)

#### Parent
- View child's attendance
- View child-related alerts
- No access to school-wide data

---

## Troubleshooting

### Common Issues

#### "Login Failed"
- Check school code is correct
- Verify username/password
- Caps lock may be on
- Contact admin if locked out

#### "Timetable Generation Failed"
- Ensure all subjects have assigned teachers
- Check teacher-subject mappings
- Verify periods per week don't exceed availability

#### "Camera Not Detecting Faces"
- Ensure face is registered
- Check lighting conditions
- Camera may be offline - check status

#### "Substitution Not Found"
- All teachers may be occupied
- Workload limits reached
- Try manual assignment

#### "Alerts Not Appearing"
- Check alert notification settings
- Verify camera is online
- Review alert priority filters

### Getting Help

For technical support:
1. Check this guide first
2. Contact your school's IT administrator
3. Email: support@parikshan.ai
4. Phone: [Your support number]

---

## Quick Reference Card

### Daily Tasks

- [ ] Check Dashboard for alerts
- [ ] Review attendance summary
- [ ] Process pending leave requests
- [ ] Verify substitutions assigned
- [ ] Acknowledge critical alerts

### Weekly Tasks

- [ ] Review attendance trends
- [ ] Check substitution reports
- [ ] Verify timetable compliance
- [ ] Update any schedule changes

### Monthly Tasks

- [ ] Generate attendance reports
- [ ] Review alert statistics
- [ ] Update user accounts as needed
- [ ] Check system configuration

---

**Powered by SmartGenEduX 2025 | All Rights Reserved**

For more technical information, see DEPLOYMENT.md
